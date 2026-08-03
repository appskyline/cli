/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')
const { printJson } = require('./formatOutput.js')

function macosAppStoreCommand() {
  const command = new commander.Command('macos-app-store')
  command.description('macOS App Store queries')

  command
    .command('app <id>')
    .description(
      'fetch macOS App Store app details (GET /api/macos-app-store/app)',
    )
    .option('--country <country>', 'country code (e.g. US, IT)')
    .option('--lang <lang>', 'language code (e.g. en, it)')
    .action(async (id, options) => {
      try {
        const params = new URLSearchParams({ id })
        if (options.country) params.set('country', options.country)
        if (options.lang) params.set('lang', options.lang)
        const app = await api.get(`/api/macos-app-store/app?${params}`)
        printJson(app)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('searches')
    .description(
      'aggregated historical searches for an app (GET /api/macos-app-store/app/searches)',
    )
    .requiredOption('--id <id>', 'app id (numeric Apple id)')
    .option('--country <country>', 'country code')
    .action(async options => {
      try {
        const params = new URLSearchParams({ id: options.id })
        if (options.country) params.set('country', options.country)
        const results = await api.get(
          `/api/macos-app-store/app/searches?${params}`,
        )
        printJson(results)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = macosAppStoreCommand
