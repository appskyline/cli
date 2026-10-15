/* Copyright 2013 - 2024 Waiterio LLC */
import createRequest from '@monorepool/agentfirst/request.js'

import getApiUrl from './getApiUrl.js'
import session from './session.js'

// Dual-mode transport from @monorepool/agentfirst:
//
//   token mode — `Authorization: Token base64(jwt)` with a single refresh
//                against /api/refresh-access-token on a 401 (the semantics
//                this file has always had)
//   key mode   — `Authorization: Basic base64(secret)` from the stored API
//                key secret or the APPSKYLINE_API_KEY environment variable
//
// Precedence: stored browser session > stored key > APPSKYLINE_API_KEY.
// Errors carry `.status` and `.body`, and terminal 401/403s append the
// login hint naming both `appskyline login` and the environment variable.
export default createRequest({
  getApiUrl,
  session,
  envKeyName: 'APPSKYLINE_API_KEY',
  binaryName: 'appskyline',
})
