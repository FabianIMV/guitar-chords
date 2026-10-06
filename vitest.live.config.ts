import { defineConfig } from 'vitest/config'

// Live checks against the real sites (network required):
//   NODE_USE_ENV_PROXY=1 npm run test:live   (behind an HTTPS proxy)
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/live/**/*.live.ts'],
    testTimeout: 60_000,
  },
})
