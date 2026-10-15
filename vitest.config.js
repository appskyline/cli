/* Copyright 2013 - 2026 Waiterio LLC */
import createVitestConfig from '@monorepool/root/vitest.createConfig.js' // eslint-disable-line import/extensions

export default createVitestConfig({
  include: ['__tests__/**/*.test.js'],
  exclude: ['**/node_modules/**', '**/dist/**'],
  coverage: {
    include: ['*.js'],
    thresholds: {
      statements: 90,
      branches: 90,
      functions: 98,
      lines: 90,
    },
  },
})
