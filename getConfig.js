/* Copyright 2013 - 2024 Waiterio LLC */
import fs from 'fs-extra'

import getConfigPath from './getConfigPath.js'

// Reads the nearest appskyline.json (walking up from cwd), returning
// { organizationId, appId } if present. CLI flags should take priority over
// these defaults.
export default function getConfig() {
  const configPath = getConfigPath()
  if (!configPath) return {}
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) || {}
  } catch {
    return {}
  }
}
