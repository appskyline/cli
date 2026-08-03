/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const { withJson, printJson, fail } = require('@monorepool/agentfirst/output.js')
const api = require('./request.js')
const getConfig = require('./getConfig.js')
const { printInspect } = require('./formatOutput.js')

function keywordsCommand() {
  const command = new commander.Command('keywords')
  command.description('manage tracked keywords (GET/POST/PUT /api/keywords)')

  withJson(
    command
      .command('list')
      .description('list keywords for an app')
      .option('--appId <appId>', 'app id (or read from appskyline.json)')
      .option('-n, --limit <limit>', 'page size', '50')
      .option('--skip <skip>', 'offset for pagination', '0'),
  ).action(async options => {
    try {
      const appId = options.appId || getConfig().appId
      if (!appId) {
        fail(new Error('--appId required (or add appId to appskyline.json)'), {
          json: options.json,
        })
        return
      }
      const params = new URLSearchParams({
        appId,
        limit: options.limit,
        skip: options.skip,
      })
      const keywords = await api.get(`/api/keywords?${params}`)

      if (options.json) {
        printJson(keywords)
        return
      }

      if (!keywords || keywords.length === 0) {
        console.log('No keywords found')
        return
      }

      console.log(`Found ${keywords.length} keyword(s):`)
      keywords.forEach((keyword, index) => {
        const term = keyword.searchTerms || keyword._id
        const locale =
          keyword.language || keyword.country
            ? ` (${[keyword.language, keyword.country].filter(Boolean).join('-')})`
            : ''
        console.log(`${index + 1}. ${term}${locale}  ${keyword._id}`)
      })
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('get <keywordId>')
      .description('get raw JSON for one keyword'),
  ).action(async (keywordId, options) => {
    try {
      const keyword = await api.get(`/api/keywords/${keywordId}`)

      if (options.json) {
        printJson(keyword)
        return
      }

      printInspect(keyword)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('add')
      .description('add a new tracked keyword')
      .requiredOption('--term <term>', 'search terms')
      .option('--appId <appId>', 'app id (or read from appskyline.json)')
      .option('--lang <language>', 'language code (e.g. en, it)')
      .option('--country <country>', 'country code (e.g. US, IT)'),
  ).action(async options => {
    try {
      const appId = options.appId || getConfig().appId
      if (!appId) {
        fail(new Error('--appId required (or add appId to appskyline.json)'), {
          json: options.json,
        })
        return
      }
      const body = {
        appId,
        searchTerms: options.term,
        language: options.lang,
        country: options.country,
      }
      const keyword = await api.post('/api/keywords', body)

      if (options.json) {
        printJson({ ok: true, id: keyword?._id })
        return
      }

      printInspect(keyword)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('update <keywordId>')
      .description('update an existing keyword (passes raw body as JSON)')
      .requiredOption('--body <json>', 'JSON body with fields to update'),
  ).action(async (keywordId, options) => {
    try {
      const body = JSON.parse(options.body)
      body._id = keywordId
      const keyword = await api.put('/api/keywords', body)

      if (options.json) {
        printJson({ ok: true, id: keywordId })
        return
      }

      printInspect(keyword)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('delete <keywordId...>')
      .description('delete one or more keywords'),
  ).action(async (keywordIds, options) => {
    try {
      await Promise.all(
        keywordIds.map(id =>
          api.del(`/api/keywords/${id}`).then(() => {
            if (!options.json) {
              console.log(`deleted ${id}`)
            }
          }),
        ),
      )

      if (options.json) {
        printJson({ ok: true, deleted: keywordIds })
      }
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('overview')
      .description(
        'Google search overview (volume, CPC, competition, difficulty) for one or more terms in a country',
      )
      .requiredOption('--country <country>', 'country code (e.g. ES, US, IT)')
      .requiredOption(
        '--terms <terms>',
        'comma-separated keyword terms (max 100 per request)',
      )
      .option('--lang <lang>', 'language code (e.g. es, en, it)'),
  ).action(async options => {
    try {
      const params = new URLSearchParams({ terms: options.terms })
      if (options.lang) params.set('lang', options.lang)
      const country = String(options.country).toUpperCase()
      const rows = await api.get(
        `/api/dataforseo-keywords/${country}?${params}`,
      )

      if (options.json) {
        printJson(rows)
        return
      }

      if (!rows || rows.length === 0) {
        console.log('No results')
        return
      }

      const sorted = [...rows].sort((a, b) => {
        const av = a.searchVolume ?? -1
        const bv = b.searchVolume ?? -1
        return bv - av
      })

      const formatNumber = v =>
        v === null || v === undefined ? '—' : String(v)
      const header = ['keyword', 'volume', 'cpc', 'comp', 'difficulty']
      const text = sorted.map(r => [
        r.keyword,
        formatNumber(r.searchVolume),
        r.cpc !== null && r.cpc !== undefined ? r.cpc.toFixed(2) : '—',
        r.competitionLevel || formatNumber(r.competition),
        formatNumber(r.keywordDifficulty),
      ])
      const widths = header.map((h, i) =>
        Math.max(h.length, ...text.map(r => String(r[i]).length)),
      )
      const fmt = cells =>
        cells.map((c, i) => String(c).padEnd(widths[i])).join('  ')
      console.log(fmt(header))
      console.log(widths.map(w => '-'.repeat(w)).join('  '))
      text.forEach(r => console.log(fmt(r)))
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  withJson(
    command
      .command('translate')
      .description('translate a keyword into multiple locales')
      .requiredOption('--term <term>', 'source search terms')
      .requiredOption(
        '--locales <locales>',
        'comma-separated locales (e.g. "it,es,de")',
      )
      .option('--appId <appId>', 'app id (or read from appskyline.json)'),
  ).action(async options => {
    try {
      const appId = options.appId || getConfig().appId
      if (!appId) {
        fail(new Error('--appId required (or add appId to appskyline.json)'), {
          json: options.json,
        })
        return
      }
      const body = {
        appId,
        searchTerms: options.term,
        locales: options.locales.split(',').map(l => l.trim()),
      }
      const result = await api.post('/api/keywords/translate', body)

      if (options.json) {
        printJson({ ok: true, result })
        return
      }

      printInspect(result)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = keywordsCommand
