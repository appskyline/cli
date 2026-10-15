/* Copyright 2013 - 2024 Waiterio LLC */

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import * as commander from 'commander'

import api from './request.js'

const STORE_PATHS = {
  'ios-app-store': '/api/ios-app-store/search',
  'macos-app-store': '/api/macos-app-store/search',
  'google-play': '/api/google-play/search',
  'microsoft-store': '/api/microsoft-store/search',
}

function printResults(results) {
  if (!results || results.length === 0) {
    console.log('No results')
    return
  }
  results.forEach((result, index) => {
    const title = result.title || result.name || '—'
    const id = result.id || result.appId || result.bundleId || '—'
    const rating = result.score ? ` ★${result.score.toFixed(1)}` : ''
    const dev = result.developer ? ` — ${result.developer}` : ''
    console.log(
      `${String(index + 1).padStart(2)}. ${title}${rating}${dev}  (${id})`,
    )
  })
}

function buildSearchSubcommand(store) {
  const cmd = new commander.Command(store)
  cmd.description(`search ${store} for apps matching a term`)
  cmd.requiredOption('--term <term>', 'search term')
  cmd.option('--country <country>', 'country code (e.g. US, IT)')
  cmd.option('--lang <lang>', 'language code (e.g. en, it)')
  cmd.option('-n, --num <num>', 'number of results', '10')
  withJson(cmd)
  cmd.action(async options => {
    try {
      const params = new URLSearchParams({
        term: options.term,
        num: options.num,
      })
      if (options.country) params.set('country', options.country)
      if (options.lang) params.set('lang', options.lang)

      const results = await api.get(`${STORE_PATHS[store]}?${params}`)

      if (options.json) {
        printJson(results)
        return
      }

      printResults(results)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })
  return cmd
}

function searchCommand() {
  const command = new commander.Command('search')
  command.description('search an app store for apps matching a term')
  command.addCommand(buildSearchSubcommand('ios-app-store'))
  command.addCommand(buildSearchSubcommand('macos-app-store'))
  command.addCommand(buildSearchSubcommand('google-play'))
  command.addCommand(buildSearchSubcommand('microsoft-store'))
  return command
}

export default searchCommand
