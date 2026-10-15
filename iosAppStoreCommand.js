/* Copyright 2013 - 2024 Waiterio LLC */
import fs from 'node:fs'
import path from 'node:path'

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import { printInspect } from './formatOutput.js'
import api from './request.js'

const FASTLANE_FILE_TO_FIELD = {
  'name.txt': 'name',
  'subtitle.txt': 'subtitle',
  'privacy_url.txt': 'privacyPolicyUrl',
  'description.txt': 'description',
  'keywords.txt': 'keywords',
  'release_notes.txt': 'whatsNew',
  'promotional_text.txt': 'promotionalText',
  'marketing_url.txt': 'marketingUrl',
  'support_url.txt': 'supportUrl',
}

function readFastlaneMetadata(baseDir) {
  // Accept either .../fastlane/ios  or  .../fastlane/ios/metadata
  let metadataDir = fs.existsSync(path.join(baseDir, 'metadata'))
    ? path.join(baseDir, 'metadata')
    : baseDir

  if (!fs.existsSync(metadataDir)) {
    throw new Error(`metadata directory not found: ${metadataDir}`)
  }

  let locales = {}
  let entries = fs.readdirSync(metadataDir, { withFileTypes: true })
  for (let entry of entries) {
    if (entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name)) {
      let localeDir = path.join(metadataDir, entry.name)
      let fields = {}
      for (let filename of fs.readdirSync(localeDir)) {
        let field = FASTLANE_FILE_TO_FIELD[filename]
        if (field) {
          let content = fs
            .readFileSync(path.join(localeDir, filename), 'utf8')
            .trim()
          if (content) fields[field] = content
        }
      }
      if (Object.keys(fields).length > 0) {
        locales[entry.name] = fields
      }
    }
  }

  return locales
}

