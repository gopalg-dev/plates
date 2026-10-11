// Temporary diagnostic: loads a page in headless Chrome and prints console output, page errors and
// whether React mounted (the root component sets data-hydrated on <html>).
import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://localhost:3000/login'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 400)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)))
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText))
await page.goto(url)
await page.waitForTimeout(6000)
console.log('hydrated:', await page.evaluate(() => document.documentElement.dataset.hydrated ?? '(unset)'))
console.log('title:', await page.title())
await browser.close()
