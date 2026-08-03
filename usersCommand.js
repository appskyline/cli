/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const api = require('./request.js')
const { printJson } = require('./formatOutput.js')

function usersCommand() {
  const command = new commander.Command('users')
  command.description('list users in the current organization')

  command
    .command('list')
    .description('list users')
    .option('--json', 'print raw JSON response')
    .action(async options => {
      try {
        const users = await api.get('/api/users')
        if (options.json) {
          printJson(users)
          return
        }
        if (!users || users.length === 0) {
          console.log('No users found')
          return
        }
        console.log(`Found ${users.length} user(s):`)
        users.forEach((user, index) => {
          const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
          console.log(
            `${index + 1}. ${name || user.email || user._id} <${user.email || ''}>  ${user._id}`,
          )
        })
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  command
    .command('get <userId>')
    .description('get raw JSON for one user')
    .action(async userId => {
      try {
        const user = await api.get(`/api/users/${userId}`)
        printJson(user)
      } catch (error) {
        console.error('error', error.message)
        process.exitCode = 1
      }
    })

  return command
}

module.exports = usersCommand
