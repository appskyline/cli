#!/usr/bin/env node
/* Copyright 2013 - 2024 Waiterio LLC */
const program = require('commander')
const loginCommand = require('@monorepool/agentfirst/loginCommand.js')
const logoutCommand = require('@monorepool/agentfirst/logoutCommand.js')
const schemaCommand = require('@monorepool/agentfirst/schemaCommand.js')
const skillsCommand = require('@monorepool/agentfirst/skillsCommand.js')
const api = require('./request.js')
const session = require('./session.js')
const appsCommand = require('./appsCommand.js')
const googlePlayCommand = require('./googlePlayCommand.js')
const invitesCommand = require('./invitesCommand.js')
const iosAppStoreCommand = require('./iosAppStoreCommand.js')
const keywordsCommand = require('./keywordsCommand.js')
const macosAppStoreCommand = require('./macosAppStoreCommand.js')
const microsoftStoreCommand = require('./microsoftStoreCommand.js')
const rankCommand = require('./rankCommand.js')
const rolesCommand = require('./rolesCommand.js')
const searchCommand = require('./searchCommand.js')
const usersCommand = require('./usersCommand.js')
const zapierHooksCommand = require('./zapierHooksCommand.js')
const packageJson = require('./package.json')

const BINARY_NAME = 'appskyline'
const APP_URL = 'https://app.appskyline.com'
const ENV_KEY_NAME = 'APPSKYLINE_API_KEY'

program
  .name(BINARY_NAME)
  .description(
    'appskyline cli — manage apps, keywords, and check app store rankings',
  )
  .version(packageJson.version)
  .addCommand(
    loginCommand({
      binaryName: BINARY_NAME,
      appUrl: APP_URL,
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
  .addCommand(skillsCommand({ baseDirectory: __dirname }))
  .addCommand(schemaCommand({ program }))
  .parse(process.argv)
