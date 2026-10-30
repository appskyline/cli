/* Copyright 2013 - 2026 Waiterio LLC */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import command from '../metadataCommand.js'
import { captureOutput, readJson, run } from './testHarness.js'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../request.js', () => ({ default: mocks }))

let output

const appStore = {
  appId: 'mus',
  appName: 'Mus Village',
  store: 'ios-app-store',
  status: 'ok',
  market: { country: 'ES', language: 'es' },
  source: { kind: 'public', locale: 'es-ES' },
  fields: {
    title: { value: 'Mus Online Village: Órdago', length: 26, limit: 30 },
    subtitle: { value: 'Baraja española con señas', length: 25, limit: 30 },
    keywords: { value: null, available: false, limit: 100 },
  },
  coverage: { tracked: 3, covered: 1 },
  keywords: [
    {
      term: 'cartas españolas',
      coverage: 'missing',
      missingWords: ['cartas', 'españolas'],
      rank: { position: null, scanned: 10 },
      demand: { searchVolume: 1600 },
      priority: 71,
    },
    {
      term: 'juego de mus',
      coverage: 'partial',
      missingWords: ['juego'],
      rank: { position: 15, scanned: 50 },
      demand: { searchVolume: 0 },
      priority: 45,
    },
    {
      term: 'mus con amigos',
      coverage: 'combined',
      missingWords: [],
      rank: null,
      demand: null,
      priority: 20,
    },
    {
      term: 'mus',
      coverage: 'title',
      missingWords: [],
      rank: { position: 2, scanned: 10 },
      demand: null,
      priority: 0,
    },
  ],
  issues: [
    { code: 'keyword-field-unknown', message: 'The keyword field is private.' },
  ],
  suggestions: {
    title: {
      value: 'Mus Online Village: Órdago',
      length: 26,
      limit: 30,
      changed: false,
    },
    subtitle: {
      value: 'Baraja española con amigos',
      length: 26,
      limit: 30,
      changed: true,
    },
    keywords: {
      value: 'cartas,españolas,juego',
      length: 22,
      limit: 100,
      dropped: ['señas'],
    },
    coverage: { tracked: 3, covered: 3 },
  },
  competitorWords: [{ word: 'escoba' }, { word: 'brisca' }],
}

const googlePlay = {
  ...appStore,
  store: 'google-play',
  fields: {
    title: { value: 'Mus Online Village: Órdago', length: 26, limit: 30 },
    shortDescription: {
      value: 'Mus online por parejas.',
      length: 23,
      limit: 80,
    },
    description: { length: 400, limit: 4000 },
  },
  keywords: [],
  issues: [],
  competitorWords: [],
  suggestions: {
    title: {
      value: 'Mus Village: Juego de mus',
      length: 25,
      limit: 30,
      changed: true,
    },
    shortDescription: { include: ['baraja española', 'juego de mus'] },
    description: { mention: ['cartas españolas'] },
    coverage: { tracked: 3, covered: 3 },
  },
}

const microsoftStore = {
  ...googlePlay,
  store: 'microsoft-store',
  source: { kind: 'synced', locale: null },
  fields: {
    title: { value: 'Mus Village', length: 11, limit: 256 },
    keywords: { terms: ['mus', 'cartas'], limit: 7 },
  },
  suggestions: {
    title: { value: 'Mus Village', changed: false },
    keywords: { terms: ['mus online', 'cartas'], changed: true },
    description: { mention: [] },
    coverage: { tracked: 3, covered: 2 },
  },
}

const page = (results, overrides = {}) => ({
  schemaVersion: 1,
  scope: 'organization',
  totalApps: 2,
  truncated: false,
  complete: true,
  results,
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  output = captureOutput()
  process.exitCode = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = 0
})

it('prints the raw suggestions for automation with --json', async () => {
  mocks.get.mockResolvedValue(page([appStore]))
  await run(command(), ['suggest', '--json'])
  expect(mocks.get).toHaveBeenCalledWith('/api/metadatasuggestions?')
  expect(readJson(output)).toMatchObject({ results: [{ appId: 'mus' }] })
  expect(process.exitCode).toBe(0)
})

it('encodes the selectors, demand refresh and proposed wording', async () => {
  mocks.get.mockResolvedValue(page([], { scope: 'app' }))
  await run(command(), [
    'suggest',
    'mus',
    '--store',
    'ios-app-store',
    '--country',
    'ES',
    '--language',
    'es',
    '--refresh-demand',
    '--title',
    'Mus Village: Juego & Cartas',
    '--subtitle',
    'Baraja española',
    '--keywords',
    'cartas,españolas',
    '--short-description',
    'Mus online.',
    '--json',
  ])
  expect(mocks.get).toHaveBeenCalledWith(
    '/api/metadatasuggestions?appId=mus&store=ios-app-store&country=ES&language=es&demand=refresh&title=Mus+Village%3A+Juego+%26+Cartas&subtitle=Baraja+espa%C3%B1ola&keywords=cartas%2Cespa%C3%B1olas&shortDescription=Mus+online.',
  )
})

