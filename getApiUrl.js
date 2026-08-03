/* Copyright 2013 - 2024 Waiterio LLC */

// Production appskyline API. Override with APPSKYLINE_API_URL for staging/dev.
module.exports = function getApiUrl() {
  return process.env.APPSKYLINE_API_URL || 'https://api.appskyline.com'
}
