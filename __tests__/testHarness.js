/* Copyright 2013 - 2026 Waiterio LLC */
import { vi } from 'vitest'

function captureOutput() {
  const errors = []
  const logs = []
  const stderr = []
  const stdout = []

  vi.spyOn(console, 'error').mockImplementation((...values) => {
    errors.push(values.map(String).join(' '))
  })
  vi.spyOn(console, 'log').mockImplementation((...values) => {
    logs.push(values.map(String).join(' '))
  })
  vi.spyOn(process.stdout, 'write').mockImplementation(value => {
    stdout.push(String(value))
    return true
  })
  vi.spyOn(process.stderr, 'write').mockImplementation(value => {
    stderr.push(String(value))
    return true
  })

  return { errors, logs, stderr, stdout }
}

async function run(command, arguments_) {
  await command.parseAsync(arguments_, { from: 'user' })
}

function readJson(output) {
  return JSON.parse(output.stdout.join(''))
}

// eslint-disable-next-line @stylistic/object-curly-newline
export { captureOutput, readJson, run }
