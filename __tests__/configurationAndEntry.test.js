/* Copyright 2013 - 2026 Waiterio LLC */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatInspect, printInspect } from '../formatOutput.js'
import getApiUrl from '../getApiUrl.js'
import getConfig from '../getConfig.js'
import getConfigPath from '../getConfigPath.js'
import program from '../index.js'
import setConfig from '../setConfig.js'

let temporaryDirectory

beforeEach(() => {
  temporaryDirectory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'appskyline-cli-config-')),
  )
  delete process.env.APPSKYLINE_API_URL
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.APPSKYLINE_API_URL
  fs.rmSync(temporaryDirectory, { force: true, recursive: true })
})

describe('configuration discovery', () => {
  it('walks up to the nearest appskyline.json and reads real project defaults', () => {
    const projectDirectory = path.join(temporaryDirectory, 'project')
    const nestedDirectory = path.join(projectDirectory, 'packages', 'mobile')
    fs.mkdirSync(nestedDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(projectDirectory, 'appskyline.json'),
      JSON.stringify({ appId: 'app-from-project', organizationId: 'org-1' }),
    )
    vi.spyOn(process, 'cwd').mockReturnValue(nestedDirectory)

    expect(getConfigPath()).toBe(path.join(projectDirectory, 'appskyline.json'))
    expect(getConfig()).toEqual({
      appId: 'app-from-project',
      organizationId: 'org-1',
    })
  })

  it('treats missing, malformed, and JSON null configuration as empty', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(temporaryDirectory)
    expect(getConfigPath()).toBeNull()
    expect(getConfig()).toEqual({})

    const configPath = path.join(temporaryDirectory, 'appskyline.json')
    fs.writeFileSync(configPath, '{broken')
    expect(getConfig()).toEqual({})

    fs.writeFileSync(configPath, 'null')
    expect(getConfig()).toEqual({})
  })

  it('updates the discovered project file instead of creating a nested one', () => {
    const projectDirectory = path.join(temporaryDirectory, 'project')
    const nestedDirectory = path.join(projectDirectory, 'src')
    const configPath = path.join(projectDirectory, 'appskyline.json')
    fs.mkdirSync(nestedDirectory, { recursive: true })
    fs.writeFileSync(configPath, '{}')
    vi.spyOn(process, 'cwd').mockReturnValue(nestedDirectory)

    expect(setConfig({ appId: 'updated-app' })).toBe(configPath)
    expect(fs.readFileSync(configPath, 'utf8')).toBe(
      '{\n  "appId": "updated-app"\n}\n',
    )
    expect(fs.existsSync(path.join(nestedDirectory, 'appskyline.json'))).toBe(
      false,
    )
  })

  it('creates appskyline.json in cwd when no project file exists', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(temporaryDirectory)

    const configPath = setConfig({ appId: 'new-app' })

    expect(configPath).toBe(path.join(temporaryDirectory, 'appskyline.json'))
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({
      appId: 'new-app',
    })
  })
})

describe('public CLI entry contract', () => {
  it('uses production by default and permits an explicit staging API URL', () => {
    expect(getApiUrl()).toBe('https://api.appskyline.com')

    process.env.APPSKYLINE_API_URL = 'https://staging-api.example.com'
    expect(getApiUrl()).toBe('https://staging-api.example.com')
  })

  it('exports the complete command tree without parsing on import', () => {
    expect(program.name()).toBe('appskyline')
    expect(program.version()).toMatch(/^\d+\.\d+\.\d+$/)
    expect(program.commands.map(command => command.name())).toEqual(
      expect.arrayContaining([
        'signup',
        'login',
        'logout',
        'apps',
        'keywords',
        'search',
        'rank',
        'ios-app-store',
        'macos-app-store',
        'google-play',
        'microsoft-store',
        'skills',
        'schema',
      ]),
    )
  })

  it('offers the login from another device', () => {
    const login = program.commands.find(command => command.name() === 'login')

    // agentfirst adds --device only when it is given the API URL.
    expect(login.options.map(option => option.long)).toEqual(
      expect.arrayContaining(['--browser', '--device', '--with-key']),
    )
  })

  it('keeps private workspace code out of published runtime dependencies', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    )

    expect(Object.keys(packageJson.dependencies)).toEqual([
      'commander',
      'fs-extra',
      'inquirer',
      'node-localstorage',
    ])
    expect(packageJson.devDependencies.vitest).toBe('catalog:')
    expect(packageJson.files).toEqual(['bin', 'dist', 'skills'])
    expect(packageJson.bin).toEqual({ appskyline: './bin/appskyline.js' })
  })

  it('provides a readable terminal inspector for nested API documents', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const value = { app: { name: 'Cafe POS' }, ranks: [2, 5] }

    expect(formatInspect(value)).toContain('Cafe POS')
    expect(formatInspect(value)).toContain('ranks')
    printInspect(value)
    expect(log).toHaveBeenCalledWith(formatInspect(value))
  })
})
