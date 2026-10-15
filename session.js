/* Copyright 2013 - 2024 Waiterio LLC */
import createSessionStore from '@monorepool/agentfirst/sessionStore.js'

// One store for both auth modes (browser session tokens + API key secret),
// backed by node-localstorage in ~/.appskyline/ — the same directory and the
// same key names the CLI has always written, so existing sessions keep
// working unchanged.
export default createSessionStore({ productDirName: 'appskyline' })
