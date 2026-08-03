/* Copyright 2013 - 2024 Waiterio LLC */
const setAccessToken = require('./setAccessToken.js')
const setRefreshToken = require('./setRefreshToken.js')

module.exports = function storeNewSession({ accessToken, refreshToken }) {
  setAccessToken(accessToken)
  setRefreshToken(refreshToken)
}
