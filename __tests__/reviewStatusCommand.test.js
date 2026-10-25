/* Copyright 2013 - 2026 Waiterio LLC */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import command from '../reviewStatusCommand.js'
import { captureOutput, readJson, run } from './testHarness.js'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../request.js', () => ({ default: mocks }))
let output
const row = {
  appId: 'a',
  product: 'DodoDentist',
  store: 'ios-app-store',
  availability: 'available',
  status: 'rejected',
  actionRequired: true,
  fingerprint: 'stable',
  consoleUrl: 'https://example.com',
  rejectionDetails: { available: false, reason: 'Open console' },
}
const page = (overrides = {}) => ({
  schemaVersion: 1,
  organizationId: 'org',
  scope: 'organization',
  totalApps: 2,
  complete: true,
  nextCursor: null,
  results: [row],
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
it('follows all pages and emits one JSON document for organization automation', async () => {
  mocks.get
    .mockResolvedValueOnce(page({ nextCursor: 'a' }))
    .mockResolvedValueOnce(page({ results: [{ ...row, appId: 'b' }] }))
  await run(command(), ['--json'])
  expect(readJson(output)).toMatchObject({
    totalApps: 2,
    complete: true,
    nextCursor: null,
    actionRequired: true,
    results: [{ appId: 'a' }, { appId: 'b' }],
  })
  expect(mocks.get.mock.calls.map(call => call[0])).toEqual([
    '/api/reviewstatuses?track=production',
    '/api/reviewstatuses?track=production&after=a',
  ])
  expect(process.exitCode).toBe(0)
})
it('encodes exact product, store and track selectors', async () => {
  mocks.get.mockResolvedValue(page())
  await run(command(), [
    '--product',
    'DodoDentist',
    '--store',
    'ios-app-store',
    '--track',
    'internal',
    '--json',
    '--fail-on-problems',
  ])
  expect(mocks.get).toHaveBeenCalledWith(
    '/api/reviewstatuses?track=internal&product=DodoDentist&store=ios-app-store',
  )
  expect(process.exitCode).toBe(2)
})
it('keeps partial data on stdout and gives incomplete coverage precedence over review failures', async () => {
  mocks.get.mockResolvedValue(page({ complete: false }))
  await run(command(), ['--app', 'id & value', '--json', '--fail-on-problems'])
  expect(mocks.get).toHaveBeenCalledWith(
    '/api/reviewstatuses?track=production&appId=id+%26+value',
  )
  expect(readJson(output).results).toHaveLength(1)
  expect(process.exitCode).toBe(1)
})
it.each([
  ['--app', 'a', '--product', 'b'],
  ['--store', 'ios'],
])('rejects invalid selectors: %j', async (...args) => {
  await run(command(), [...args, '--json'])
  expect(mocks.get).not.toHaveBeenCalled()
  expect(output.stderr.join('')).toContain('error')
  expect(process.exitCode).toBe(1)
})
it('reports transport errors without emitting success JSON', async () => {
  mocks.get.mockRejectedValue(new Error('Unauthorized'))
  await run(command(), ['--json'])
  expect(output.stdout).toEqual([])
  expect(output.stderr.join('')).toContain('Unauthorized')
  expect(process.exitCode).toBe(1)
})
it('rejects repeating cursors or a changed organization', async () => {
  mocks.get.mockResolvedValue(page({ nextCursor: 'a' }))
  await run(command(), ['--json'])
  expect(process.exitCode).toBe(1)
  expect(output.stderr.join('')).toContain('Repeated')
  mocks.get
    .mockReset()
    .mockResolvedValueOnce(page({ nextCursor: 'a' }))
    .mockResolvedValueOnce(page({ organizationId: 'different' }))
  await run(command(), ['--json'])
  expect(output.stderr.join('')).toContain('Organization changed')
})
it('renders actionable errors and reports for people', async () => {
  mocks.get.mockResolvedValue(
    page({
      complete: false,
      results: [
        row,
        {
          ...row,
          track: 'production',
          rejectionDetails: {
            errors: [{ code: 'policy', message: 'Fix login' }],
            reports: [{ url: 'https://example.com/report' }],
          },
        },
        {
          ...row,
          actionRequired: false,
          error: { message: 'Check credentials' },
        },
      ],
    }),
  )
  await run(command(), [])
  expect(output.logs.join('\n')).toContain('Fix login')
  expect(output.logs.join('\n')).toContain('Open console')
  expect(output.logs.join('\n')).toContain('https://example.com/report')
  expect(output.logs.join('\n')).toContain('Check credentials')
})
