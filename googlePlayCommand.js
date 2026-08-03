/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')
const { printJson } = require('./formatOutput.js')

function googlePlayCommand() {
  const command = new commander.Command('google-play')
  command.description('Google Play Store queries')

  command
    .command('app <appId>')
    .description(
      'fetch Google Play app details (GET /api/google-play/apps/:appId)',
    )
    .option('--country <country>', 'country code (e.g. US, IT)')
    .option('--lang <lang>', 'language code (e.g. en, it)')
    .action(async (appId, options) => {
      try {
        const params = new URLSearchParams()
        if (options.country) params.set('country', options.country)
        if (options.lang) params.set('lang', options.lang)
        const qs = params.toString() ? `?${params}` : ''
        const app = await api.get(`/api/google-play/apps/${appId}${qs}`)
        printJson(app)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('reviews <appId>')
    .description(
      'list user reviews for the given app via the Google Play Developer API ' +
        '(GET /api/apps/:appId/google-play/reviews) — requires a configured service account',
    )
    .option('--max <n>', 'maximum reviews per page (default 100, max 100)')
    .option(
      '--token <token>',
      'pagination token from a previous response.tokenPagination.nextPageToken',
    )
    .option(
      '--translation-language <lang>',
      'translate review text into this language (e.g. en, it)',
    )
    .option('--start-index <n>', 'start index for pagination')
    .action(async (appId, options) => {
      try {
        const params = new URLSearchParams()
        if (options.max) params.set('maxResults', options.max)
        if (options.token) params.set('token', options.token)
        if (options.translationLanguage) params.set('translationLanguage', options.translationLanguage)
        if (options.startIndex) params.set('startIndex', options.startIndex)
        const qs = params.toString() ? `?${params}` : ''
        const result = await api.get(
          `/api/apps/${appId}/google-play/reviews${qs}`,
        )
        printJson(result)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('installs <appId>')
    .description(
      'fetch monthly installs/uninstalls bulk report from Google Play (Cloud Storage) ' +
        '(GET /api/apps/:appId/google-play/reports/installs) — requires a service account ' +
        'with Storage Object Viewer on pubsite_prod_<developerAccountId>',
    )
    .option(
      '--month <YYYYMM>',
      'year+month of the report (default: current UTC month)',
    )
    .option(
      '--dimension <dimension>',
      'overview | country | device | app_version | carrier | language | os_version (default: overview)',
    )
    .option(
      '--developer-account-id <id>',
      'numeric developer account ID — overrides the value saved on the service account; ' +
        'find it in the Play Console URL: play.google.com/console/u/0/developers/<id>/...',
    )
    .action(async (appId, options) => {
      try {
        const params = new URLSearchParams()
        if (options.month) params.set('yearMonth', options.month)
        if (options.dimension) params.set('dimension', options.dimension)
        if (options.developerAccountId) params.set('developerAccountId', options.developerAccountId)
        const qs = params.toString() ? `?${params}` : ''
        const result = await api.get(
          `/api/apps/${appId}/google-play/reports/installs${qs}`,
        )
        printJson(result)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = googlePlayCommand
