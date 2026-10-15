/* Copyright 2013 - 2026 Waiterio LLC */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import appsCommand from '../appsCommand.js'
import invitesCommand from '../invitesCommand.js'
import rolesCommand from '../rolesCommand.js'
import usersCommand from '../usersCommand.js'
import zapierHooksCommand from '../zapierHooksCommand.js'
import { captureOutput, readJson, run } from './testHarness.js'

const api = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('../request.js', () => ({ default: api }))

let output

const failureCases = [
  ['apps get', appsCommand, 'get', ['get', 'app-1']],
  ['apps read', appsCommand, 'get', ['read', 'app-1']],
  ['users list', usersCommand, 'get', ['list']],
  ['users get', usersCommand, 'get', ['get', 'user-1']],
  ['roles list', rolesCommand, 'get', ['list']],
  [
    'roles add',
    rolesCommand,
    'post',
    ['add', '--userId', 'user-1', '--type', 'editor'],
  ],
  ['roles delete', rolesCommand, 'del', ['delete', 'role-1']],
  ['invites list', invitesCommand, 'get', ['list']],
  [
    'invites add',
    invitesCommand,
    'post',
    ['add', '--email', 'test@example.com', '--type', 'viewer'],
  ],
  ['invites delete', invitesCommand, 'del', ['delete', 'invite-1']],
  [
    'hooks add',
    zapierHooksCommand,
    'post',
    [
      'add',
      '--url',
      'https://hooks.example.com/event',
      '--event',
      'KEYWORD_ADDED',
    ],
  ],
  ['hooks delete', zapierHooksCommand, 'del', ['delete', 'hook-1']],
]

describe('organization command API failures', () => {
  it.each(failureCases)(
    '%s returns a machine-readable failure without claiming success',
    async (_name, command, method, args) => {
      api[method].mockRejectedValue(
        Object.assign(new Error('service unavailable'), { status: 503 }),
      )

      await run(command(), [...args, '--json'])

      expect(JSON.parse(output.stderr.join(''))).toEqual({
        error: { message: 'service unavailable', status: 503 },
      })
      expect(process.exitCode).toBe(1)
      expect(output.stdout).toEqual([])
      expect(api[method]).toHaveBeenCalledOnce()
    },
  )
})

beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset())
  output = captureOutput()
  process.exitCode = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = 0
})

describe('apps commands', () => {
  const apps = [
    {
      _id: 'app-ios',
      name: 'Cafe POS',
      platform: 'IOS',
      bundleId: 'com.example.cafe',
      appStoreId: '123456',
      googlePlayId: 'com.example.cafe',
      microsoftStoreId: '9NCAFE',
      creationTime: '2026-07-04T10:00:00.000Z',
    },
    { _id: 'app-unnamed' },
  ]

  it('lists a bounded human-readable page and exposes raw JSON to agents', async () => {
    api.get.mockResolvedValueOnce(apps)
    await run(appsCommand(), ['list', '--limit', '1'])

    expect(api.get).toHaveBeenCalledWith('/api/apps')
    expect(output.logs).toEqual([
      'Found 2 app(s):',
      '1. Cafe POS [IOS] (app-ios)',
    ])

    api.get.mockResolvedValueOnce(apps)
    await run(appsCommand(), ['list', '--limit', 'not-a-number', '--json'])
    expect(readJson(output)).toEqual(apps)
  })

  it('distinguishes an empty organization from an API failure', async () => {
    api.get.mockResolvedValueOnce([])
    await run(appsCommand(), ['list'])
    expect(output.logs).toContain('No apps found')

    output.stdout.length = 0
    api.get.mockRejectedValueOnce(
      Object.assign(new Error('GET /api/apps → 503: unavailable'), {
        status: 503,
      }),
    )
    await run(appsCommand(), ['list', '--json'])

    expect(JSON.parse(output.stderr.at(-1))).toEqual({
      error: {
        message: 'GET /api/apps → 503: unavailable',
        status: 503,
      },
    })
    expect(process.exitCode).toBe(1)
  })

  it('gets raw app data and renders every known store identifier', async () => {
    api.get.mockResolvedValueOnce(apps[0])
    await run(appsCommand(), ['get', 'app-ios', '--json'])
    expect(api.get).toHaveBeenLastCalledWith('/api/apps/app-ios')
    expect(readJson(output)).toEqual(apps[0])

    api.get.mockResolvedValueOnce(apps[0])
    await run(appsCommand(), ['read', 'app-ios'])
    expect(output.logs.join('\n')).toContain('Cafe POS')
    expect(output.logs.join('\n')).toContain('com.example.cafe')
    expect(output.logs.join('\n')).toContain('9NCAFE')

    api.get.mockResolvedValueOnce(null)
    await run(appsCommand(), ['read', 'missing'])
    expect(output.logs).toContain('App not found')
  })

  it('renders sparse legacy app records without undefined field labels', async () => {
    api.get.mockResolvedValueOnce({ _id: 'legacy-app' })

    await run(appsCommand(), ['read', 'legacy-app'])

    const rendered = output.logs.join('\n')
    expect(rendered).toContain('legacy-app')
    expect(rendered).not.toContain('platform')
    expect(rendered).not.toContain('bundleId')
    expect(rendered).not.toContain('appStoreId')
    expect(rendered).not.toContain('googlePlayId')
    expect(rendered).not.toContain('microsoftStoreId')
    expect(rendered).not.toContain('created')
  })
})

