import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/**
 * The exploration walkthrough: `bun run test:explore`. Same server, database and viewports as the
 * suite, but only the explore spec, which time-travels through the database and takes longer.
 */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: /explore\.spec\.ts/,
})
