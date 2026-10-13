import fs from 'node:fs'
import { type Browser, expect, type Page, test } from '@playwright/test'
import { MongoClient } from 'mongodb'
import { PICTURES_DB } from '../playwright.pictures.config'

/**
 * The guide's pictures, taken from the demo screens (`/demo/<screen>`: the app's own pieces on made-up numbers):
 * the phone screenshots its sections show (`public/guide/<screen>-light.webp` and `-dark.webp`, drawn by `Shot`),
 * then the share card a link unfurls into (`public/og.png`, named by the og tags in `src/routes/__root.tsx`). Take
 * them again after a screen they show changes:
 *
 *   node node_modules/@playwright/test/cli.js test --config playwright.pictures.config.ts
 *
 * Needs the local MongoDB (bun run db:up). Not part of the e2e suite.
 */

test.describe.configure({ mode: 'serial' })

const SHOTS = ['zen', 'plan', 'lifts', 'body'] as const

test.afterAll(async () => {
  const client = await MongoClient.connect('mongodb://localhost:27017')
  await client.db(PICTURES_DB).dropDatabase()
  await client.close()
})

/** Waits for the page's React and for every picture on it: the exercise stills load lazily from another host. */
async function settled(page: Page) {
  await page.locator('html[data-page-hydrated="true"]').waitFor({ state: 'attached' })
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const img of document.images) img.loading = 'eager'
    await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)))
  })
}

/** One demo screen as an iPhone 15 Pro shows it, 393 x 852 at its 3x, re-encoded as WebP by the browser itself. */
async function shoot(browser: Browser, screen: (typeof SHOTS)[number], scheme: 'light' | 'dark') {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 })
  const page = await context.newPage()
  await page.emulateMedia({ colorScheme: scheme })
  await page.goto(`/demo/${screen}`)
  await settled(page)
  // The demo draws once it is in the browser; a moment for its charts to lay out.
  await page.waitForTimeout(500)
  await settled(page)
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide' })
  const webp = await page.evaluate(async (base64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${base64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')?.drawImage(img, 0, 0)
    // High enough that small text keeps its edges.
    return canvas.toDataURL('image/webp', 0.92).split(',')[1]
  }, png.toString('base64'))
  fs.writeFileSync(`public/guide/${screen}-${scheme}.webp`, Buffer.from(webp, 'base64'))
  await context.close()
}

test('the screenshots', async ({ browser }) => {
  fs.mkdirSync('public/guide', { recursive: true })
  for (const scheme of ['light', 'dark'] as const) {
    for (const screen of SHOTS) await shoot(browser, screen, scheme)
  }
})

test('the share card', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await settled(page)
  const live = page.frameLocator('iframe[title="Try it: Plates on made-up numbers"]')
  await expect(live.locator('html[data-page-hydrated="true"]')).toBeAttached()
  // The card: the wordmark and the welcome's line, the live phone, and the Stats screenshot beside it.
  await page.evaluate(() => {
    const phone = document.querySelector('iframe[title^="Try it"]')?.parentElement?.parentElement
    const stats = document.querySelector<HTMLElement>('#stats figure')
    if (!phone || !stats) throw new Error('The welcome phone or the Stats screenshot is missing')
    for (const img of stats.querySelectorAll('img')) img.loading = 'eager'
    const frame = document.createElement('div')
    frame.style.cssText =
      'width: 1200px; height: 630px; overflow: hidden; display: flex; align-items: center; gap: 56px; ' +
      'padding: 0 72px; background: var(--background); color: var(--foreground);'
    frame.innerHTML = `
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 18px;">
          <img src="/favicon.svg" width="76" height="76" alt="">
          <span class="font-condensed" style="font-size: 88px; font-weight: 600; line-height: 1;">Plates</span>
        </div>
        <p style="margin-top: 28px; font-size: 38px; line-height: 1.2; color: var(--muted-foreground);">
          A gym logbook for the time between sets.
        </p>
      </div>
      <div data-phones style="display: flex; gap: 28px; align-self: flex-start;"></div>`
    for (const [i, el] of [phone, stats].entries()) {
      el.style.width = '270px'
      el.style.margin = `${i === 0 ? 48 : 112}px 0 0`
      frame.querySelector('[data-phones]')?.append(el)
    }
    document.body.replaceChildren(frame)
  })
  // Moved, the live phone's window loads again.
  await expect(live.locator('html[data-page-hydrated="true"]')).toBeAttached()
  for (const frame of page.frames().filter((f) => f.url().includes('/demo/'))) {
    await frame.evaluate(async () => {
      for (const img of document.images) img.loading = 'eager'
      await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)))
    })
  }
  await settled(page)
  // A frame for the phone to measure its new width and draw at it.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.screenshot({ path: 'public/og.png' })
})
