/* Copyright 2013 - 2024 Waiterio LLC */
const getApiUrl = require('./getApiUrl.js')
const getAccessToken = require('./session/getAccessToken.js')
const getRefreshToken = require('./session/getRefreshToken.js')
const setAccessToken = require('./session/setAccessToken.js')

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  const basic = Buffer.from(refreshToken).toString('base64')
  const response = await fetch(`${getApiUrl()}/api/refresh-access-token`, {
    method: 'POST',
    headers: { Authorization: `Token ${basic}` },
  })

  if (!response.ok) return null

  const { accessToken } = await response.json()
  if (accessToken) setAccessToken(accessToken)
  return accessToken
}

async function fetchOnce(method, urlPath, body, accessToken) {
  const url = urlPath.startsWith('https://')
    ? urlPath
    : `${getApiUrl()}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`

  const headers = { 'Content-Type': 'application/json' }
  // Appskyline API expects `Authorization: Token <base64(jwt)>`.
  if (accessToken) {
    headers.Authorization = `Token ${Buffer.from(accessToken).toString('base64')}`
  }

  return fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function request(method, urlPath, body) {
  let accessToken = getAccessToken()
  let response = await fetchOnce(method, urlPath, body, accessToken)

  let refreshed = false
  if (response.status === 401 && getRefreshToken()) {
    accessToken = await refreshAccessToken()
    if (accessToken) {
      refreshed = true
      response = await fetchOnce(method, urlPath, body, accessToken)
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = `${method} ${urlPath} → ${response.status}: ${text}`
    // A 401 without a stored session — or after a failed refresh — means the
    // user simply is not logged in; say so instead of leaving a raw 401.
    if (response.status === 401 && !refreshed) {
      message += ' — Not logged in? Run `appskyline login` first.'
    }
    throw new Error(message)
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

module.exports = {
  get: urlPath => request('GET', urlPath),
  post: (urlPath, body) => request('POST', urlPath, body),
  put: (urlPath, body) => request('PUT', urlPath, body),
  del: (urlPath, body) => request('DELETE', urlPath, body),
}
