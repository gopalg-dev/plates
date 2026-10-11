import { defineConfig, devices } from '@playwright/test'

export const E2E_PORT = 3100
export const E2E_DB = 'workout_plan_v3_e2e'

export default defineConfig({
  testDir: './e2e',
  // The stats flow alone has sixty-odd steps across a calendar, a chart and two dialogs.
  timeout: 150_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    // The installed Chrome. Windows App Control blocks Playwright's own Chromium build here.
    channel: 'chrome',
    // The app honours prefers-reduced-motion by cutting every transition, so clicks never wait on an animation.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `bunx vite dev --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/setup`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // Always the local Docker database, whatever .env points at (a hosted one for the dev server, say).
      MONGODB_URI: 'mongodb://localhost:27017',
      MONGODB_DB: E2E_DB,
      // Better Auth checks the request origin against this URL; the e2e server has its own port.
      BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
      BETTER_AUTH_SECRET: 'e2e-only-secret-that-is-at-least-32-characters-long',
      // No mail provider in tests: links and codes stay in the outbox collection, where the flows read them.
      RESEND_API_KEY: '',
    },
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
})