it('shows each listing, the drafts and why, for people', async () => {
  mocks.get.mockResolvedValue(
    page([
      appStore,
      googlePlay,
      microsoftStore,
      {
        appId: 'blank',
        appName: null,
        store: null,
        status: 'store-not-configured',
      },
    ]),
  )
  await run(command(), ['suggest'])
  const printed = output.logs.join('\n')

  expect(printed).toContain(
    'Metadata suggestions: 4 listing(s) across 2 app(s)',
  )
  expect(printed).toContain('Mus Village · ios-app-store · ES/es')
  expect(printed).toContain('public listing es-ES')
  expect(printed).toContain(
    'Tracked keywords covered: 1/3 now, 3/3 with these changes',
  )
  expect(printed).toContain(
    'Title             Mus Online Village: Órdago (26/30)',
  )
  expect(printed).toMatch(/→ keep/u)
  expect(printed).toContain('→ Baraja española con amigos (26/30)')
  expect(printed).toContain(
    'Keyword field     private to the store; connect the store account to check it',
  )
  expect(printed).toContain('→ cartas,españolas,juego (22/100)')
  expect(printed).toContain('no room for: señas')
  expect(printed).toContain(
    'cartas españolas — missing (missing: cartas, españolas); not in the top 10; 1,600 Google searches/month',
  )
  expect(printed).toContain(
    'juego de mus — partial (missing: juego); #15 of 50; no measured demand',
  )
  expect(printed).toContain(
    'mus con amigos — combined; no stored rank; demand unknown',
  )
  expect(printed).not.toContain('    mus — title')
  expect(printed).toContain('! The keyword field is private.')
  expect(printed).toContain(
    'Words competitors use (keep only those that describe your app, never a brand): escoba, brisca',
  )
  expect(printed).toContain('→ Mus Village: Juego de mus (25/30)')
  expect(printed).toContain('→ work in: baraja española, juego de mus')
  expect(printed).toContain('Description       mention: cartas españolas')
  expect(printed).toContain('Search terms      mus · cartas')
  expect(printed).toContain('→ mus online · cartas')
  expect(printed).toContain('synced listing')
  expect(printed).toContain('blank · no store\n  store-not-configured')
})

it('reports a checked proposal and marks a partial run', async () => {
  mocks.get.mockResolvedValue(
    page(
      [
        {
          ...appStore,
          fields: {
            ...appStore.fields,
            keywords: { value: 'mus,cartas', length: 10, limit: 100 },
          },
          suggestions: null,
          proposal: {
            coverage: { tracked: 3, covered: 2 },
            gained: [{ term: 'juego de mus', from: 'partial', to: 'title' }],
            lost: [{ term: 'mus online', from: 'title', to: 'subtitle' }],
            issues: [{ message: 'The title has 31 characters.' }],
          },
        },
      ],
      { complete: false },
    ),
  )
  await run(command(), ['suggest', 'mus', '--store', 'ios-app-store'])
  const printed = output.logs.join('\n')

  expect(printed).toContain('Tracked keywords covered: 1/3\n')
  expect(printed).toContain('Keyword field     mus,cartas (10/100)')
  expect(printed).toContain('Proposal covers 2/3')
  expect(printed).toContain('+ juego de mus: partial → title')
  expect(printed).toContain('- mus online: title → subtitle')
  expect(printed).toContain('! The title has 31 characters.')
  expect(printed).toContain(
    'Some listings were deferred; run again with their appId.',
  )
  expect(process.exitCode).toBe(1)
})

it('shows empty drafts and lists as dashes', async () => {
  mocks.get.mockResolvedValue(
    page([
      {
        ...appStore,
        keywords: [],
        issues: [],
        competitorWords: [],
        suggestions: {
          ...appStore.suggestions,
          subtitle: { value: '', length: 0, limit: 30, changed: true },
          keywords: { value: '', length: 0, limit: 100 },
        },
      },
      { ...googlePlay, suggestions: null },
      {
        ...microsoftStore,
        fields: { ...microsoftStore.fields, keywords: { terms: [], limit: 7 } },
      },
    ]),
  )
  await run(command(), ['suggest'])
  const printed = output.logs.join('\n')

  expect(printed).toContain('→ — (0/30)')
  expect(printed).toContain('→ — (0/100)')
  expect(printed).toContain('Search terms      —')
  expect(printed).not.toContain('work in:')
  expect(printed).not.toContain('Opportunities')
})

it('rejects an unknown store before calling the API', async () => {
  await run(command(), ['suggest', '--store', 'app-store', '--json'])
  expect(mocks.get).not.toHaveBeenCalled()
  expect(process.exitCode).not.toBe(0)
})
