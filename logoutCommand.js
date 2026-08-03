/* Copyright 2013 - 2024 Waiterio LLC */
const commander = require('commander')
const clearSession = require('./session/clearSession.js')

function logoutCommand() {
  const command = new commander.Command('logout')
  command.description('log out from your appskyline.com account')
  command.action(async () => {
    try {
      console.log('logout')
      clearSession()
      console.log('logged out')
    } catch (error) {
      console.error('error', error.message)
      process.exitCode = 1
    }
  })

  return command
}

module.exports = logoutCommand
