/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')
const { printJson } = require('./formatOutput.js')

function zapierHooksCommand() {
  const command = new commander.Command('zapier-hooks')
  command.description('manage zapier webhooks (POST/DELETE /api/zapier/hooks)')

  command
    .command('add')
    .description('register a zapier webhook')
    .requiredOption('--url <url>', 'target webhook URL')
    .option('--event <event>', 'event to subscribe to (e.g. KEYWORD_ADDED)')
    .action(async options => {
      try {
        const hook = await api.post('/api/zapier/hooks', {
          url: options.url,
          event: options.event,
        })
        printJson(hook)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('delete <hookId>')
    .description('remove a zapier webhook')
    .action(async hookId => {
      try {
        await api.del(`/api/zapier/hooks?zapierHookId=${hookId}`)
        console.log(`deleted ${hookId}`)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = zapierHooksCommand
