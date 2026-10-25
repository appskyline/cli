#!/usr/bin/env node
/* Copyright 2013 - 2024 Waiterio LLC */

import { existsSync, realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import loginCommand from '@monorepool/agentfirst/loginCommand.js'
import logoutCommand from '@monorepool/agentfirst/logoutCommand.js'
import schemaCommand from '@monorepool/agentfirst/schemaCommand.js'
import skillsCommand from '@monorepool/agentfirst/skillsCommand.js'
import { program } from 'commander'

import appsCommand from './appsCommand.js'
import getApiUrl from './getApiUrl.js'
import googlePlayCommand from './googlePlayCommand.js'
import invitesCommand from './invitesCommand.js'
import iosAppStoreCommand from './iosAppStoreCommand.js'
import keywordsCommand from './keywordsCommand.js'
import macosAppStoreCommand from './macosAppStoreCommand.js'
import microsoftStoreCommand from './microsoftStoreCommand.js'
import packageJson from './package.json' with { type: 'json' }
import rankCommand from './rankCommand.js'
import api from './request.js'
import reviewStatusCommand from './reviewStatusCommand.js'
import rolesCommand from './rolesCommand.js'
import searchCommand from './searchCommand.js'
import session from './session.js'
import signupCommand from './signupCommand.js'
import usersCommand from './usersCommand.js'
import zapierHooksCommand from './zapierHooksCommand.js'

const cliDirectory = fileURLToPath(new URL('.', import.meta.url))

function isDirectRun() {
  return Boolean(
    process.argv[1] &&
    existsSync(process.argv[1]) &&
    import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href,
  )
}

const BINARY_NAME = 'appskyline'
const APP_URL = 'https://app.appskyline.com'
const ENV_KEY_NAME = 'APPSKYLINE_API_KEY'

program
  .name(BINARY_NAME)
  .description(
    'appskyline cli — manage apps, keywords, and check app store rankings',
  )
  .version(packageJson.version)
  // `signup` comes first because it is the only step an agent could not do on
  // its own: `login` presumes an account already exists.
  .addCommand(signupCommand())
  .addCommand(
    loginCommand({
      binaryName: BINARY_NAME,
      appUrl: APP_URL,
      // `--device` and the code `--browser` prints let the login be approved
      // from a phone or another computer.
      getApiUrl,
      version: packageJson.version,
      session,
      envKeyName: ENV_KEY_NAME,
      // One cheap authenticated GET so a wrong key fails at login instead of
      // at the first real command.
      verify: async () => {
        const apps = await api.get('/api/apps')

        return `Logged in with an API key — ${apps.length} app(s) visible.`
      },
    }),
  )
  .addCommand(
    logoutCommand({
      binaryName: BINARY_NAME,
      session,
      envKeyName: ENV_KEY_NAME,
    }),
  )
  .addCommand(appsCommand())
  .addCommand(reviewStatusCommand())
  .addCommand(keywordsCommand())
  .addCommand(usersCommand())
  .addCommand(rolesCommand())
  .addCommand(invitesCommand())
  .addCommand(zapierHooksCommand())
  .addCommand(searchCommand())
  .addCommand(iosAppStoreCommand())
  .addCommand(macosAppStoreCommand())
  .addCommand(googlePlayCommand())
  .addCommand(microsoftStoreCommand())
  .addCommand(rankCommand())
  .addCommand(skillsCommand({ baseDirectory: cliDirectory }))
  .addCommand(schemaCommand({ program }))

if (isDirectRun()) program.parse(process.argv)

export default program
