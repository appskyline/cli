/* Copyright 2013 - 2026 Waiterio LLC */
import { readFile, stat } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'

import { fail, printJson, withJson } from '@monorepool/agentfirst/output.js'

import { printInspect } from './formatOutput.js'
import api from './request.js'
import uploadGooglePlayBundle from './uploadGooglePlayBundle.js'

const base = appId => `/api/apps/${encodeURIComponent(appId)}/google-play`
const editPath = (appId, editId) =>
  `${base(appId)}/edits/${encodeURIComponent(editId)}`
const trackQuery = options =>
  `?${new URLSearchParams({ track: options.track })}`
const trackOption = command =>
  command.option('--track <track>', 'Google Play track', 'production')
const editOption = command =>
  command.requiredOption('--edit <id>', 'existing Google Play edit ID')

function action(command, handler) {
  withJson(command).action(async (appId, options) => {
    try {
      const result = await handler(appId, options)
      if (options.json) printJson(result)
      else printInspect(result)
    } catch (error) {
      if (options.json) {
        process.stderr.write(
          `${JSON.stringify({ error: { message: error.body?.message || error.message, status: error.status, details: error.body?.details }, editId: options.edit || error.body?.details?.editId })}\n`,
        )
        process.exitCode = 1
      } else fail(error, options)
    }
  })
}
function releaseOptions(command) {
  return trackOption(command)
    .requiredOption(
      '--version-code <codes...>',
      'Android version codes; include every artifact to retain',
    )
    .option(
      '--status <status>',
      'draft | completed | inProgress | halted',
      'completed',
    )
    .option('--fraction <fraction>', 'rollout fraction for inProgress/halted')
    .option('--name <name>', 'release name')
    .option('--notes <file>', 'JSON array of {language, text} release notes')
}
async function releaseInput(options) {
  return {
    versionCodes: options.versionCode,
    status: options.status,
    ...(options.fraction !== undefined
      ? { userFraction: Number(options.fraction) }
      : {}),
    ...(options.name !== undefined ? { name: options.name } : {}),
    ...(options.notes
      ? { releaseNotes: JSON.parse(await readFile(options.notes, 'utf8')) }
      : {}),
  }
}

export async function watchReleases(appId, options) {
  const interval = Number(options.interval)
  const timeout = Number(options.timeout)
  if (
    !Number.isFinite(interval) ||
    interval < 1 ||
    !Number.isFinite(timeout) ||
    timeout <= 0
  ) {
    throw new Error(
      'interval must be at least 1 second and timeout must be positive',
    )
  }
  if (!/^[1-9]\d*$/.test(options.versionCode)) {
    throw new Error('version-code must be a positive integer')
  }
  const deadline = Date.now() + timeout * 1000
  while (true) {
    const result = await api.get(
      `${base(appId)}/releases${trackQuery(options)}`,
    )
    const matches = result.releases.filter(release =>
      release.activeArtifacts?.some(
        artifact => String(artifact.versionCode) === options.versionCode,
      ),
    )
    const states = matches.map(release =>
      release.releaseLifecycleState?.replace(/^RELEASE_LIFECYCLE_STATE_/, ''),
    )
    let outcome
    if (states.includes('NOT_APPROVED')) outcome = 'rejected'
    else if (
      states.some(state =>
        ['NOT_SENT_FOR_REVIEW', 'APPROVED_NOT_PUBLISHED'].includes(state),
      )
    ) {
      outcome = 'console-required'
    } else if (states.length && states.every(state => state === 'PUBLISHED')) {
      outcome = 'published'
    } else if (Date.now() >= deadline) outcome = 'timeout'
    if (outcome) {
      if (outcome !== 'published') process.exitCode = 1
      return {
        ...result,
        matchedReleases: matches,
        versionCode: options.versionCode,
        outcome,
      }
    }
    await sleep(Math.min(interval * 1000, Math.max(0, deadline - Date.now())))
  }
}

