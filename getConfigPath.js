/* Copyright 2013 - 2024 Waiterio LLC */
const fs = require('node:fs')
const path = require('node:path')

// Walks up from the current working directory looking for appskyline.json.
module.exports = function getConfigPath() {
  let dir = process.cwd()
  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(dir, 'appskyline.json')
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
