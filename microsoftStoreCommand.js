/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const { withJson, printJson, fail } = require('@monorepool/agentfirst/output.js')
const api = require('./request.js')
const { printInspect } = require('./formatOutput.js')

function microsoftStoreCommand() {
  const command = new commander.Command('microsoft-store')
  command.description('Microsoft Store queries')

  withJson(
    command
      .command('app <id>')
      .description(
        'fetch Microsoft Store app details (GET /api/microsoft-store/app)',
      )
      .option('--country <country>', 'country code'),
  ).action(async (id, options) => {
    try {
      const params = new URLSearchParams({ id })
      if (options.country) params.set('country', options.country)
      const app = await api.get(`/api/microsoft-store/app?${params}`)

      if (options.json) {
        printJson(app)
        return
      }

      printInspect(app)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('searches')
      .description('aggregated historical searches for an app')
      .requiredOption('--id <id>', 'app id')
      .option('--country <country>', 'country code'),
  ).action(async options => {
    try {
      const params = new URLSearchParams({ id: options.id })
      if (options.country) params.set('country', options.country)
      const results = await api.get(
        `/api/microsoft-store/app/searches?${params}`,
      )

      if (options.json) {
        printJson(results)
        return
      }

      printInspect(results)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = microsoftStoreCommand