describe('organization membership commands', () => {
  it.each([
    ['users', usersCommand],
    ['roles', rolesCommand],
    ['invites', invitesCommand],
  ])('preserves raw %s records in JSON listings', async (_name, command) => {
    const records = [{ _id: 'record-1', customField: 'kept' }]
    api.get.mockResolvedValue(records)
    await run(command(), ['list', '--json'])
    expect(readJson(output)).toEqual(records)
    expect(output.logs).toEqual([])
  })

  it('prints created roles and webhooks for interactive use', async () => {
    api.post
      .mockResolvedValueOnce({ _id: 'role-new' })
      .mockResolvedValueOnce({ _id: 'hook-new' })
    await run(rolesCommand(), ['add', '--userId', 'user-1', '--type', 'editor'])
    await run(zapierHooksCommand(), [
      'add',
      '--url',
      'https://hooks.example.com/event',
    ])
    expect(output.logs.join('\n')).toContain('role-new')
    expect(output.logs.join('\n')).toContain('hook-new')
  })

  it.each([
    ['role', rolesCommand, '/api/roles?roleId=record-1'],
    ['hook', zapierHooksCommand, '/api/zapier/hooks?zapierHookId=record-1'],
  ])('returns the deleted %s id in JSON mode', async (_name, command, url) => {
    api.del.mockResolvedValue(null)
    await run(command(), ['delete', 'record-1', '--json'])
    expect(api.del).toHaveBeenCalledWith(url)
    expect(readJson(output)).toEqual({ ok: true, id: 'record-1' })
  })

  it('uses the default invitation role and reports the created id to scripts', async () => {
    api.post.mockResolvedValue({ _id: 'invite-new' })
    await run(invitesCommand(), [
      'add',
      '--email',
      'owner@example.com',
      '--json',
    ])
    expect(api.post).toHaveBeenCalledWith('/api/invites', {
      email: 'owner@example.com',
      roleType: 'admin',
      localeMotherTongue: undefined,
    })
    expect(readJson(output)).toEqual({ ok: true, id: 'invite-new' })
    api.del.mockResolvedValue(null)
    await run(invitesCommand(), ['delete', 'invite-new'])
    expect(output.logs).toContain('deleted invite-new')
  })

  it('lists user identities and retrieves one complete user document', async () => {
    const users = [
      {
        _id: 'user-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
      { _id: 'user-2', email: 'ops@example.com' },
      { _id: 'user-3' },
    ]
    api.get.mockResolvedValueOnce(users)
    await run(usersCommand(), ['list'])

    expect(output.logs).toContain('Found 3 user(s):')
    expect(output.logs.join('\n')).toContain('Ada Lovelace')
    expect(output.logs.join('\n')).toContain('ops@example.com')
    expect(output.logs.join('\n')).toContain('user-3')

    output.stdout.length = 0
    api.get.mockResolvedValueOnce(users[0])
    await run(usersCommand(), ['get', 'user-1', '--json'])
    expect(api.get).toHaveBeenLastCalledWith('/api/users/user-1')
    expect(readJson(output)).toEqual(users[0])

    api.get.mockResolvedValueOnce([])
    await run(usersCommand(), ['list'])
    expect(output.logs).toContain('No users found')
  })

  it('lists, assigns, and removes roles using the API contract', async () => {
    api.get.mockResolvedValueOnce([
      { _id: 'role-1', type: 'admin', userId: 'user-1' },
    ])
    await run(rolesCommand(), ['list'])
    expect(output.logs.join('\n')).toContain(
      '1. admin — user user-1 (role role-1)',
    )

    output.stdout.length = 0
    api.post.mockResolvedValueOnce({ _id: 'role-2' })
    await run(rolesCommand(), [
      'add',
      '--userId',
      'user-2',
      '--type',
      'editor',
      '--json',
    ])
    expect(api.post).toHaveBeenCalledWith('/api/roles', {
      type: 'editor',
      userId: 'user-2',
    })
    expect(readJson(output)).toEqual({ id: 'role-2', ok: true })

    api.del.mockResolvedValueOnce(null)
    await run(rolesCommand(), ['delete', 'role-1'])
    expect(api.del).toHaveBeenCalledWith('/api/roles?roleId=role-1')
    expect(output.logs).toContain('deleted role-1')

    api.get.mockResolvedValueOnce(null)
    await run(rolesCommand(), ['list'])
    expect(output.logs).toContain('No roles found')
  })

  it('lists, creates, and revokes invitations without changing field names', async () => {
    api.get.mockResolvedValueOnce([
      {
        _id: 'invite-1',
        email: 'owner@example.com',
        roleType: 'admin',
      },
      { _id: 'invite-2', email: 'viewer@example.com' },
    ])
    await run(invitesCommand(), ['list'])
    expect(output.logs.join('\n')).toContain('owner@example.com [admin]')
    expect(output.logs.join('\n')).toContain('viewer@example.com [?]')

    api.post.mockResolvedValueOnce({ _id: 'invite-3' })
    await run(invitesCommand(), [
      'add',
      '--email',
      'new@example.com',
      '--type',
      'viewer',
      '--locale',
      'it',
    ])
    expect(api.post).toHaveBeenCalledWith('/api/invites', {
      email: 'new@example.com',
      localeMotherTongue: 'it',
      roleType: 'viewer',
    })
    expect(output.logs.join('\n')).toContain('invite-3')

    output.stdout.length = 0
    api.del.mockResolvedValueOnce(null)
    await run(invitesCommand(), ['delete', 'invite-1', '--json'])
    expect(api.del).toHaveBeenCalledWith('/api/invites/invite-1')
    expect(readJson(output)).toEqual({ id: 'invite-1', ok: true })

    api.get.mockResolvedValueOnce([])
    await run(invitesCommand(), ['list'])
    expect(output.logs).toContain('No pending invites')
  })
})

describe('Zapier webhook commands', () => {
  it('registers and deletes hooks using the documented query parameter', async () => {
    api.post.mockResolvedValueOnce({ _id: 'hook-1' })
    await run(zapierHooksCommand(), [
      'add',
      '--url',
      'https://hooks.example.com/keyword',
      '--event',
      'KEYWORD_ADDED',
      '--json',
    ])
    expect(api.post).toHaveBeenCalledWith('/api/zapier/hooks', {
      event: 'KEYWORD_ADDED',
      url: 'https://hooks.example.com/keyword',
    })
    expect(readJson(output)).toEqual({ id: 'hook-1', ok: true })

    api.del.mockResolvedValueOnce(null)
    await run(zapierHooksCommand(), ['delete', 'hook-1'])
    expect(api.del).toHaveBeenCalledWith(
      '/api/zapier/hooks?zapierHookId=hook-1',
    )
    expect(output.logs).toContain('deleted hook-1')
  })
})
