/* Copyright 2013 - 2026 Waiterio LLC */
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import upload from '../uploadGooglePlayBundle.js'

vi.mock('node:timers/promises', () => ({ setTimeout: async () => {} }))
let directory
let file
let fetchMock
const uploadUrl =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/com.example.app/edits/e/bundles?upload_id=SECRET'
const run = options =>
  upload({
    file,
    uploadUrl,
    size: 10,
    packageName: 'com.example.app',
    editId: 'e',
    ...options,
  })
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'play-upload-'))
  file = path.join(directory, 'app.aab')
  await writeFile(file, '0123456789')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await rm(directory, { recursive: true, force: true })
})
it('sends exact bytes with no Google OAuth credential and no redirect following', async () => {
  fetchMock.mockResolvedValue(new Response('{"versionCode":3}'))
  expect(await run()).toEqual({ versionCode: 3 })
  const options = fetchMock.mock.calls[0][1]
  expect(options.headers).toEqual({
    'Content-Type': 'application/octet-stream',
    'Content-Length': '10',
    'Content-Range': 'bytes 0-9/10',
  })
  expect(options.body.toString()).toBe('0123456789')
  expect(options.redirect).toBe('manual')
})
it('queries acknowledged bytes after network failure before resuming', async () => {
  fetchMock
    .mockRejectedValueOnce(new Error('network SECRET'))
    .mockResolvedValueOnce(
      new Response(null, { status: 308, headers: { range: 'bytes=0-4' } }),
    )
    .mockResolvedValueOnce(new Response('{"versionCode":3}'))
  await run()
  expect(fetchMock.mock.calls[1][1].headers['Content-Range']).toBe('bytes */10')
  expect(fetchMock.mock.calls[2][1].headers['Content-Range']).toBe(
    'bytes 5-9/10',
  )
  expect(fetchMock.mock.calls[2][1].body.toString()).toBe('56789')
})
it('handles completion discovered by a status request', async () => {
  fetchMock
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response('{"versionCode":3}', { status: 201 }))
  expect(await run()).toEqual({ versionCode: 3 })
  expect(fetchMock.mock.calls[1][1].headers['Content-Length']).toBe('0')
})
it('bounds recovery and never reveals the capability in a network error', async () => {
  fetchMock.mockRejectedValue(new Error(`failed ${uploadUrl}`))
  await expect(run()).rejects.toThrow('repeated recovery attempts')
  expect(fetchMock).toHaveBeenCalledTimes(5)
})
it.each([
  'https://evil.example/upload',
  uploadUrl.replace('/edits/e/', '/edits/other/'),
  uploadUrl.replace('https:', 'http:'),
])('refuses an unexpected upload destination', async destination => {
  await expect(run({ uploadUrl: destination })).rejects.toThrow('Unexpected')
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each([302, 404, 410])('stops on nonrecoverable status %s', async status => {
  fetchMock.mockResolvedValue(new Response(null, { status }))
  await expect(run()).rejects.toThrow(`(${status})`)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
it('rejects impossible acknowledgement offsets', async () => {
  fetchMock.mockResolvedValue(
    new Response(null, { status: 308, headers: { range: 'bytes=0-20' } }),
  )
  await expect(run()).rejects.toThrow('offset')
})