function iosAppStoreCommand() {
  const command = new commander.Command('ios-app-store')
  command.description('iOS App Store queries')

  withJson(
    command
      .command('app <id>')
      .description(
        'fetch iOS App Store app details (GET /api/ios-app-store/app)',
      )
      .option('--country <country>', 'country code (e.g. US, IT)')
      .option('--lang <lang>', 'language code (e.g. en, it)'),
  ).action(async (id, options) => {
    try {
      const params = new URLSearchParams({ id })
      if (options.country) params.set('country', options.country)
      if (options.lang) params.set('lang', options.lang)
      const app = await api.get(`/api/ios-app-store/app?${params}`)

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
      .description(
        'aggregated historical searches for an app (GET /api/ios-app-store/app/searches)',
      )
      .requiredOption('--id <id>', 'app id (bundle id or numeric)')
      .option('--country <country>', 'country code'),
  ).action(async options => {
    try {
      const params = new URLSearchParams({ id: options.id })
      if (options.country) params.set('country', options.country)
      const results = await api.get(`/api/ios-app-store/app/searches?${params}`)

      if (options.json) {
        printJson(results)
        return
      }

      printInspect(results)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('diagnostics <appId>')
      .description(
        'production diagnostic signatures with stack traces — hangs, disk-writes, launches (GET /api/apps/:appId/apple-app-store/diagnostics). Note: crashes are NOT here (Apple does not expose production crash logs via the API); use `crashes` for TestFlight crash logs.',
      )
      .option('--type <type>', 'HANGS, DISK_WRITES, or LAUNCHES (default: all)')
      .option('--platform <platform>', 'IOS (default) or MAC_OS')
      .option('--builds <n>', 'number of recent builds to inspect', '1')
      .option(
        '--logs',
        'include stack traces (slower — one request per signature)',
      ),
  ).action(async (appId, options) => {
    try {
      const params = new URLSearchParams()
      if (options.type) params.set('type', options.type)
      if (options.platform) params.set('platform', options.platform)
      if (options.builds) params.set('buildLimit', options.builds)
      if (options.logs) params.set('logs', 'true')
      const result = await api.get(
        `/api/apps/${appId}/apple-app-store/diagnostics?${params}`,
      )

      if (options.json) {
        printJson(result)
        return
      }

      printInspect(result)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('crashes <appId>')
      .description(
        'TestFlight crash logs submitted by beta testers (GET /api/apps/:appId/apple-app-store/crashes). Production App Store crashes are not available via the API — only TestFlight builds.',
      )
      .option('--platform <platform>', 'IOS (default) or MAC_OS')
      .option('--limit <n>', 'max crash submissions to return', '50')
      .option('--log', 'include the full crash log text for each submission'),
  ).action(async (appId, options) => {
    try {
      const params = new URLSearchParams()
      if (options.platform) params.set('platform', options.platform)
      if (options.limit) params.set('limit', options.limit)
      if (options.log) params.set('log', 'true')
      const result = await api.get(
        `/api/apps/${appId}/apple-app-store/crashes?${params}`,
      )

      if (options.json) {
        printJson(result)
        return
      }

      printInspect(result)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  const metadata = command
    .command('metadata')
    .description(
      'App Store Connect metadata (works for iOS and macOS apps published via App Store Connect)',
    )

  withJson(
    metadata
      .command('list')
      .description(
        'list Mongo-cached App Store Connect metadata (GET /api/apple-app-store-metadata). ⚠ cache can be days stale — run `metadata download <appId>` first to refresh',
      )
      .option('--appId <appId>', 'filter by app id'),
  ).action(async options => {
    try {
      const params = new URLSearchParams()
      if (options.appId) params.set('appId', options.appId)
      const qs = params.toString() ? `?${params}` : ''
      const documents = await api.get(`/api/apple-app-store-metadata${qs}`)

      if (options.json) {
        printJson(documents)
        return
      }

      printInspect(documents)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    metadata
      .command('download <appId>')
      .description(
        'download metadata from App Store Connect for one app (POST /api/apps/:appId/apple-app-store/metadata/download)',
      ),
  ).action(async (appId, options) => {
    try {
      const result = await api.post(
        `/api/apps/${appId}/apple-app-store/metadata/download`,
      )

      if (options.json) {
        printJson({ ok: true, result })
        return
      }

      printInspect(result)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    metadata
      .command('upload <appId>')
      .description(
        'upload local fastlane-shaped metadata to App Store Connect (POST /api/apps/:appId/apple-app-store/metadata/upload). Reads <path>/metadata/{locale}/*.txt. Requires an editable appStoreVersion in App Store Connect for keywords/description/whatsNew/promotionalText/marketingUrl/supportUrl.',
      )
      .option(
        '--path <dir>',
        'fastlane ios/mac directory (containing metadata/)',
        process.cwd(),
      )
      .option('--locale <locale...>', 'only upload specified locale(s)')
      .option(
        '--platform <platform>',
        'target platform: IOS (default), MAC_OS, TV_OS, or VISION_OS',
        'IOS',
      )
      .option(
        '--skip-app-info',
        'skip appInfo-level fields (name, subtitle, privacyPolicyUrl). Use when the appInfo is tied to a published version and only the appStoreVersion draft is editable',
      )
      .option(
        '--only <field...>',
        'only upload specified field(s) per locale (e.g. --only keywords)',
      )
      .option('--dry-run', "print what would be sent, don't POST"),
  ).action(async (appId, options) => {
    try {
      let locales = readFastlaneMetadata(options.path)

      if (options.locale?.length) {
        let allowed = new Set(options.locale)
        locales = Object.fromEntries(
          Object.entries(locales).filter(([locale]) => allowed.has(locale)),
        )
      }

      let appInfoFields = new Set(['name', 'subtitle', 'privacyPolicyUrl'])
      let onlyFields = options.only?.length ? new Set(options.only) : null

      locales = Object.fromEntries(
        Object.entries(locales).map(([locale, fields]) => {
          let filtered = Object.fromEntries(
            Object.entries(fields).filter(([field]) => {
              if (options.skipAppInfo && appInfoFields.has(field)) return false
              if (onlyFields && !onlyFields.has(field)) return false
              return true
            }),
          )
          return [locale, filtered]
        }),
      )

      locales = Object.fromEntries(
        Object.entries(locales).filter(
          ([, fields]) => Object.keys(fields).length > 0,
        ),
      )

      if (Object.keys(locales).length === 0) {
        fail(new Error('no locales with recognized metadata files found'), {
          json: options.json,
        })
        return
      }

      if (options.dryRun) {
        if (options.json) {
          printJson({ ok: true, dryRun: true, locales })
          return
        }

        console.log('would POST the following locales:')
        printInspect(locales)
        return
      }

      let result = await api.post(
        `/api/apps/${appId}/apple-app-store/metadata/upload`,
        { locales, platform: options.platform },
      )

      if (options.json) {
        printJson({ ok: true, result })
        return
      }

      printInspect(result)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

export default iosAppStoreCommand
