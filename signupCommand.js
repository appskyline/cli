/* Copyright 2013 - 2024 Waiterio LLC */
const agentfirstSignupCommand = require('@monorepool/agentfirst/signupCommand.js')
const getApiUrl = require('./getApiUrl.js')
const session = require('./session.js')

// The step that used to need a person. `login` assumes the account exists;
// an agent pointed at appskyline.com for the first time has no account to
// log into, and the browser flow it fell into blocked for up to five minutes
// with nobody there to complete it.
//
//   appskyline signup --email founder@example.com --json
//
// stores the session in the same ~/.appskyline the browser flow writes, so
// every other command works immediately afterwards.
//
// The binary name and app URL are inlined the way request.js already inlines
// them — the CLI has no consolidated config module, and index.js owns its own
// copies for login/logout.
function signupCommand() {
  return agentfirstSignupCommand({
    binaryName: 'appskyline',
    getApiUrl,
    appUrl: 'https://app.appskyline.com',
    session,
  })
}

module.exports = signupCommand
