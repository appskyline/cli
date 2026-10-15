/* Copyright 2013 - 2024 Waiterio LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import { printInspect } from './formatOutput.js'
import api from './request.js'

function zapierHooksCommand() {
  const command = new commander.Command('zapier-hooks')
  command.description('manage zapier webhooks (POST/DELETE /api/zapier/hooks)')

  withJson(
    command
      .command('add')
      .description('register a zapier webhook')
      .requiredOption('--url <url>', 'target webhook URL')
      .option('--event <event>', 'event to subscribe to (e.g. KEYWORD_ADDED)'),
  ).action(async options => {
    try {
      const hook = await api.post('/api/zapier/hooks', {
        url: options.url,
        event: options.event,
      })

      if (options.json) {
        printJson({ ok: true, id: hook?._id })
        return
      }

      printInspect(hook)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command.command('delete <hookId>').description('remove a zapier webhook'),
  ).action(async (hookId, options) => {
    try {
      await api.del(`/api/zapier/hooks?zapierHookId=${hookId}`)

      if (options.json) {
        printJson({ ok: true, id: hookId })
        return
      }

      console.log(`deleted ${hookId}`)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default zapierHooksCommand
