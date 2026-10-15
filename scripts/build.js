/* Copyright 2013 - 2024 Waiterio LLC */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const scriptsDirectory = fileURLToPath(new URL('.', import.meta.url))
const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)

const distDir = path.resolve(scriptsDirectory, '../dist')

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true })
}
fs.mkdirSync(distDir, { recursive: true })

const external = Object.keys(packageJson.dependencies || {})

build({
  entryPoints: [path.resolve(scriptsDirectory, '../index.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: path.resolve(distDir, 'index.js'),
  format: 'esm',
  external,
  minify: false,
  sourcemap: false,
})
  .then(() => {
    fs.chmodSync(path.resolve(distDir, 'index.js'), 0o755)

    // Copy the canonical skills from the @appskyline/skills workspace into
    // the package. The npm tarball ships them via `files: ["dist", "skills"]`
    // so `appskyline skills get <name>` always prints the guide matching the
    // installed version.
    // The canonical source only exists inside the waiterio monorepo — builds
    // from the public github.com/appskyline/cli mirror skip the copy and keep
    // whatever skills/ they already have.
    const skillsDir = path.resolve(scriptsDirectory, '../skills')
    const canonicalSkillsDir = path.resolve(
      scriptsDirectory,
      '../../skills/public/skills',
    )
    if (fs.existsSync(canonicalSkillsDir)) {
      if (fs.existsSync(skillsDir)) {
        fs.rmSync(skillsDir, { recursive: true })
      }
      fs.cpSync(canonicalSkillsDir, skillsDir, { recursive: true })
    }

    console.log('Build completed successfully!')
    console.log(`Output: ${path.resolve(distDir, 'index.js')}`)
  })
  .catch(error => {
    console.error('Build failed:', error)
    process.exit(1)
  })
