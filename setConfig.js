/* Copyright 2013 - 2024 Waiterio LLC */
const fs = require('fs-extra')
const path = require('node:path')
const getConfigPath = require('./getConfigPath.js')

module.exports = function setConfig(config) {
  const configPath =
    getConfigPath() || path.join(process.cwd(), 'appskyline.json')
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return configPath
}
