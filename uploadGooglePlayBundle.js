/* Copyright 2013 - 2026 Waiterio LLC */
import { open } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'

// Google resumable session URLs are bearer capabilities. Keep them out of output
// and error causes; only the server starts a session using the stored credential.
export default async function uploadGooglePlayBundle({
  file,
  uploadUrl,
  size,
  packageName,
  editId,
}) {
  let url
  try {
    url = new URL(uploadUrl)
  } catch {
    throw new Error('Invalid Google upload destination')
  }
  if (
    url.protocol !== 'https:' ||
    !['androidpublisher.googleapis.com', 'www.googleapis.com'].includes(
      url.hostname,
    ) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !==
      `/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/bundles`
  ) {
    throw new Error('Unexpected Google upload destination')
  }
  const handle = await open(file, 'r')
  let offset = 0
  let failures = 0
  let queryStatus = false
  try {
    if ((await handle.stat()).size !== size) {
      throw new Error('Bundle changed before upload')
    }
    while (failures < 5) {
      if (failures) await sleep(250 * 2 ** (failures - 1))
      const buffer = Buffer.alloc(Math.min(8 * 1024 * 1024, size - offset))
      if (!queryStatus) {
        const { bytesRead } = await handle.read(
          buffer,
          0,
          buffer.length,
          offset,
        )
        if (bytesRead !== buffer.length) {
          throw new Error('Bundle changed during upload')
        }
      }
      let response
      try {
        response = await fetch(url, {
          method: 'PUT',
          redirect: 'manual',
          signal: AbortSignal.timeout(120000),
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(queryStatus ? 0 : buffer.length),
            'Content-Range': queryStatus
              ? `bytes */${size}`
              : `bytes ${offset}-${offset + buffer.length - 1}/${size}`,
          },
          body: queryStatus ? undefined : buffer,
        })
      } catch {
        queryStatus = true
        failures += 1
        continue
      }
      if (response.status === 200 || response.status === 201) {
        return await response.json()
      }
      if (response.status >= 500 || response.status === 429) {
        queryStatus = true
        failures += 1
        continue
      }
      if (response.status !== 308) {
        throw new Error(
          `Google bundle upload failed (${response.status}); inspect the edit before starting a new upload`,
        )
      }
      const range = response.headers.get('range')
      if (range && !/^bytes=0-\d+$/.test(range)) {
        throw new Error('Invalid Google upload acknowledgement')
      }
      const acknowledged = range ? Number(range.split('-')[1]) + 1 : 0
      if (
        !Number.isSafeInteger(acknowledged) ||
        acknowledged < offset ||
        acknowledged > size ||
        (!queryStatus && acknowledged > offset + buffer.length)
      ) {
        throw new Error('Invalid Google upload offset')
      }
      failures = acknowledged > offset ? 0 : failures + 1
      offset = acknowledged
      queryStatus = offset === size
    }
    throw new Error(
      'Google bundle upload did not complete after repeated recovery attempts; inspect the edit before retrying',
    )
  } finally {
    await handle.close()
  }
}
