/* Copyright 2013 - 2024 Waiterio LLC */
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')
const packageJson = require('../package.json')

const distDir = path.resolve(__dirname, '../dist')

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true })
}
fs.mkdirSync(distDir, { recursive: true })

const external = Object.keys(packageJson.dependencies || {})

esbuild
  .build({
    entryPoints: [path.resolve(__dirname, '../index.js')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.resolve(distDir, 'index.js'),
    format: 'cjs',
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
    const skillsDir = path.resolve(__dirname, '../skills')
    const canonicalSkillsDir = path.resolve(
      __dirname,
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
