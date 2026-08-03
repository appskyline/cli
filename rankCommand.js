/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')

const STORE_PATHS = {
  'ios-app-store': '/api/ios-app-store/search',
  'macos-app-store': '/api/macos-app-store/search',
  'google-play': '/api/google-play/search',
  'microsoft-store': '/api/microsoft-store/search',
}

// Apps returned by the Apple / Google / Microsoft search endpoints carry
// their identifier in different fields. `matchesApp` accepts any of them.
function matchesApp(result, targetAppId) {
  const targetLower = String(targetAppId).toLowerCase()
  const candidates = [
    result.id,
    result.appId,
    result.bundleId,
    result.bundle_id,
    result.packageName,
    result.productId,
  ]
  return candidates
    .filter(Boolean)
    .map(c => String(c).toLowerCase())
    .includes(targetLower)
}

function rankCommand() {
  const command = new commander.Command('rank')
  command
    .description(
      'find where <appId> ranks in an app-store search for <term> (composes /search + position lookup)',
    )
    .argument('<appId>', 'your app id / bundle id / package name')
    .requiredOption(
      '--store <store>',
      'ios-app-store | macos-app-store | google-play | microsoft-store',
    )
    .requiredOption('--term <term>', 'search term')
    .option('--country <country>', 'country code (e.g. US, IT)')
    .option('--lang <lang>', 'language code (e.g. en, it)')
    .option('-n, --num <num>', 'how deep to search', '25')
    .action(async (appId, options) => {
      try {
        const searchPath = STORE_PATHS[options.store]
        if (!searchPath) {
          console.error(
            `--store must be one of: ${Object.keys(STORE_PATHS).join(', ')}`,
          )
          process.exitCode = 1
          return
        }

        const params = new URLSearchParams({
          term: options.term,
          num: options.num,
        })
        if (options.country) params.set('country', options.country)
        if (options.lang) params.set('lang', options.lang)

        const results = await api.get(`${searchPath}?${params}`)

        if (!results || results.length === 0) {
          console.log(`No results for "${options.term}"`)
          return
        }

        const position = results.findIndex(r => matchesApp(r, appId))

        if (position === -1) {
          console.log(
            `${appId} is not in the top ${results.length} results for "${options.term}" on ${options.store}${
              options.country ? ` (${options.country})` : ''
            }`,
          )
          return
        }

        const winner = results[position]
        const title = winner.title || winner.name || appId
        console.log(
          `✓ ${appId} ranks #${position + 1} of ${results.length} for "${options.term}" on ${options.store}${
            options.country ? ` (${options.country})` : ''
          }  (${title})`,
        )
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = rankCommand
