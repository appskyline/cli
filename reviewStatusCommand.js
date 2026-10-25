/* Copyright 2013 - 2026 Waiterio LLC */
import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import { Command } from 'commander'

import api from './request.js'

export default function reviewStatusCommand() {
  return withJson(
    new Command('review-status')
      .description(
        'Read current app review status across the authenticated organization',
      )
      .option('--app <appId>', 'one AppSkyline app ID, across its stores')
      .option(
        '--product <name>',
        'exact AppSkyline app name, case-insensitive (all matching apps)',
      )
      .option(
        '--store <store>',
        'ios-app-store | macos-app-store | google-play | microsoft-store',
      )
      .option('--track <track>', 'Google Play track', 'production')
      .option(
        '--fail-on-problems',
        'exit 2 when a rejected or failed submission needs attention',
      ),
  ).action(async options => {
    try {
      if (options.app && options.product) {
        throw new Error('Choose --app or --product')
      }
      if (
        options.store &&
        ![
          'ios-app-store',
          'macos-app-store',
          'google-play',
          'microsoft-store',
        ].includes(options.store)
      ) {
        throw new Error('Invalid --store')
      }
      const query = new URLSearchParams({ track: options.track })
      for (const [key, value] of Object.entries({
        appId: options.app,
        product: options.product,
        store: options.store,
      })) {
        if (value !== undefined) query.set(key, value)
      }
      let snapshot
      const cursors = new Set()
      do {
        // eslint-disable-next-line no-await-in-loop
        const page = await api.get(`/api/reviewstatuses?${query}`)
        if (!snapshot) snapshot = { ...page, results: [] }
        if (page.organizationId !== snapshot.organizationId) {
          throw new Error(
            'Organization changed during review-status scan; retry',
          )
        }
        snapshot.results.push(...page.results)
        snapshot.complete = snapshot.complete && page.complete
        snapshot.nextCursor = page.nextCursor
        if (page.nextCursor) {
          if (cursors.has(page.nextCursor)) {
            throw new Error('Repeated review-status cursor')
          }
          cursors.add(page.nextCursor)
          query.set('after', page.nextCursor)
        }
      } while (snapshot.nextCursor)
      snapshot.finishedAt = new Date().toISOString()
      snapshot.actionRequired = snapshot.results.some(
        result => result.actionRequired,
      )
      if (options.json) printJson(snapshot)
      else {
        console.log(
          `Review status: ${snapshot.totalApps} app(s), organization ${snapshot.organizationId} (${snapshot.scope})`,
        )
        for (const result of snapshot.results) {
          console.log(
            `${result.product} [${result.appId}] / ${result.store}${result.track ? ` / ${result.track}` : ''}: ${result.status} (${result.availability})${result.actionRequired ? ' — action required' : ''}`,
          )
          if (result.error) console.log(`  ${result.error.message}`)
          if (result.actionRequired) {
            console.log(`  ${result.consoleUrl}`)
            if (result.rejectionDetails.reason) {
              console.log(`  ${result.rejectionDetails.reason}`)
            }
            for (const error of result.rejectionDetails.errors || []) {
              console.log(`  ${error.code}: ${error.message}`)
            }
            for (const report of result.rejectionDetails.reports || []) {
              console.log(`  Report: ${report.url}`)
            }
          }
        }
      }
      if (!snapshot.complete) process.exitCode = 1
      else if (options.failOnProblems && snapshot.actionRequired) {
        process.exitCode = 2
      }
    } catch (error) {
      fail(error, { json: options.json })
    }
  })
}
