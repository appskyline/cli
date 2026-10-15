/* Copyright 2013 - 2024 Waiterio LLC */

import path from 'node:path'

import fs from 'fs-extra'

import getConfigPath from './getConfigPath.js'

export default function setConfig(config) {
  const configPath =
    getConfigPath() || path.join(process.cwd(), 'appskyline.json')
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return configPath
}