export default function googlePlayPublishingCommands(command) {
  const credentials = command
    .command('credentials')
    .description('Check saved Google Play credentials')
  action(
    trackOption(
      credentials
        .command('check <appId>')
        .description('Verify release-read access without opening an edit'),
    ),
    (id, options) =>
      api.get(`${base(id)}/credentials/check${trackQuery(options)}`),
  )
  const releases = command
    .command('releases')
    .description('Inspect Google Play review lifecycle')
  action(
    trackOption(
      releases
        .command('list <appId>')
        .description('List current releases and review states'),
    ),
    (id, options) => api.get(`${base(id)}/releases${trackQuery(options)}`),
  )
  action(
    trackOption(
      releases
        .command('watch <appId>')
        .description(
          'Wait for one version; nonzero exit on rejection, Console action, or timeout',
        ),
    )
      .requiredOption('--version-code <code>', 'version to watch')
      .option('--interval <seconds>', 'poll interval', '30')
      .option('--timeout <seconds>', 'maximum watch duration', '1800'),
    watchReleases,
  )

  const edits = command
    .command('edits')
    .description('Manage explicitly staged Google Play edits')
  action(
    edits
      .command('create <appId>')
      .description(
        'Open an edit; may invalidate an earlier edit from the same account',
      ),
    id => api.post(`${base(id)}/edits`, {}),
  )
  for (const [name, method, suffix] of [
    ['get', 'get', ''],
    ['discard', 'del', ''],
    ['validate', 'post', '/validate'],
    ['bundles', 'get', '/bundles'],
  ]) {
    action(
      editOption(
        edits
          .command(`${name} <appId>`)
          .description(`${name} an existing edit`),
      ),
      (id, options) => api[method](`${editPath(id, options.edit)}${suffix}`),
    )
  }
  action(
    editOption(
      edits
        .command('commit <appId>')
        .description(
          'Validate and commit all staged changes; does not imply publication',
        ),
    ).option(
      '--defer-review',
      'save without sending for review; requires a later Console action',
    ),
    (id, options) =>
      api.post(`${editPath(id, options.edit)}/commit`, {
        deferReview: !!options.deferReview,
      }),
  )

  const release = command
    .command('release')
    .description('Upload bundles and stage or submit releases')
  action(
    releaseOptions(
      release
        .command('plan <appId>')
        .description(
          'Read-only preview; staging replaces all releases on the selected track',
        ),
    ),
    async (id, options) =>
      api.post(
        `${base(id)}/release/plan${trackQuery(options)}`,
        await releaseInput(options),
      ),
  )
  action(
    editOption(
      release
        .command('upload <appId>')
        .description(
          'Upload a signed .aab to an existing edit without committing',
        ),
    ).requiredOption('--aab <file>', 'signed Android App Bundle'),
    async (id, options) => {
      const file = await stat(options.aab)
      if (!file.isFile() || !options.aab.endsWith('.aab') || file.size <= 0) {
        throw new Error('aab must be a nonempty .aab file')
      }
      const session = await api.post(
        `${editPath(id, options.edit)}/bundle-upload`,
        { size: file.size },
      )
      const bundle = await uploadGooglePlayBundle({
        ...session,
        file: options.aab,
        size: file.size,
        editId: options.edit,
      })
      return { appId: id, editId: options.edit, bundle, committed: false }
    },
  )
  for (const name of ['stage', 'submit']) {
    const sub = releaseOptions(
      editOption(
        release
          .command(`${name} <appId>`)
          .description(
            `${name === 'stage' ? 'Stage' : 'Stage, validate, and commit'} a release; replaces all releases on the selected track`,
          ),
      ),
    )
    if (name === 'submit') {
      sub.option('--defer-review', 'save for later Console submission')
    }
    action(sub, async (id, options) => {
      const staged = await api.put(
        `${editPath(id, options.edit)}/tracks/${encodeURIComponent(options.track)}`,
        await releaseInput(options),
      )
      if (name === 'stage') return staged
      return api.post(`${editPath(id, options.edit)}/commit`, {
        deferReview: !!options.deferReview,
      })
    })
  }
  const rollout = command
    .command('rollout')
    .description('Change an existing staged rollout, preserving other releases')
  for (const name of ['set', 'halt']) {
    const sub = trackOption(
      rollout
        .command(`${name} <appId>`)
        .description(`${name} a rollout and commit the edit`),
    ).requiredOption('--version-code <code>', 'existing rollout version')
    if (name === 'set') {
      sub.requiredOption(
        '--fraction <fraction>',
        'fraction greater than 0 through 1; 1 completes rollout',
      )
    }
    action(sub, (id, options) =>
      api.post(`${base(id)}/rollout/${encodeURIComponent(options.track)}`, {
        action: name,
        versionCode: options.versionCode,
        ...(name === 'set' ? { fraction: Number(options.fraction) } : {}),
      }),
    )
  }
  const metadata = command
    .command('metadata')
    .description('Read or stage localized store-listing text')
  action(
    editOption(
      metadata
        .command('list <appId>')
        .description('Read listings from an existing edit'),
    ),
    (id, options) => api.get(`${editPath(id, options.edit)}/listings`),
  )
  action(
    editOption(
      metadata
        .command('upload <appId>')
        .description(
          'Stage JSON {locales: [{language, title, shortDescription, fullDescription, video?}]}',
        ),
    ).requiredOption('--file <file>', 'listing JSON file'),
    async (id, options) =>
      api.put(
        `${editPath(id, options.edit)}/listings`,
        JSON.parse(await readFile(options.file, 'utf8')),
      ),
  )
  const safety = command
    .command('data-safety')
    .description('Manage the Google Play Data safety declaration')
  action(
    safety
      .command('upload <appId>')
      .description(
        'Upload Google-format Data safety CSV directly; not part of an edit',
      )
      .requiredOption('--file <file>', 'Data safety CSV file'),
    async (id, options) =>
      api.post(`${base(id)}/data-safety`, {
        safetyLabels: await readFile(options.file, 'utf8'),
      }),
  )
}
