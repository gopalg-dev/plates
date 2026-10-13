import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

export const PICTURES_PORT = 3200
export const PICTURES_DB = 'workout_plan_v3_pictures'

/**
 * The guide's screenshots and the share card: `node node_modules/@playwright/test/cli.js test --config
 * playwright.pictures.config.ts` (see scripts/guide-pictures.spec.ts). Its own server, port and database (empty: the
 * library seeds itself), so it never meets the e2e suite.
 */
export default defineConfig({
  ...base,
  testDir: './scripts',
  testIgnore: undefined,
  testMatch: /guide-pictures\.spec\.ts/,
  use: { ...base.use, baseURL: `http://localhost:${PICTURES_PORT}` },
  // The production build: the dev server serves each demo window the app's files one by one, and with two windows
  // loading at once one of them can stall.
  webServer: {
    command: `node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port ${PICTURES_PORT}`,
    url: `http://localhost:${PICTURES_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      MONGODB_URI: 'mongodb://localhost:27017',
      MONGODB_DB: PICTURES_DB,
      BETTER_AUTH_URL: `http://localhost:${PICTURES_PORT}`,
      BETTER_AUTH_SECRET: 'pictures-only-secret-that-is-at-least-32-characters',
      RESEND_API_KEY: '',
    },
  },
  // 1200 x 630 at 1x: the size LinkedIn, WhatsApp and Slack unfurl a link into. The screenshots open their own phone.
  projects: [
    {
      name: 'pictures',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 },
    },
  ],
})
