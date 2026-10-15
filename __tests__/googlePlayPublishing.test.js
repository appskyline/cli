/* Copyright 2013 - 2026 Waiterio LLC */
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import googlePlayCommand from '../googlePlayCommand.js'
import { captureOutput, readJson, run } from './testHarness.js'

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
  upload: vi.fn(),
}))
vi.mock('../request.js', () => ({ default: mocks.api }))
vi.mock('../uploadGooglePlayBundle.js', () => ({ default: mocks.upload }))
let output
let directory
beforeEach(async () => {
  vi.resetAllMocks()
  output = captureOutput()
  process.exitCode = 0
  directory = await mkdtemp(path.join(os.tmpdir(), 'play-cli-'))
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  process.exitCode = 0
  await rm(directory, { recursive: true, force: true })
})
it('plans without submitting and retains all explicit version codes', async () => {
  mocks.api.post.mockResolvedValue({ replacesTrackReleases: true })
  await run(googlePlayCommand(), [
    'release',
    'plan',
    'app',
    '--version-code',
    '2',
    '3',
    '--track',
    'internal',
    '--json',
  ])
  expect(mocks.api.post).toHaveBeenCalledWith(
    '/api/apps/app/google-play/release/plan?track=internal',
    { versionCodes: ['2', '3'], status: 'completed' },
  )
  expect(readJson(output)).toEqual({ replacesTrackReleases: true })
  expect(mocks.api.put).not.toHaveBeenCalled()
})
it('submits only after staging succeeds and preserves Google error details', async () => {
  mocks.api.put.mockRejectedValue(
    Object.assign(new Error('Already in review'), {
      status: 400,
      body: { details: { upstreamStatus: 409 } },
    }),
  )
  await run(googlePlayCommand(), [
    'release',
    'submit',
    'app',
    '--edit',
    'e',
    '--version-code',
    '3',
    '--json',
  ])
  expect(mocks.api.post).not.toHaveBeenCalled()
  expect(JSON.parse(output.stderr.join(''))).toMatchObject({
    editId: 'e',
    error: { details: { upstreamStatus: 409 } },
  })
  expect(process.exitCode).toBe(1)
})
it('commits with explicit defer-review only when requested', async () => {
  mocks.api.put.mockResolvedValue({ committed: false })
  mocks.api.post.mockResolvedValue({
    committed: true,
    reviewAction: 'console-required',
  })
  await run(googlePlayCommand(), [
    'release',
    'submit',
    'app',
    '--edit',
    'e',
    '--version-code',
    '3',
    '--defer-review',
    '--json',
  ])
  expect(mocks.api.post).toHaveBeenCalledWith(
    '/api/apps/app/google-play/edits/e/commit',
    { deferReview: true },
  )
  expect(readJson(output).reviewAction).toBe('console-required')
})
it('watch ignores an old published version and returns rejection for the requested version', async () => {
  vi.useFakeTimers()
  const old = {
    activeArtifacts: [{ versionCode: 2 }],
    releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_PUBLISHED',
  }
  mocks.api.get
    .mockResolvedValueOnce({ releases: [old] })
    .mockResolvedValueOnce({
      releases: [
        old,
        {
          activeArtifacts: [{ versionCode: 3 }],
          releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_NOT_APPROVED',
        },
      ],
    })
  const pending = run(googlePlayCommand(), [
    'releases',
    'watch',
    'app',
    '--version-code',
    '3',
    '--interval',
    '1',
    '--json',
  ])
  await vi.advanceTimersByTimeAsync(1000)
  await pending
  expect(readJson(output).outcome).toBe('rejected')
  expect(mocks.api.get).toHaveBeenCalledTimes(2)
  expect(process.exitCode).toBe(1)
})
it.each([
  ['PUBLISHED', 'published', 0],
  ['APPROVED_NOT_PUBLISHED', 'console-required', 1],
  ['NOT_SENT_FOR_REVIEW', 'console-required', 1],
])('reports %s correctly', async (state, outcome, code) => {
  mocks.api.get.mockResolvedValue({
    releases: [
      {
        activeArtifacts: [{ versionCode: 3 }],
        releaseLifecycleState: `RELEASE_LIFECYCLE_STATE_${state}`,
      },
    ],
  })
  await run(googlePlayCommand(), [
    'releases',
    'watch',
    'app',
    '--version-code',
    '3',
    '--json',
  ])
  expect(readJson(output).outcome).toBe(outcome)
  expect(process.exitCode).toBe(code)
})
it('times out for a missing version with a nonzero exit', async () => {
  vi.useFakeTimers()
  mocks.api.get.mockResolvedValue({ releases: [] })
  const pending = run(googlePlayCommand(), [
    'releases',
    'watch',
    'app',
    '--version-code',
    '3',
    '--timeout',
    '1',
    '--json',
  ])
  await vi.advanceTimersByTimeAsync(1000)
  await pending
  expect(readJson(output).outcome).toBe('timeout')
  expect(process.exitCode).toBe(1)
})
it('uploads the file directly to Google and prints no session capability', async () => {
  const file = path.join(directory, 'signed.aab')
  await writeFile(file, 'bundle')
  mocks.api.post.mockResolvedValue({
    uploadUrl: 'secret-session',
    packageName: 'com.example.app',
  })
  mocks.upload.mockResolvedValue({ versionCode: 3 })
  await run(googlePlayCommand(), [
    'release',
    'upload',
    'app',
    '--edit',
    'e',
    '--aab',
    file,
    '--json',
  ])
  expect(readJson(output)).toEqual({
    appId: 'app',
    editId: 'e',
    bundle: { versionCode: 3 },
    committed: false,
  })
  expect(mocks.api.post).toHaveBeenCalledWith(
    '/api/apps/app/google-play/edits/e/bundle-upload',
    { size: 6 },
  )
  expect(output.stdout.join('')).not.toContain('secret-session')
})
it('uploads parsed listing JSON and unmodified safety CSV', async () => {
  const file = path.join(directory, 'listing.json')
  await writeFile(
    file,
    JSON.stringify({ locales: [{ language: 'en-US', title: 'App' }] }),
  )
  mocks.api.put.mockResolvedValue({ committed: false })
  await run(googlePlayCommand(), [
    'metadata',
    'upload',
    'app',
    '--edit',
    'e',
    '--file',
    file,
    '--json',
  ])
  expect(mocks.api.put).toHaveBeenCalledWith(
    '/api/apps/app/google-play/edits/e/listings',
    { locales: [{ language: 'en-US', title: 'App' }] },
  )
  await writeFile(file, 'a,b\n1,2')
  mocks.api.post.mockResolvedValue({ uploaded: true })
  await run(googlePlayCommand(), [
    'data-safety',
    'upload',
    'app',
    '--file',
    file,
    '--json',
  ])
  expect(mocks.api.post).toHaveBeenCalledWith(
    '/api/apps/app/google-play/data-safety',
    { safetyLabels: 'a,b\n1,2' },
  )
})
