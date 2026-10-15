/* Copyright 2013 - 2026 Waiterio LLC */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expectConsoleError } from '@monorepool/root/vitest.strict.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import googlePlayCommand from '../googlePlayCommand.js'
import iosAppStoreCommand from '../iosAppStoreCommand.js'
import macosAppStoreCommand from '../macosAppStoreCommand.js'
import microsoftStoreCommand from '../microsoftStoreCommand.js'
import rankCommand from '../rankCommand.js'
import searchCommand from '../searchCommand.js'
import { captureOutput, readJson, run } from './testHarness.js'

const api = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('../request.js', () => ({ default: api }))

let output
let temporaryDirectory

function clearOutput() {
  output.errors.length = 0
  output.logs.length = 0
  output.stderr.length = 0
  output.stdout.length = 0
}

beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset())
  output = captureOutput()
  process.exitCode = 0
  temporaryDirectory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'appskyline-cli-stores-')),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = 0
  fs.rmSync(temporaryDirectory, { force: true, recursive: true })
})

describe('cross-store search', () => {
  const cases = [
    ['ios-app-store', '/api/ios-app-store/search'],
    ['macos-app-store', '/api/macos-app-store/search'],
    ['google-play', '/api/google-play/search'],
    ['microsoft-store', '/api/microsoft-store/search'],
  ]

  it.each(cases)('builds the documented %s query', async (store, endpoint) => {
    api.get.mockResolvedValueOnce([{ id: 'result-1', title: 'Cafe POS' }])

    await run(searchCommand(), [
      store,
      '--term',
      'restaurant pos',
      '--country',
      'US',
      '--lang',
      'en',
      '--num',
      '25',
      '--json',
    ])

    expect(api.get).toHaveBeenCalledWith(
      `${endpoint}?term=restaurant+pos&num=25&country=US&lang=en`,
    )
    expect(readJson(output)).toEqual([{ id: 'result-1', title: 'Cafe POS' }])
  })

  it('formats heterogeneous store results and handles an empty search', async () => {
    api.get.mockResolvedValueOnce([
      {
        id: '123',
        title: 'Cafe POS',
        score: 4.56,
        developer: 'Example LLC',
      },
      { appId: 'com.example.pos', name: 'Example POS' },
      { bundleId: 'com.example.untitled' },
      {},
    ])
    await run(searchCommand(), ['google-play', '--term', 'pos'])

    const rendered = output.logs.join('\n')
    expect(rendered).toContain('Cafe POS ★4.6 — Example LLC  (123)')
    expect(rendered).toContain('Example POS  (com.example.pos)')
    expect(rendered).toContain('—  (com.example.untitled)')

    api.get.mockResolvedValueOnce([])
    await run(searchCommand(), ['ios-app-store', '--term', 'nothing'])
    expect(output.logs).toContain('No results')
  })
})

describe('ranking workflow', () => {
  it('finds an app case-insensitively across store-specific id fields', async () => {
    api.get.mockResolvedValueOnce([
      { id: 'other', title: 'Other' },
      {
        packageName: 'COM.EXAMPLE.CAFE',
        title: 'Cafe POS',
      },
      { bundle_id: 'third' },
    ])

    await run(rankCommand(), [
      'com.example.cafe',
      '--store',
      'google-play',
      '--term',
      'restaurant pos',
      '--country',
      'US',
      '--lang',
      'en',
      '--num',
      '50',
    ])

    expect(api.get).toHaveBeenCalledWith(
      '/api/google-play/search?term=restaurant+pos&num=50&country=US&lang=en',
    )
    expect(output.logs).toContain(
      '✓ com.example.cafe ranks #2 of 3 for "restaurant pos" on google-play (US)  (Cafe POS)',
    )
  })

  it('returns structured not-found data without pretending rank zero exists', async () => {
    api.get.mockResolvedValueOnce([
      { bundleId: 'com.example.other', name: 'Other' },
    ])
    await run(rankCommand(), [
      'com.example.missing',
      '--store',
      'ios-app-store',
      '--term',
      'invoice',
      '--json',
    ])

    expect(readJson(output)).toEqual({
      app: null,
      appId: 'com.example.missing',
      position: null,
      scanned: 1,
      store: 'ios-app-store',
      term: 'invoice',
    })
  })

  it('explains empty, below-the-fold, and invalid-store outcomes', async () => {
    api.get.mockResolvedValueOnce(null)
    await run(rankCommand(), [
      'app-1',
      '--store',
      'microsoft-store',
      '--term',
      'unknown',
    ])
    expect(output.logs).toContain('No results for "unknown"')

    api.get.mockResolvedValueOnce([{ productId: 'another-app' }])
    await run(rankCommand(), [
      'app-1',
      '--store',
      'microsoft-store',
      '--term',
      'pos',
      '--country',
      'IT',
    ])
    expect(output.logs.join('\n')).toContain(
      'app-1 is not in the top 1 results for "pos" on microsoft-store (IT)',
    )

    await run(rankCommand(), [
      'app-1',
      '--store',
      'not-a-store',
      '--term',
      'pos',
      '--json',
    ])
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(JSON.parse(output.stderr.at(-1)).error.message).toContain(
      '--store must be one of:',
    )
  })
})

