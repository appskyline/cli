/* Copyright 2013 - 2024 Waiterio LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import { printInspect } from './formatOutput.js'
import api from './request.js'

function rolesCommand() {
  const command = new commander.Command('roles')
  command.description('manage roles (GET/POST/DELETE /api/roles)')

  withJson(
    command
      .command('list')
      .description('list roles in the current organization'),
  ).action(async options => {
    try {
      const roles = await api.get('/api/roles')

      if (options.json) {
        printJson(roles)
        return
      }

      if (!roles || roles.length === 0) {
        console.log('No roles found')
        return
      }
      console.log(`Found ${roles.length} role(s):`)
      roles.forEach((role, index) => {
        console.log(
          `${index + 1}. ${role.type} — user ${role.userId} (role ${role._id})`,
        )
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description('assign a role to a user')
      .requiredOption('--userId <userId>', 'user id')
      .requiredOption('--type <type>', 'role type (e.g. admin)'),
  ).action(async options => {
    try {
      const role = await api.post('/api/roles', {
        userId: options.userId,
        type: options.type,
      })

      if (options.json) {
        printJson({ ok: true, id: role?._id })
        return
      }

      printInspect(role)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command.command('delete <roleId>').description('remove a role'),
  ).action(async (roleId, options) => {
    try {
      await api.del(`/api/roles?roleId=${roleId}`)

      if (options.json) {
        printJson({ ok: true, id: roleId })
        return
      }

      console.log(`deleted ${roleId}`)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default rolesCommand
