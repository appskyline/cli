/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')
const { printJson } = require('./formatOutput.js')

function rolesCommand() {
  const command = new commander.Command('roles')
  command.description('manage roles (GET/POST/DELETE /api/roles)')

  command
    .command('list')
    .description('list roles in the current organization')
    .option('--json', 'print raw JSON response')
    .action(async options => {
      try {
        const roles = await api.get('/api/roles')
        if (options.json) {
          printJson(roles)
          return
        }
        if (!roles || roles.length === 0) {
          console.log('No roles found')
          return
        }
        console.log(`Found ${roles.length} role(s):`)
        roles.forEach((role, index) => {
          console.log(
            `${index + 1}. ${role.type} — user ${role.userId} (role ${role._id})`,
          )
        })
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('add')
    .description('assign a role to a user')
    .requiredOption('--userId <userId>', 'user id')
    .requiredOption('--type <type>', 'role type (e.g. admin)')
    .action(async options => {
      try {
        const role = await api.post('/api/roles', {
          userId: options.userId,
          type: options.type,
        })
        printJson(role)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('delete <roleId>')
    .description('remove a role')
    .action(async roleId => {
      try {
        await api.del(`/api/roles?roleId=${roleId}`)
        console.log(`deleted ${roleId}`)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = rolesCommand
