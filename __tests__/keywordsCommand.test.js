/* Copyright 2013 - 2026 Waiterio LLC */
import { expectConsoleError } from '@monorepool/root/vitest.strict.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import keywordsCommand from '../keywordsCommand.js'
import { captureOutput, readJson, run } from './testHarness.js'

const mocks = vi.hoisted(() => ({
  api: {
    del: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  getConfig: vi.fn(),
}))

vi.mock('../request.js', () => ({ default: mocks.api }))
vi.mock('../getConfig.js', () => ({ default: mocks.getConfig }))

let output

beforeEach(() => {
  Object.values(mocks.api).forEach(mock => mock.mockReset())
  mocks.getConfig.mockReset().mockReturnValue({})
  output = captureOutput()
  process.exitCode = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = 0
})

describe('tracked keyword lifecycle', () => {
  it('lists a configured app with pagination and meaningful locale labels', async () => {
    mocks.getConfig.mockReturnValue({ appId: 'configured-app' })
    mocks.api.get.mockResolvedValueOnce([
      {
        _id: 'keyword-1',
        searchTerms: 'restaurant pos',
        language: 'en',
        country: 'US',
      },
      { _id: 'keyword-2', country: 'IT' },
      { _id: 'keyword-3' },
    ])

    await run(keywordsCommand(), ['list', '--limit', '20', '--skip', '40'])

    expect(mocks.api.get).toHaveBeenCalledWith(
      '/api/keywords?appId=configured-app&limit=20&skip=40',
    )
    expect(output.logs.join('\n')).toContain(
      'restaurant pos (en-US)  keyword-1',
    )
    expect(output.logs.join('\n')).toContain('keyword-2 (IT)  keyword-2')
    expect(output.logs.join('\n')).toContain('keyword-3  keyword-3')
  })

  it('returns raw list data and distinguishes no results', async () => {
    mocks.api.get.mockResolvedValueOnce([{ _id: 'keyword-1' }])
    await run(keywordsCommand(), ['list', '--appId', 'flag-app', '--json'])
    expect(readJson(output)).toEqual([{ _id: 'keyword-1' }])

    mocks.api.get.mockResolvedValueOnce(null)
    await run(keywordsCommand(), ['list', '--appId', 'flag-app'])
    expect(output.logs).toContain('No keywords found')
  })

  it('fails before the network when neither a flag nor project config selects an app', async () => {
    await run(keywordsCommand(), ['list', '--json'])

    expect(mocks.api.get).not.toHaveBeenCalled()
    expect(JSON.parse(output.stderr.join(''))).toEqual({
      error: {
        message: '--appId required (or add appId to appskyline.json)',
      },
    })
    expect(process.exitCode).toBe(1)
  })

  it('gets one keyword and creates a localized term with stable API fields', async () => {
    mocks.api.get.mockResolvedValueOnce({
      _id: 'keyword-1',
      searchTerms: 'restaurant pos',
    })
    await run(keywordsCommand(), ['get', 'keyword-1'])
    expect(mocks.api.get).toHaveBeenCalledWith('/api/keywords/keyword-1')
    expect(output.logs.join('\n')).toContain('restaurant pos')

    output.stdout.length = 0
    mocks.api.post.mockResolvedValueOnce({ _id: 'keyword-new' })
    await run(keywordsCommand(), [
      'add',
      '--term',
      'software fatture',
      '--appId',
      'app-1',
      '--lang',
      'it',
      '--country',
      'IT',
      '--json',
    ])
    expect(mocks.api.post).toHaveBeenCalledWith('/api/keywords', {
      appId: 'app-1',
      country: 'IT',
      language: 'it',
      searchTerms: 'software fatture',
    })
    expect(readJson(output)).toEqual({ id: 'keyword-new', ok: true })
  })

  it('updates raw fields while forcing the path id into the request body', async () => {
    mocks.api.put.mockResolvedValueOnce({
      _id: 'keyword-1',
      country: 'ES',
      language: 'es',
    })
    await run(keywordsCommand(), [
      'update',
      'keyword-1',
      '--body',
      '{"country":"ES","language":"es","_id":"wrong"}',
      '--json',
    ])

    expect(mocks.api.put).toHaveBeenCalledWith('/api/keywords', {
      _id: 'keyword-1',
      country: 'ES',
      language: 'es',
    })
    expect(readJson(output)).toEqual({ id: 'keyword-1', ok: true })
  })

  it('reports malformed update JSON as a command failure', async () => {
    expectConsoleError(
      "error Expected property name or '}' in JSON at position 1 (line 1 column 2)",
    )

    await run(keywordsCommand(), ['update', 'keyword-1', '--body', '{not-json'])

    expect(mocks.api.put).not.toHaveBeenCalled()
    expect(output.errors.join('\n')).toMatch(/error.*JSON/i)
    expect(process.exitCode).toBe(1)
  })

  it('deletes each requested keyword and has a concise JSON mutation result', async () => {
    mocks.api.del.mockResolvedValue(null)
    await run(keywordsCommand(), ['delete', 'keyword-1', 'keyword-2'])

    expect(mocks.api.del.mock.calls).toEqual([
      ['/api/keywords/keyword-1'],
      ['/api/keywords/keyword-2'],
    ])
    expect(output.logs).toEqual(['deleted keyword-1', 'deleted keyword-2'])

    output.stdout.length = 0
    await run(keywordsCommand(), ['delete', 'keyword-3', 'keyword-4', '--json'])
    expect(readJson(output)).toEqual({
      deleted: ['keyword-3', 'keyword-4'],
      ok: true,
    })
  })
})

describe('keyword research workflows', () => {
  it('sorts overview results by volume and renders missing metrics safely', async () => {
    mocks.api.get.mockResolvedValueOnce([
      {
        keyword: 'invoice',
        searchVolume: 90,
        cpc: 2,
        competitionLevel: 'HIGH',
        keywordDifficulty: 55,
      },
      {
        keyword: 'estimate maker',
        searchVolume: null,
        cpc: null,
        competition: 0.3,
        keywordDifficulty: undefined,
      },
      {
        keyword: 'billing',
        searchVolume: 200,
        cpc: 1.25,
        competitionLevel: 'MEDIUM',
        keywordDifficulty: 42,
      },
    ])

    await run(keywordsCommand(), [
      'overview',
      '--country',
      'us',
      '--terms',
      'invoice,billing,estimate maker',
      '--lang',
      'en',
    ])

    expect(mocks.api.get).toHaveBeenCalledWith(
      '/api/dataforseo-keywords/US?terms=invoice%2Cbilling%2Cestimate+maker&lang=en',
    )
    const table = output.logs.join('\n')
    expect(table.indexOf('billing')).toBeLessThan(table.indexOf('invoice'))
    expect(table).toContain('2.00')
    expect(table).toContain('—')
    expect(table).toContain('0.3')
  })

  it('supports raw overview JSON and a human no-results response', async () => {
    mocks.api.get.mockResolvedValueOnce([{ keyword: 'pos', searchVolume: 20 }])
    await run(keywordsCommand(), [
      'overview',
      '--country',
      'ES',
      '--terms',
      'pos',
      '--json',
    ])
    expect(readJson(output)).toEqual([{ keyword: 'pos', searchVolume: 20 }])

    mocks.api.get.mockResolvedValueOnce([])
    await run(keywordsCommand(), [
      'overview',
      '--country',
      'ES',
      '--terms',
      'unlikely term',
    ])
    expect(output.logs).toContain('No results')
  })

  it('normalizes comma-separated locales and falls back to project appId', async () => {
    mocks.getConfig.mockReturnValue({ appId: 'configured-app' })
    mocks.api.post.mockResolvedValueOnce({
      it: 'software fatture',
      es: 'software facturas',
      de: 'rechnungssoftware',
    })

    await run(keywordsCommand(), [
      'translate',
      '--term',
      'invoice software',
      '--locales',
      'it, es ,de',
      '--json',
    ])

    expect(mocks.api.post).toHaveBeenCalledWith('/api/keywords/translate', {
      appId: 'configured-app',
      locales: ['it', 'es', 'de'],
      searchTerms: 'invoice software',
    })
    expect(readJson(output)).toEqual({
      ok: true,
      result: {
        de: 'rechnungssoftware',
        es: 'software facturas',
        it: 'software fatture',
      },
    })
  })

  it('does not attempt a translation without an app context', async () => {
    expectConsoleError(
      'error --appId required (or add appId to appskyline.json)',
    )

    await run(keywordsCommand(), [
      'translate',
      '--term',
      'invoice',
      '--locales',
      'it',
    ])

    expect(mocks.api.post).not.toHaveBeenCalled()
    expect(output.errors.join('\n')).toContain('--appId required')
    expect(process.exitCode).toBe(1)
  })
})
