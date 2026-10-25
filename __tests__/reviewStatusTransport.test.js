/* Copyright 2013 - 2026 Waiterio LLC */
import { createServer } from 'node:http'

import { afterEach, expect, it, vi } from 'vitest'

import reviewStatusCommand from '../reviewStatusCommand.js'
import { captureOutput, readJson, run } from './testHarness.js'

vi.mock('../session.js', () => ({
  default: {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    getApiKeySecret: () => 'fixture-key',
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  process.exitCode = 0
})

it('reads every page over HTTP with key authentication and retains partial store failures in JSON', async () => {
  const requests = []
  const server = createServer((request, response) => {
    requests.push({
      url: request.url,
      authorization: request.headers.authorization,
    })
    const second = new URL(request.url, 'http://localhost').searchParams.has(
      'after',
    )
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        schemaVersion: 1,
        organizationId: 'org',
        scope: 'organization',
        totalApps: 2,
        complete: !second,
        nextCursor: second ? null : 'a',
        results: [
          {
            appId: second ? 'b' : 'a',
            availability: second ? 'error' : 'available',
            status: second ? 'unknown' : 'rejected',
            actionRequired: !second,
          },
        ],
      }),
    )
  })
  await new Promise(resolve => {
    server.listen(0, '127.0.0.1', resolve)
  })
  vi.stubEnv('APPSKYLINE_API_URL', `http://127.0.0.1:${server.address().port}`)
  const output = captureOutput()
  try {
    await run(reviewStatusCommand(), [
      '--product',
      'DodoDentist',
      '--json',
      '--fail-on-problems',
    ])
    expect(requests).toHaveLength(2)
    expect(requests[0].authorization).toBe(
      `Basic ${Buffer.from('fixture-key').toString('base64')}`,
    )
    expect(requests[1].url).toContain('after=a')
    expect(
      requests.every(request => request.url.includes('product=DodoDentist')),
    ).toBe(true)
    expect(readJson(output)).toMatchObject({
      complete: false,
      actionRequired: true,
      results: [{ appId: 'a' }, { appId: 'b' }],
    })
    expect(process.exitCode).toBe(1)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => {
      server.close(resolve)
    })
  }
})
