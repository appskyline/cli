/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const { withJson, printJson, fail } = require('@monorepool/agentfirst/output.js')
const api = require('./request.js')
const { printInspect } = require('./formatOutput.js')

function usersCommand() {
  const command = new commander.Command('users')
  command.description('list users in the current organization')

  withJson(command.command('list').description('list users')).action(
    async options => {
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
        fail(error, { json: options.json })
      }
    },
  )

  withJson(
    command.command('get <userId>').description('get raw JSON for one user'),
  ).action(async (userId, options) => {
    try {
      const user = await api.get(`/api/users/${userId}`)

      if (options.json) {
        printJson(user)
        return
      }

      printInspect(user)
    } catch (error) {
      fail(error, { json: options.json })
    }
  })

  return command
}

module.exports = usersCommand
