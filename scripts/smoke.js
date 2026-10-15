/* Copyright 2013 - 2024 Waiterio LLC */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const cliDirectory = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const [binaryName] = Object.keys(packageJson.bin)
const distEntry = path.join(cliDirectory, 'dist', 'index.js')
const temporaryDirectory = mkdtempSync(
  path.join(tmpdir(), `${binaryName}-cli-smoke-`),
)
const linkedBinary = path.join(temporaryDirectory, binaryName)

function runBinary(args) {
  const result = spawnSync(linkedBinary, args, { encoding: 'utf8' })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${binaryName} ${args.join(' ')} exited ${result.status}: ${result.stderr}`,
    )
  }

  return result.stdout
}

try {
  const originalProcessEntry = process.argv[1]
  let program

  try {
    process.argv[1] = path.join(temporaryDirectory, 'missing-importer.js')
    const importedEntry = await import(pathToFileURL(distEntry).href)
    program = importedEntry.default
  } finally {
    process.argv[1] = originalProcessEntry
  }

  if (program.name() !== binaryName) {
    throw new Error(
      'Importing the package entry did not expose its CLI program',
    )
  }

  symlinkSync(distEntry, linkedBinary)

  const help = runBinary(['--help'])
  if (!help.includes(`Usage: ${binaryName}`)) {
    throw new Error('The symlinked binary did not print its help')
  }

  const version = runBinary(['--version']).trim()
  if (version !== packageJson.version) {
    throw new Error(
      `Expected version ${packageJson.version}, received ${version || 'none'}`,
    )
  }

  const schema = JSON.parse(runBinary(['schema']))
  if (schema.name !== binaryName || !schema.commands?.length) {
    throw new Error('The symlinked binary did not expose its command schema')
  }

  if (!runBinary(['skills', 'list']).trim()) {
    throw new Error('The symlinked binary did not find its packaged skills')
  }

  console.log(`${binaryName} ESM package and symlinked-bin smoke passed`)
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
