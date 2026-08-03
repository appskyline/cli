/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')
const { printJson } = require('./formatOutput.js')

function invitesCommand() {
  const command = new commander.Command('invites')
  command.description('manage invites (GET/POST /api/invites)')

  command
    .command('list')
    .description('list pending invites in the current organization')
    .option('--json', 'print raw JSON response')
    .action(async options => {
      try {
        const invites = await api.get('/api/invites')
        if (options.json) {
          printJson(invites)
          return
        }
        if (!invites || invites.length === 0) {
          console.log('No pending invites')
          return
        }
        console.log(`Found ${invites.length} invite(s):`)
        invites.forEach((invite, index) => {
          console.log(
            `${index + 1}. ${invite.email} [${invite.roleType || '?'}]  ${invite._id}`,
          )
        })
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('add')
    .description('invite a user by email')
    .requiredOption('--email <email>', 'email address to invite')
    .option('--type <type>', 'role type (e.g. admin)', 'admin')
    .option('--locale <locale>', 'preferred locale (e.g. en)')
    .action(async options => {
      try {
        const invite = await api.post('/api/invites', {
          email: options.email,
          roleType: options.type,
          localeMotherTongue: options.locale,
        })
        printJson(invite)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('delete <inviteId>')
    .description('revoke an invite')
    .action(async inviteId => {
      try {
        await api.del(`/api/invites/${inviteId}`)
        console.log(`deleted ${inviteId}`)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = invitesCommand
