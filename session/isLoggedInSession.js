/* Copyright 2013 - 2024 Waiterio LLC */
const getAccessToken = require('./getAccessToken.js')
const getRefreshToken = require('./getRefreshToken.js')

module.exports = function isLoggedInSession() {
  return Boolean(getAccessToken() && getRefreshToken())
}
