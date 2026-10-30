/* Copyright 2013 - 2026 Waiterio LLC */
import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'
import { Command } from 'commander'

import api from './request.js'

const STORES = [
  'ios-app-store',
  'macos-app-store',
  'google-play',
  'microsoft-store',
]

const PROPOSAL_OPTIONS = {
  title: 'title',
  subtitle: 'subtitle',
  keywords: 'keywords',
  shortDescription: 'shortDescription',
}

const OPPORTUNITIES_SHOWN = 5

const characters = field =>
  field?.limit ? ` (${field.length ?? 0}/${field.limit})` : ''

function rankText(rank) {
  if (!rank) return 'no stored rank'
  if (rank.position === null) return `not in the top ${rank.scanned}`
  return `#${rank.position} of ${rank.scanned}`
}

function demandText(demand) {
  if (!demand) return 'demand unknown'
  if (!demand.searchVolume) return 'no measured demand'
  return `${demand.searchVolume.toLocaleString('en-US')} Google searches/month`
}

function printField(label, current, suggested) {
  const value = current?.available === false ? null : current?.value
  console.log(
    `  ${label.padEnd(18)}${value ?? '—'}${value ? characters(current) : ''}`,
  )
  if (!suggested) return
  if (suggested.changed) {
    console.log(
      `  ${''.padEnd(16)}→ ${suggested.value || '—'}${characters(suggested)}`,
    )
  } else {
    console.log(`  ${''.padEnd(16)}→ keep`)
  }
}

function printResult(result) {
  const where = result.market
    ? ` · ${result.market.country}/${result.market.language}`
    : ''
  console.log(
    `\n${result.appName ?? result.appId} · ${result.store ?? 'no store'}${where}`,
  )
  if (!result.fields) {
    console.log(`  ${result.status}`)
    return
  }
  const { fields, suggestions } = result
  console.log(
    `  ${result.source.kind} listing ${result.source.locale ?? ''}`.trimEnd(),
  )
  console.log(
    `  Tracked keywords covered: ${result.coverage.covered}/${result.coverage.tracked}${
      suggestions
        ? ` now, ${suggestions.coverage.covered}/${suggestions.coverage.tracked} with these changes`
        : ''
    }`,
  )
  printField('Title', fields.title, suggestions?.title)
  if (fields.subtitle) {
    printField('Subtitle', fields.subtitle, suggestions?.subtitle)
  }
  if (fields.shortDescription) {
    printField('Short description', fields.shortDescription, null)
    const include = suggestions?.shortDescription?.include ?? []
    if (include.length > 0) {
      console.log(`  ${''.padEnd(16)}→ work in: ${include.join(', ')}`)
    }
  }
  if (fields.keywords?.available === false) {
    console.log(
      `  ${'Keyword field'.padEnd(18)}private to the store; connect the store account to check it`,
    )
  } else if (fields.keywords?.terms) {
    console.log(
      `  ${'Search terms'.padEnd(18)}${fields.keywords.terms.join(' · ') || '—'}`,
    )
  } else if (fields.keywords) {
    printField('Keyword field', fields.keywords, null)
  }
  if (suggestions?.keywords?.terms) {
    console.log(`  ${''.padEnd(16)}→ ${suggestions.keywords.terms.join(' · ')}`)
  } else if (suggestions?.keywords) {
    console.log(
      `  ${''.padEnd(16)}→ ${suggestions.keywords.value || '—'}${characters(suggestions.keywords)}`,
    )
    if (suggestions.keywords.dropped?.length > 0) {
      console.log(
        `  ${''.padEnd(16)}  no room for: ${suggestions.keywords.dropped.join(', ')}`,
      )
    }
  }
  const mentions = suggestions?.description?.mention ?? []
  if (mentions.length > 0) {
    console.log(`  ${'Description'.padEnd(18)}mention: ${mentions.join(', ')}`)
  }

  const opportunities = result.keywords
    .filter(keyword => keyword.priority > 0)
    .slice(0, OPPORTUNITIES_SHOWN)
  if (opportunities.length > 0) console.log('  Opportunities')
  for (const keyword of opportunities) {
    const missing =
      keyword.missingWords.length > 0
        ? ` (missing: ${keyword.missingWords.join(', ')})`
        : ''
    console.log(
      `    ${keyword.term} — ${keyword.coverage}${missing}; ${rankText(keyword.rank)}; ${demandText(keyword.demand)}`,
    )
  }
  for (const issue of result.issues) {
    console.log(`  ! ${issue.message}`)
  }
  if (result.competitorWords.length > 0) {
    console.log(
      `  Words competitors use (keep only those that describe your app, never a brand): ${result.competitorWords
        .map(entry => entry.word)
        .join(', ')}`,
    )
  }
  if (result.proposal) {
    console.log(
      `  Proposal covers ${result.proposal.coverage.covered}/${result.proposal.coverage.tracked}`,
    )
    for (const change of result.proposal.gained) {
      console.log(`    + ${change.term}: ${change.from} → ${change.to}`)
    }
    for (const change of result.proposal.lost) {
      console.log(`    - ${change.term}: ${change.from} → ${change.to}`)
    }
    for (const issue of result.proposal.issues) {
      console.log(`    ! ${issue.message}`)
    }
  }
}

function suggestCommand() {
  return withJson(
    new Command('suggest')
      .description(
        'suggest the title, subtitle, keyword field and other indexed listing text from tracked keywords, for one app or every app',
      )
      .argument('[appId]', 'AppSkyline app id; every app when omitted')
      .option('--store <store>', STORES.join(' | '))
      .option('--country <country>', 'two-letter market, e.g. ES')
      .option('--language <language>', 'listing language, e.g. es')
      .option(
        '--refresh-demand',
        'refresh stale keyword demand from DataForSEO (may spend credits)',
      )
      .option(
        '--title <text>',
        'check a proposed title (needs appId and --store)',
      )
      .option('--subtitle <text>', 'check a proposed App Store subtitle')
      .option(
        '--keywords <text>',
        'check a proposed App Store keyword field or Microsoft Store search terms',
      )
      .option(
        '--short-description <text>',
        'check a proposed Google Play short description',
      ),
  ).action(async (appId, options) => {
    try {
      if (options.store && !STORES.includes(options.store)) {
        throw new Error(`--store must be one of: ${STORES.join(', ')}`)
      }
      const query = new URLSearchParams()
      for (const [name, value] of Object.entries({
        appId,
        store: options.store,
        country: options.country,
        language: options.language,
        demand: options.refreshDemand ? 'refresh' : undefined,
      })) {
        if (value !== undefined) query.set(name, value)
      }
      for (const [option, name] of Object.entries(PROPOSAL_OPTIONS)) {
        if (options[option] !== undefined) query.set(name, options[option])
      }

      const result = await api.get(`/api/metadatasuggestions?${query}`)
      if (options.json) {
        printJson(result)
      } else {
        console.log(
          `Metadata suggestions: ${result.results.length} listing(s) across ${result.totalApps} app(s)`,
        )
        result.results.forEach(printResult)
        if (!result.complete) {
          console.log(
            '\nSome listings were deferred; run again with their appId.',
          )
        }
      }
      if (!result.complete) process.exitCode = 1
    } catch (error) {
      fail(error, { json: options.json })
    }
  })
}

export default function metadataCommand() {
  return new Command('metadata')
    .description(
      'store metadata across every store: suggest titles, subtitles and keywords',
    )
    .addCommand(suggestCommand())
}
