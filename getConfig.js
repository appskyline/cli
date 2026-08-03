/* Copyright 2013 - 2024 Waiterio LLC */
const fs = require('fs-extra')
const getConfigPath = require('./getConfigPath.js')

// Reads the nearest appskyline.json (walking up from cwd), returning
// { organizationId, appId } if present. CLI flags should take priority over
// these defaults.
module.exports = function getConfig() {
  const configPath = getConfigPath()
  if (!configPath) return {}
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) || {}
  } catch {
    return {}
  }
}