describe('iOS App Store and App Store Connect workflows', () => {
  it('builds listing, searches, diagnostics, crashes, cache, and download requests', async () => {
    api.get.mockResolvedValue({ ok: 'get' })
    api.post.mockResolvedValue({ ok: 'post' })

    await run(iosAppStoreCommand(), [
      'app',
      '123456',
      '--country',
      'US',
      '--lang',
      'en',
      '--json',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/ios-app-store/app?id=123456&country=US&lang=en',
    )
    expect(readJson(output)).toEqual({ ok: 'get' })

    clearOutput()
    await run(iosAppStoreCommand(), [
      'searches',
      '--id',
      'com.example.cafe',
      '--country',
      'IT',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/ios-app-store/app/searches?id=com.example.cafe&country=IT',
    )
    expect(output.logs.join('\n')).toContain('get')

    clearOutput()
    await run(iosAppStoreCommand(), [
      'diagnostics',
      'app-1',
      '--type',
      'HANGS',
      '--platform',
      'IOS',
      '--builds',
      '3',
      '--logs',
      '--json',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/apps/app-1/apple-app-store/diagnostics?type=HANGS&platform=IOS&buildLimit=3&logs=true',
    )

    clearOutput()
    await run(iosAppStoreCommand(), [
      'crashes',
      'app-1',
      '--platform',
      'MAC_OS',
      '--limit',
      '12',
      '--log',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/apps/app-1/apple-app-store/crashes?platform=MAC_OS&limit=12&log=true',
    )

    clearOutput()
    await run(iosAppStoreCommand(), [
      'metadata',
      'list',
      '--appId',
      'app-1',
      '--json',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/apple-app-store-metadata?appId=app-1',
    )

    clearOutput()
    await run(iosAppStoreCommand(), ['metadata', 'download', 'app-1'])
    expect(api.post).toHaveBeenLastCalledWith(
      '/api/apps/app-1/apple-app-store/metadata/download',
    )
    expect(output.logs.join('\n')).toContain('post')
  })

  it('uses safe Apple endpoint defaults when optional filters are omitted', async () => {
    api.get.mockResolvedValue({ result: 'default' })

    await run(iosAppStoreCommand(), ['app', '123456'])
    expect(api.get).toHaveBeenLastCalledWith('/api/ios-app-store/app?id=123456')

    clearOutput()
    await run(iosAppStoreCommand(), ['diagnostics', 'app-1'])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/apps/app-1/apple-app-store/diagnostics?buildLimit=1',
    )

    clearOutput()
    await run(iosAppStoreCommand(), ['crashes', 'app-1', '--json'])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/apps/app-1/apple-app-store/crashes?limit=50',
    )
    expect(readJson(output)).toEqual({ result: 'default' })
  })

  it('reads fastlane metadata, selects locales/fields, and supports a safe dry run', async () => {
    const fastlaneDirectory = path.join(temporaryDirectory, 'fastlane', 'ios')
    const metadataDirectory = path.join(fastlaneDirectory, 'metadata')
    for (const locale of ['en-US', 'it', 'invalid_locale']) {
      fs.mkdirSync(path.join(metadataDirectory, locale), { recursive: true })
    }
    fs.writeFileSync(
      path.join(metadataDirectory, 'en-US', 'name.txt'),
      'Cafe POS\n',
    )
    fs.writeFileSync(
      path.join(metadataDirectory, 'en-US', 'description.txt'),
      'Run your restaurant.\n',
    )
    fs.writeFileSync(
      path.join(metadataDirectory, 'en-US', 'keywords.txt'),
      'restaurant,pos\n',
    )
    fs.writeFileSync(path.join(metadataDirectory, 'en-US', 'subtitle.txt'), ' ')
    fs.writeFileSync(path.join(metadataDirectory, 'en-US', 'ignored.txt'), 'x')
    fs.writeFileSync(
      path.join(metadataDirectory, 'it', 'description.txt'),
      'Gestisci il ristorante.\n',
    )

    await run(iosAppStoreCommand(), [
      'metadata',
      'upload',
      'app-1',
      '--path',
      fastlaneDirectory,
      '--locale',
      'en-US',
      '--skip-app-info',
      '--only',
      'keywords',
      'description',
      '--dry-run',
      '--json',
    ])

    expect(api.post).not.toHaveBeenCalled()
    expect(readJson(output)).toEqual({
      dryRun: true,
      locales: {
        'en-US': {
          description: 'Run your restaurant.',
          keywords: 'restaurant,pos',
        },
      },
      ok: true,
    })
  })

  it('uploads a direct metadata directory with platform intact', async () => {
    const metadataDirectory = path.join(temporaryDirectory, 'metadata-only')
    fs.mkdirSync(path.join(metadataDirectory, 'it'), { recursive: true })
    fs.writeFileSync(
      path.join(metadataDirectory, 'it', 'name.txt'),
      'Cassa Cafe',
    )
    fs.writeFileSync(
      path.join(metadataDirectory, 'it', 'support_url.txt'),
      'https://example.com/support',
    )
    api.post.mockResolvedValueOnce({ uploaded: ['it'] })

    await run(iosAppStoreCommand(), [
      'metadata',
      'upload',
      'app-1',
      '--path',
      metadataDirectory,
      '--platform',
      'MAC_OS',
    ])

    expect(api.post).toHaveBeenCalledWith(
      '/api/apps/app-1/apple-app-store/metadata/upload',
      {
        locales: {
          it: {
            name: 'Cassa Cafe',
            supportUrl: 'https://example.com/support',
          },
        },
        platform: 'MAC_OS',
      },
    )
    expect(output.logs.join('\n')).toContain('uploaded')
  })

  it('fails safely when metadata is missing or filters remove every field', async () => {
    const emptyDirectory = path.join(temporaryDirectory, 'empty')
    const missingDirectory = path.join(temporaryDirectory, 'missing')
    fs.mkdirSync(path.join(emptyDirectory, 'en'), { recursive: true })
    fs.writeFileSync(path.join(emptyDirectory, 'en', 'name.txt'), 'Cafe POS')

    await run(iosAppStoreCommand(), [
      'metadata',
      'upload',
      'app-1',
      '--path',
      emptyDirectory,
      '--skip-app-info',
      '--json',
    ])
    expect(JSON.parse(output.stderr.at(-1)).error.message).toContain(
      'no locales with recognized metadata files found',
    )

    expectConsoleError(
      `error metadata directory not found: ${missingDirectory}`,
    )
    await run(iosAppStoreCommand(), [
      'metadata',
      'upload',
      'app-1',
      '--path',
      missingDirectory,
    ])
    expect(output.errors.at(-1)).toContain('metadata directory not found')
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('Google Play workflows', () => {
  it('fetches an app with optional locale parameters and without them', async () => {
    api.get.mockResolvedValueOnce({ title: 'Cafe POS' })
    await run(googlePlayCommand(), [
      'app',
      'com.example.cafe',
      '--country',
      'US',
      '--lang',
      'en',
      '--json',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/google-play/apps/com.example.cafe?country=US&lang=en',
    )

    api.get.mockResolvedValueOnce({ title: 'Cafe POS' })
    await run(googlePlayCommand(), ['app', 'com.example.cafe'])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/google-play/apps/com.example.cafe',
    )
    expect(output.logs.join('\n')).toContain('Cafe POS')
  })

  it('preserves every Google reviews pagination and translation option', async () => {
    api.get.mockResolvedValueOnce({ reviews: [], token: 'next' })
    await run(googlePlayCommand(), [
      'reviews',
      'app-1',
      '--max',
      '50',
      '--token',
      'next token',
      '--translation-language',
      'it',
      '--start-index',
      '100',
      '--json',
    ])
    expect(api.get).toHaveBeenCalledWith(
      '/api/apps/app-1/google-play/reviews?maxResults=50&token=next+token&translationLanguage=it&startIndex=100',
    )
    expect(readJson(output)).toEqual({ reviews: [], token: 'next' })
  })

  it('uses the server defaults when review options are omitted', async () => {
    api.get.mockResolvedValueOnce({ reviews: [{ reviewId: 'review-1' }] })

    await run(googlePlayCommand(), ['reviews', 'app-1'])

    expect(api.get).toHaveBeenCalledWith('/api/apps/app-1/google-play/reviews')
    expect(output.logs.join('\n')).toContain('review-1')
  })

  it('builds installs report queries, including developer account overrides', async () => {
    api.get.mockResolvedValueOnce({ rows: [{ country: 'US', installs: 42 }] })
    await run(googlePlayCommand(), [
      'installs',
      'app-1',
      '--month',
      '202607',
      '--dimension',
      'country',
      '--developer-account-id',
      '123456789',
    ])
    expect(api.get).toHaveBeenCalledWith(
      '/api/apps/app-1/google-play/reports/installs?yearMonth=202607&dimension=country&developerAccountId=123456789',
    )
    expect(output.logs.join('\n')).toContain('installs')
  })

  it('lets the API choose the current installs report defaults', async () => {
    api.get.mockResolvedValueOnce({ rows: [] })

    await run(googlePlayCommand(), ['installs', 'app-1', '--json'])

    expect(api.get).toHaveBeenCalledWith(
      '/api/apps/app-1/google-play/reports/installs',
    )
    expect(readJson(output)).toEqual({ rows: [] })
  })
})

describe('macOS and Microsoft Store workflows', () => {
  it('constructs both macOS listing and historical-search requests', async () => {
    api.get.mockResolvedValue({ result: 'mac' })
    await run(macosAppStoreCommand(), [
      'app',
      '123',
      '--country',
      'US',
      '--lang',
      'en',
      '--json',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/macos-app-store/app?id=123&country=US&lang=en',
    )

    clearOutput()
    await run(macosAppStoreCommand(), [
      'searches',
      '--id',
      '123',
      '--country',
      'IT',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/macos-app-store/app/searches?id=123&country=IT',
    )
    expect(output.logs.join('\n')).toContain('mac')
  })

  it('omits optional macOS query parameters without leaving malformed separators', async () => {
    api.get.mockResolvedValue({ result: 'mac-defaults' })

    await run(macosAppStoreCommand(), ['app', '123'])
    expect(api.get).toHaveBeenLastCalledWith('/api/macos-app-store/app?id=123')
    expect(output.logs.join('\n')).toContain('mac-defaults')

    clearOutput()
    await run(macosAppStoreCommand(), ['searches', '--id', '123', '--json'])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/macos-app-store/app/searches?id=123',
    )
    expect(readJson(output)).toEqual({ result: 'mac-defaults' })
  })

  it('constructs both Microsoft listing and historical-search requests', async () => {
    api.get.mockResolvedValue({ result: 'windows' })
    await run(microsoftStoreCommand(), [
      'app',
      '9NCAFE',
      '--country',
      'US',
      '--json',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/microsoft-store/app?id=9NCAFE&country=US',
    )

    clearOutput()
    await run(microsoftStoreCommand(), [
      'searches',
      '--id',
      '9NCAFE',
      '--country',
      'ES',
    ])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/microsoft-store/app/searches?id=9NCAFE&country=ES',
    )
    expect(output.logs.join('\n')).toContain('windows')
  })

  it('omits optional Microsoft country filters cleanly', async () => {
    api.get.mockResolvedValue({ result: 'windows-defaults' })

    await run(microsoftStoreCommand(), ['app', '9NCAFE'])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/microsoft-store/app?id=9NCAFE',
    )

    clearOutput()
    await run(microsoftStoreCommand(), ['searches', '--id', '9NCAFE', '--json'])
    expect(api.get).toHaveBeenLastCalledWith(
      '/api/microsoft-store/app/searches?id=9NCAFE',
    )
    expect(readJson(output)).toEqual({ result: 'windows-defaults' })
  })
})
