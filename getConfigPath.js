/* Copyright 2013 - 2024 Waiterio LLC */
import fs from 'node:fs'
import path from 'node:path'

// Walks up from the current working directory looking for appskyline.json.
export default function getConfigPath() {
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
