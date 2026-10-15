/* Copyright 2013 - 2024 Waiterio LLC */
import { inspect } from 'node:util'

// Human-facing pretty-printer for reading documents in a terminal (colored,
// unquoted keys). The machine-readable counterpart is the `--json` flag on
// every subcommand, which prints real JSON via @monorepool/agentfirst's
// printJson — never this.
function formatInspect(value) {
  return inspect(value, { colors: true, depth: null })
}

function printInspect(value) {
  console.log(formatInspect(value))
}

export { formatInspect, printInspect }
