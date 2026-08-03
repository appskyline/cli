/* Copyright 2013 - 2024 Waiterio LLC */
const { inspect } = require('node:util')

function formatJson(value) {
  return inspect(value, { colors: true, depth: null })
}

function printJson(value) {
  console.log(formatJson(value))
}

function printMissingAuth() {
  console.error('Not logged in. Run `appskyline login` first.')
  process.exitCode = 1
}

module.exports = { formatJson, printJson, printMissingAuth }
