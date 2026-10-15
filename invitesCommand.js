/* Copyright 2013 - 2024 Waiterio LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import { printInspect } from './formatOutput.js'
import api from './request.js'

function invitesCommand() {
  const command = new commander.Command('invites')
  command.description('manage invites (GET/POST /api/invites)')

  withJson(
    command
      .command('list')
      .description('list pending invites in the current organization'),
  ).action(async options => {
    try {
      const invites = await api.get('/api/invites')

      if (options.json) {
        printJson(invites)
        return
      }

      if (!invites || invites.length === 0) {
        console.log('No pending invites')
        return
      }
      console.log(`Found ${invites.length} invite(s):`)
      invites.forEach((invite, index) => {
        console.log(
          `${index + 1}. ${invite.email} [${invite.roleType || '?'}]  ${invite._id}`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description('invite a user by email')
      .requiredOption('--email <email>', 'email address to invite')
      .option('--type <type>', 'role type (e.g. admin)', 'admin')
      .option('--locale <locale>', 'preferred locale (e.g. en)'),
  ).action(async options => {
    try {
      const invite = await api.post('/api/invites', {
        email: options.email,
        roleType: options.type,
        localeMotherTongue: options.locale,
      })

      if (options.json) {
        printJson({ ok: true, id: invite?._id })
        return
      }

      printInspect(invite)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command.command('delete <inviteId>').description('revoke an invite'),
  ).action(async (inviteId, options) => {
    try {
      await api.del(`/api/invites/${inviteId}`)

      if (options.json) {
        printJson({ ok: true, id: inviteId })
        return
      }

      console.log(`deleted ${inviteId}`)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default invitesCommand
