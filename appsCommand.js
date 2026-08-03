/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')
const { printJson } = require('./formatOutput.js')

function appsCommand() {
  const command = new commander.Command('apps')
  command.description('manage apps (GET /api/apps)')

  command
    .command('list')
    .description('list apps in the current organization')
    .option('-n, --limit <limit>', 'limit number of results shown', '25')
    .option('--json', 'print raw JSON response')
    .action(async options => {
      try {
        const apps = await api.get('/api/apps')
        const limit = parseInt(options.limit, 10) || 25
        const shown = apps.slice(0, limit)

        if (options.json) {
          printJson(shown)
          return
        }

        if (shown.length === 0) {
          console.log('No apps found')
          return
        }

        console.log(`Found ${apps.length} app(s):`)
        shown.forEach((app, index) => {
          const name = app.name || app._id
          const platform = app.platform ? ` [${app.platform}]` : ''
          console.log(`${index + 1}. ${name}${platform} (${app._id})`)
        })
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('get <appId>')
    .description('get raw JSON for one app')
    .action(async appId => {
      try {
        const app = await api.get(`/api/apps/${appId}`)
        printJson(app)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('read <appId>')
    .description('read app formatted for terminal')
    .action(async appId => {
      try {
        const app = await api.get(`/api/apps/${appId}`)
        if (!app) {
          console.log('App not found')
          return
        }
        const dim = text => `\x1b[2m${text}\x1b[0m`
        const bold = text => `\x1b[1m${text}\x1b[0m`
        const cyan = text => `\x1b[36m${text}\x1b[0m`
        console.log()
        console.log(bold(app.name || app._id))
        console.log(dim(app._id))
        console.log()
        if (app.platform) console.log(`${cyan('platform')}  ${app.platform}`)
        if (app.bundleId) console.log(`${cyan('bundleId')}  ${app.bundleId}`)
        if (app.appStoreId) console.log(`${cyan('appStoreId')}  ${app.appStoreId}`)
        if (app.googlePlayId) console.log(`${cyan('googlePlayId')}  ${app.googlePlayId}`)
        if (app.microsoftStoreId) console.log(`${cyan('microsoftStoreId')}  ${app.microsoftStoreId}`)
        if (app.creationTime) console.log(`${cyan('created')}  ${app.creationTime}`)
        console.log()
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = appsCommand
