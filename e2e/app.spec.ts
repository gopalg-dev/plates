import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import * as XLSX from 'xlsx'
import { backdateJoin, resetDatabase, traceOf } from './db'

test.describe.configure({ mode: 'serial' })

/** Sign out from the account menu at the foot of the sidebar. Phones open the sidebar first. */
async function signOut(page: Page) {
  await open(page, '/')
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('button', { name: /^Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
}

const shots = 'e2e/screenshots'

// The flows build on each other and the session cookie must survive between them, so every test
// in a project shares one page and browser context instead of Playwright's fresh-context fixture.
let page: Page
test.beforeAll(async ({ browser }) => {
  await resetDatabase()
  page = await browser.newPage()
})

test.afterAll(async () => {
  await page.close()
})

/** Navigates and waits until React has hydrated the page, so clicks do not hit server-rendered HTML. */
async function open(page: Page, path: string) {
  await page.goto(path)
  await hydrated(page)
}

/**
 * The root document sets a flag once React runs on the client, and the app layout sets a second one
 * once it has hydrated too (its data streams in after the root). On app pages, wait for both: a tap
 * on the menu button between the two lands on server HTML and does nothing.
 */
async function hydrated(page: Page) {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })
  await page.locator('html[data-page-hydrated="true"]').waitFor({ state: 'attached' })
}

/**
 * A live phone on How it works: its window, once loaded (they load as they near the view) and hydrated. Inside is
 * the app's own screen on made-up numbers, so the checks read like the ones on the real screens.
 */
async function demoWindow(page: Page, title: string) {
  const frame = page.locator(`iframe[title="${title}"]`)
  await frame.scrollIntoViewIfNeeded()
  const inside = page.frameLocator(`iframe[title="${title}"]`)
  await inside.locator('html[data-page-hydrated="true"]').waitFor({ state: 'attached' })
  return inside
}

async function snap(page: Page, name: string) {
  const project = test.info().project.name
  await page.screenshot({ path: `${shots}/${project}-${name}.png`, fullPage: true })
}

test('signed out, the home page is How it works, with the way in', async () => {
  await open(page, '/')
  await expect(page).toHaveURL(/\/how-it-works$/)
  await expect(page.getByText('A gym logbook for the time between sets.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How it works', exact: true })).toBeVisible()
  // The exercise picture is just a picture until there is an app to open it in.
  await expect(page.getByRole('link', { name: 'About Barbell Bench Press' })).toHaveCount(0)
  // A shared link unfurls into the card, from an absolute URL.
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^http.*\/og\.png$/)
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' })).toBeVisible()
  // The live phone runs the app's own screens on made-up numbers: a tick counts, Zen covers the tab bar, and the
  // tab bar walks to Plan and Stats with the ticked set still there on the way back.
  const demo = await demoWindow(page, 'Try it: Plates on made-up numbers')
  // Today opens on Next up — the day the plan says is next and its lifts; Start begins the session.
  await demo.getByRole('button', { name: /^Start / }).click()
  await expect(demo.getByText(/^0 of \d+ sets done$/)).toBeVisible()
  await demo.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(demo.getByText(/^1 of \d+ sets done$/)).toBeVisible()
  await demo.getByRole('button', { name: 'Zen mode' }).click()
  await expect(demo.getByRole('button', { name: 'Mark set 2 done' })).toBeVisible()
  await expect(demo.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await demo.getByRole('button', { name: 'Exit zen' }).click()
  await demo.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Plan' }).click()
  await expect(demo.getByText('Push / Pull / Legs, 6 days')).toBeVisible()
  await demo.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Stats' }).click()
  await demo.getByRole('radio', { name: 'Sessions' }).click()
  await expect(demo.getByText(/of 6 sessions/)).toBeVisible()
  await demo.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Today' }).click()
  await expect(demo.getByText(/^1 of \d+ sets done$/)).toBeVisible()
  // The Report opens from the top bar on the made-up week; Back returns to Today with the ticked set kept.
  await demo.getByRole('button', { name: 'Report', exact: true }).click()
  await expect(demo.getByRole('heading', { name: 'Report', exact: true })).toBeVisible()
  await demo.getByRole('button', { name: 'Back' }).click()
  await expect(demo.getByText(/^1 of \d+ sets done$/)).toBeVisible()
  await snap(page, '00a-home')
  // Any other screen still asks to sign in first.
  await open(page, '/stats')
  await expect(page).toHaveURL(/\/login$/)
})

test('first run: create an account, then setup one question at a time', async () => {
  await open(page, '/')
  await page.getByRole('link', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await hydrated(page)
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await hydrated(page)
  // The URL moves before the page does: wait for the sign-up form, or the username lands in the sign-in box.
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await page.getByLabel('Username').fill('alex')
  await page.getByLabel('Email').fill('alex@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await snap(page, '00-signup')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/setup$/)
  await hydrated(page)
  await expect(page.getByRole('heading', { name: 'Which units do you lift in?' })).toBeVisible()
  await expect(page.getByText('1 of 5')).toBeVisible()
  await snap(page, '01-setup-units')

  // Enter moves on from every step: on a toggle, a radio and a text field alike.
  await page.getByRole('radio', { name: 'Pounds' }).click()
  await page.getByRole('radio', { name: 'Kilograms' }).click()
  await page.keyboard.press('Enter')

  // The split: the default stays selected, the others are a tap away.
  await expect(page.getByRole('heading', { name: 'Which split?' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Push \/ Pull \/ Legs 6 days/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /One muscle a day/ })).toBeVisible()
  await snap(page, '01b-setup-split')
  await page.getByRole('radio', { name: /^Push \/ Pull \/ Legs 6 days/ }).focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'What do you weigh today?' })).toBeVisible()
  await page.getByLabel('Bodyweight in kg', { exact: true }).fill('72')
  await snap(page, '02-setup-bodyweight')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'How long have you been lifting?' })).toBeVisible()
  await page.getByRole('radio', { name: /A year or more/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'How should the weight go up?' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Reps first, then weight/ })).toBeChecked()
  await snap(page, '03-setup-age')
  await page.getByRole('button', { name: 'Start training' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByText(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pull A' })).toBeVisible()
  // The weigh-in from setup counts, so Today asks for the tape baseline, not for the weight again.
  await expect(page.getByText('Tape day.')).toBeVisible()
  await expect(page.getByText('Weigh-in due.')).not.toBeVisible()
  await snap(page, '04-today-next-up')
  // "Not now" keeps the tape reminder quiet for a week, across reloads; the fresh weigh-in asks for nothing.
  await page.getByRole('button', { name: 'Not now' }).click()
  await expect(page.getByText('Tape day.')).toHaveCount(0)
  await open(page, '/')
  await expect(page.getByRole('heading', { name: 'Pull A' })).toBeVisible()
  await expect(page.getByText('Tape day.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Not now' })).toHaveCount(0)
})

test('logs a workout with the set logger', async () => {
  await open(page, '/')
  await page.getByRole('button', { name: 'Start Pull A' }).click()
  await expect(page.getByRole('heading', { name: 'Pull A' })).toBeVisible()
  await expect(page.getByText(/Started/)).toBeVisible()
  // The clock counts from the start, and a pause stops it.
  await expect(page.getByText('0 min')).toBeVisible()
  await page.getByRole('button', { name: 'Pause the session' }).click()
  await expect(page.getByRole('button', { name: 'Resume the session' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume the session' }).click()
  await expect(page.getByRole('button', { name: 'Pause the session' })).toBeVisible()

  // Pull-ups open first. Log a set by reps only.
  await expect(page.getByRole('button', { name: /^Pull-ups/ })).toHaveAttribute('aria-expanded', 'true')
  const pullups = page.getByRole('region', { name: /Pull-ups/ })
  await pullups.getByLabel('Set 1 reps', { exact: true }).fill('8')
  await pullups.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(page.getByText('1 of 20 sets done')).toBeVisible()
  await expect(page.getByText('1/4')).toBeVisible()
  await snap(page, '05-today-logging')

  // The still opens the library's view of the exercise in place, through ?exercise= in the URL.
  await page.getByRole('link', { name: 'About Barbell Row' }).click()
  await expect(page).toHaveURL(/exercise=barbell-row/)
  await expect(page.getByRole('dialog', { name: 'Barbell Row' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Barbell Row' })).toHaveCount(0)
  await expect(page).not.toHaveURL(/exercise=/)
  // The same URL typed in (or reloaded) opens it too, and closing it then drops the param in place.
  await open(page, '/?exercise=barbell-row')
  await expect(page.getByRole('dialog', { name: 'Barbell Row' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Barbell Row' })).toHaveCount(0)
  await expect(page).not.toHaveURL(/exercise=/)

  // Barbell Row: weight and reps, two sets.
  await page.getByRole('button', { name: /^Barbell Row/ }).click()
  const row = page.getByRole('region', { name: /Barbell Row/ })
  await row.getByLabel('Set 1 weight', { exact: true }).fill('60')
  await row.getByLabel('Set 1 reps', { exact: true }).fill('8')
  await row.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(page.getByText('2 of 20 sets done')).toBeVisible()
  await row.getByRole('button', { name: 'Increase Set 2 weight' }).click()
  await row.getByLabel('Set 2 reps', { exact: true }).fill('7')
  await row.getByRole('button', { name: 'Mark set 2 done' }).click()
  await expect(row.getByLabel('Set 2 weight', { exact: true })).toHaveValue('65')
  await expect(page.getByText('3 of 20 sets done')).toBeVisible()

  // The curl machine is taken: Hammer Curl swaps for a cable curl, today only, with the library's own range.
  await page.getByRole('button', { name: /^Hammer Curl/ }).click()
  await page.getByRole('button', { name: 'Swap Hammer Curl' }).click()
  await expect(page.getByRole('dialog', { name: 'Swap Hammer Curl' })).toBeVisible()
  await snap(page, '05d-swap-lift')
  await page.getByLabel('Search the library').fill('cable curl')
  await page.getByRole('button', { name: 'Use Cable Curl' }).click()
  await expect(page.getByText('Cable Curl today')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Cable Curl/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /^Cable Curl/ })).toContainText('3 × 10-12')
  await expect(page.getByRole('button', { name: /^Hammer Curl/ })).toHaveCount(0)
  await expect(page.getByText('3 of 20 sets done')).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible()
  // Sets are left unticked: the check-in says they will not count, and offers to keep going instead.
  await expect(page.getByText("17 of 20 sets are not ticked. They won't count.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep going' })).toBeVisible()
  await page.getByRole('radio', { name: 'Hard' }).click()
  await page.getByLabel('Session note').fill('Grip gave out on rows')
  await snap(page, '05b-finish-check-in')
  await page.getByRole('button', { name: 'Save and finish' }).click()
  // The finish summary: every lift's best set and the week's count. First session, so nothing is a new best yet.
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible()
  await expect(page.getByText('1 of 6 sessions this week.')).toBeVisible()
  await expect(page.getByText('65 kg × 7')).toBeVisible()
  await snap(page, '05c-finish-summary')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Push A' })).toBeVisible()
  await snap(page, '06-today-after-finish')
})

test('plan shows the days and swaps an exercise for an alternate', async () => {
  await open(page, '/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
  await page.getByRole('button', { name: /Push A/ }).click()
  await expect(page.getByRole('button', { name: 'Edit Decline DB Press' })).toBeVisible()
  await snap(page, '07-plan-day-open')

  await page.getByRole('button', { name: 'Edit Decline DB Press' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await snap(page, '08-plan-editor')
  // The library fills the name, muscle and type in. Not saved here: the swap below wins.
  await page.getByRole('button', { name: 'Pick from library' }).click()
  await page.getByLabel('Search the library').fill('incline db press')
  await page.getByRole('button', { name: 'Use Incline DB Press' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Incline DB Press')
  await expect(page.getByLabel('Search the library')).not.toBeVisible()
  const dipsRow = page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'Weighted Dips' })
  await dipsRow.getByRole('button', { name: 'Use this' }).click()
  await expect(page.getByText('Switched to Weighted Dips')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Weighted Dips' })).toBeVisible()

  // A day holds ten: remove one, then add one in its place. The cap itself is unit-tested in repo.test.ts.
  await expect(page.getByText('6 of 10 exercises')).toBeVisible()
  await page.getByRole('button', { name: 'Edit Cable Crunch' }).click()
  await page.getByRole('button', { name: 'Remove from day' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByText('Removed from the day')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Cable Crunch' })).not.toBeVisible()
  await expect(page.getByText('5 of 10 exercises')).toBeVisible()
  await page.getByRole('button', { name: 'Add exercise to Push A' }).click()
  await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Chest Dips')
  await page.getByRole('button', { name: 'Add to day' }).click()
  await expect(page.getByText('Added to the day')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Chest Dips' })).toBeVisible()
  await expect(page.getByText('6 of 10 exercises')).toBeVisible()

  // Reorder from the keyboard: lift Chest Dips by its grip, move it up one, drop. The order saves.
  const grips = page.getByRole('button', { name: /^Move / })
  const order = () => grips.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')?.slice(5)))
  const before = await order()
  expect(before.at(-1)).toBe('Chest Dips')
  // Each key waits for the screen-reader announcement of the one before, as a person hearing it would.
  await page.getByRole('button', { name: 'Move Chest Dips' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByText(`Picked up Chest Dips, position ${before.length} of ${before.length}.`)).toBeAttached()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText(`Chest Dips is over position ${before.length - 1} of ${before.length}.`)).toBeAttached()
  await page.keyboard.press('Space')
  await expect.poll(order).toEqual([...before.slice(0, -2), 'Chest Dips', before.at(-2)])
  await open(page, '/plan')
  await page.getByRole('button', { name: /Push A/ }).click()
  await expect.poll(order).toEqual([...before.slice(0, -2), 'Chest Dips', before.at(-2)])
  // The day's menu puts the template order back: the swapped lift in its slot, the added one last.
  await page.getByRole('button', { name: 'Push A options' }).click()
  await page.getByRole('menuitem', { name: 'Restore default order' }).click()
  await expect.poll(order).toEqual(before)
  await page.getByRole('button', { name: 'Push A options' }).click()
  await expect(page.getByRole('menuitem', { name: 'Restore default order' })).toBeDisabled()
  await page.keyboard.press('Escape')

  // Days themselves: add one of a kind, rename it, move it, remove it.
  await page.getByRole('button', { name: 'Add a day' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Arms', exact: true }).click()
  await expect(page.getByText(/7 days$/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Arms/ }).first()).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: 'Edit Barbell Curl' })).toBeVisible()
  await page.getByRole('button', { name: 'Arms options' }).click()
  await page.getByRole('menuitem', { name: 'Rename or change kind' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Arm day')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Arm day/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Arm day options' }).click()
  await page.getByRole('menuitem', { name: 'Move up' }).click()
  await expect(page.getByRole('button', { name: /^Arm day/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Arm day options' }).click()
  await page.getByRole('menuitem', { name: 'Remove day' }).click()
  await page.getByRole('button', { name: 'Remove day' }).click()
  await expect(page.getByText('Arm day removed')).toBeVisible()
  await expect(page.getByText(/6 days$/)).toBeVisible()
})

test('a weekday schedule puts each day on its weekday and Today follows the calendar', async () => {
  await open(page, '/settings')
  await page.getByRole('radio', { name: 'By weekday' }).click()
  await expect(page.getByText('Each day is on its weekday now')).toBeVisible()
  await open(page, '/plan')
  await expect(page.getByText(/6 days by weekday$/)).toBeVisible()
  await page.getByRole('button', { name: /Pull A/ }).click()
  await expect(page.getByRole('combobox', { name: 'Pull A weekday' })).toHaveText('Monday')
  await expect(page.getByText('6 exercises, 20 sets, Mondays')).toBeVisible()
  await snap(page, '07b-plan-weekday')

  await open(page, '/')
  await expect(
    page.getByText(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })),
  ).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^(Pull A|Push A|Legs A|Pull B|Push B|Legs B|Rest day|Done for today)$/,
  )
  await snap(page, '07c-today-weekday')

  await open(page, '/settings')
  await page.getByRole('radio', { name: 'Rolling' }).click()
  await expect(page.getByText('Back to the rolling order')).toBeVisible()
})

test('stats reflect the logged workout and bodyweight', async () => {
  // Joined today: nothing before today can be picked on the calendar.
  await open(page, '/stats?tab=sessions')
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous month', exact: true })).toBeDisabled()
  await backdateJoin(60)
  await open(page, '/stats?tab=sessions')
  await expect(page.getByText('of 6 sessions')).toBeVisible()
  await expect(page.getByText(/effort hard\.$/)).toBeVisible()
  await expect(page.getByText('of 6 sessions').locator('..').getByText('1', { exact: true })).toBeVisible()
  // Picking a week in the calendar points the week numbers at that week.
  await page.getByRole('button', { name: 'Previous month', exact: true }).click()
  await page
    .getByRole('button', { name: /, no session$/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: /^Week of/ })).toBeVisible()
  await expect(page.getByText('of 6 sessions').locator('..').getByText('0', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to this week' }).click()
  await expect(page.getByRole('heading', { name: 'This week', exact: true })).toBeVisible()
  await expect(page.getByText('of 6 sessions').locator('..').getByText('1', { exact: true })).toBeVisible()
  // The month title opens a calendar whose month and year dropdowns move the Stats calendar.
  const prev = new Date()
  prev.setDate(1)
  prev.setMonth(prev.getMonth() - 1)
  await page.getByRole('button', { name: /Pick a month$/ }).click()
  if (prev.getFullYear() !== new Date().getFullYear()) {
    await page.getByLabel('Choose the Year').selectOption(String(prev.getFullYear()))
  }
  await page
    .getByLabel('Choose the Month')
    .selectOption({ label: prev.toLocaleDateString('en-US', { month: 'short' }) })
  await expect(
    page.getByRole('button', {
      name: `${prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Pick a month`,
    }),
  ).toBeVisible()
  await snap(page, '09c-month-picker')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Choose the Month')).not.toBeVisible()
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(page.getByText('3 of 20')).toBeVisible()
  // Strength: pick a lift and the big number, the week chart and the week table follow it.
  await page.getByRole('radio', { name: 'Lifts' }).click()
  // Lifts carry a trend; one week of history reads as new, and the chip narrows the list to those lifts.
  await expect(page.getByRole('radio', { name: 'All' })).toBeVisible()
  await page.getByRole('radio', { name: /^New/ }).click()
  await expect(page.getByText('New', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'All' }).click()
  await page.getByRole('combobox', { name: 'Lift' }).click()
  await page.getByRole('option', { name: 'Barbell Row' }).click()
  await expect(page.getByRole('combobox', { name: 'Lift' })).toHaveText('Barbell Row')
  await expect(page.getByRole('cell', { name: '65 kg × 7' })).toBeVisible()
  // The week's totals sit under the session count: 60 × 8 + 65 × 7 on the rows, plus 8 pull-ups at the 72 kg
  // weighed in at setup.
  await page.getByRole('radio', { name: 'Sessions' }).click()
  await expect(page.getByText(/^1,511\s*kg$/)).toBeVisible()
  // The body map: back was trained, chest was planned and not yet; a tap names the number.
  await expect(page.getByRole('group', { name: 'Front' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Back' })).toBeVisible()
  // A muscle is a group of polygons whose centre can fall between its halves, so the click is dispatched.
  await page.getByRole('button', { name: /^Back: 3 of \d+ sets$/ }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: /^Back: 3 of \d+ sets$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Chest: 0 of \d+ sets$/ })).toBeVisible()
  await snap(page, '08b-body-map')

  await page.getByRole('radio', { name: 'Body' }).click()
  await expect(page.getByText('No tape yet', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Log bodyweight' }).click()
  await page.getByLabel('Bodyweight in kg', { exact: true }).fill('72.5')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Replaced today')).toBeVisible()
  await expect(page.getByText('72.5', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1 log', { exact: true })).toBeVisible()
  // Tapping a point on the chart opens that weigh-in for editing or removal.
  await page.getByRole('region', { name: 'Bodyweight' }).locator('[data-slot="chart"]').click()
  await expect(page.getByRole('heading', { name: /^Weigh-in, / })).toBeVisible()
  await page.getByLabel('Bodyweight in kg', { exact: true }).fill('73')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Bodyweight updated')).toBeVisible()
  await expect(page.getByText('73', { exact: true }).first()).toBeVisible()
  // A tape entry that was missed goes in under its own date.
  const missed = new Date()
  missed.setDate(missed.getDate() - 5)
  const missedDay = new RegExp(
    `${missed.toLocaleDateString('en-US', { month: 'long' })} ${missed.getDate()}(st|nd|rd|th), ${missed.getFullYear()}`,
  )
  await page.getByRole('button', { name: 'Log measurements' }).first().click()
  await page.getByLabel('Arm in cm', { exact: true }).fill('36')
  await page.getByLabel('Chest in cm', { exact: true }).fill('98')
  await page.getByLabel('Waist in cm', { exact: true }).fill('80')
  await expect(page.getByLabel('Date', { exact: true })).toHaveText(/^Today, /)
  await page.getByLabel('Date', { exact: true }).click()
  await page.getByRole('button', { name: missedDay }).click()
  await expect(page.getByLabel('Date', { exact: true })).not.toHaveText(/^Today, /)
  await snap(page, '09b-tape-date')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/^Measurements saved for /)).toBeVisible()
  await expect(page.getByText(/Last measured .*, 5 days ago\./)).toBeVisible()
  await expect(page.getByText(/Next tape day/)).toBeVisible()
  await snap(page, '09-stats')

  // Dark mode follows the system setting, no toggle in the app.
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await snap(page, '10-stats-dark')
  await open(page, '/')
  await page.getByRole('button', { name: 'Start Push A' }).click()
  await expect(page.getByText(/Started/)).toBeVisible()
  await snap(page, '11-today-dark')
  // Zen mode: one exercise over the whole app, Next and Previous between them.
  await page.getByRole('button', { name: 'Zen mode' }).click()
  const zen = page.getByRole('dialog', { name: 'Zen mode' })
  await expect(zen.getByText('1 of 6', { exact: true })).toBeVisible()
  await zen.getByRole('button', { name: 'Next exercise' }).click()
  await expect(zen.getByText('2 of 6', { exact: true })).toBeVisible()
  await snap(page, '11c-zen')
  // Zen mode lives in the URL, so a reload keeps it.
  await expect(page).toHaveURL(/\?zen=/)
  await page.reload()
  await hydrated(page)
  await expect(page.getByRole('dialog', { name: 'Zen mode' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Zen mode' }).getByRole('button', { name: 'Exit zen' }).click()
  await expect(page).not.toHaveURL(/zen=/)
  await expect(zen).not.toBeVisible()
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Change session' }).click()
  await expect(page.getByText('Nothing is logged yet, so nothing is lost.')).toBeVisible()
  await snap(page, '11b-change-session')
  await page.keyboard.press('Escape')
  await expect(page.getByText('Nothing is logged yet, so nothing is lost.')).not.toBeVisible()
  // Changing the day being trained asks whether today follows: Plan and today brings the session up to date.
  await open(page, '/plan')
  await page.getByRole('button', { name: /^Push A/ }).click()
  await expect(page.getByText('In progress', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Barbell Bench Press' }).click()
  await page.getByLabel('High reps', { exact: true }).fill('9')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Push A is in progress' })).toBeVisible()
  await page.getByRole('button', { name: 'Plan and today' }).click()
  await expect(page.getByText("Today's session updated")).toBeVisible()
  await open(page, '/')
  await expect(page.getByText(/ × 5-9$/)).toBeVisible()
  // Plan only leaves today as it is: the change back waits for the next session.
  await open(page, '/plan')
  await page.getByRole('button', { name: /^Push A/ }).click()
  await page.getByRole('button', { name: 'Edit Barbell Bench Press' }).click()
  await page.getByLabel('High reps', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: 'Plan only' }).click()
  await open(page, '/')
  await expect(page.getByText(/ × 5-9$/)).toBeVisible()
  // Discard lives in the same menu and asks first.
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Discard workout' }).click()
  await expect(page.getByRole('heading', { name: 'Discard this workout?' })).toBeVisible()
  await page.getByRole('button', { name: 'Discard workout' }).click()
  await expect(
    page.getByText(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })),
  ).toBeVisible()
  await page.emulateMedia({ colorScheme: 'light' })
})

test('the report waits for a finished week, and is reached from the sidebar', async () => {
  await open(page, '/report')
  await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible()
  // The only session is this week: the first weekly report comes when it ends.
  await expect(page.getByRole('radio', { name: 'Week' })).toBeChecked()
  await expect(page.getByText(/^Your first weekly report comes on /)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next week' })).toBeDisabled()
  await page.getByRole('radio', { name: 'Month' }).click()
  await expect(page).toHaveURL(/period=month/)
  await expect(page.getByText(/^Your first monthly report comes on /)).toBeVisible()
  await snap(page, '09d-report')
  // The sidebar lists it with Library; phones open the sidebar first.
  await open(page, '/')
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Report' }).getByRole('link').click()
  await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible()
  // With only this week's session there is no report yet, so nothing to share: no options menu either.
  await expect(page.getByRole('button', { name: 'Report options' })).toHaveCount(0)
})

test('keyboard focus is visible and the tab bar switches screens', async () => {
  await open(page, '/')
  if ((page.viewportSize()?.width ?? 0) < 768) {
    // Phones: the menu button opens the sidebar with every screen in it.
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Account menu/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('link', { name: 'Library' })).not.toBeVisible()
  }
  await page.getByRole('link', { name: 'Stats' }).first().click()
  await expect(page).toHaveURL(/\/stats$/)
  await page.getByRole('link', { name: 'Plan' }).first().click()
  await expect(page).toHaveURL(/\/plan$/)
  await page.getByRole('link', { name: 'Today' }).first().click()
  await expect(page).toHaveURL(/\/$/)
})

test('bring your own plan: template download, upload, preview edit, replace', async () => {
  await open(page, '/plan')
  await page.getByRole('link', { name: 'Bring your own plan' }).click()
  await expect(page).toHaveURL(/\/plan\/import$/)
  await expect(page.getByRole('heading', { name: 'Bring your own plan' })).toBeVisible()

  // The template picker: the current plan, or any split; the file name carries the template id.
  await expect(page.getByRole('combobox', { name: 'Template' })).toHaveText('Current plan, Push / Pull / Legs')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download template' }).click()
  expect((await download).suggestedFilename()).toBe('plates-template-ppl6.xlsx')
  await page.getByRole('combobox', { name: 'Template' }).click()
  await page.getByRole('option', { name: 'Upper / Lower, 4 days' }).click()
  const ul4 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download template' }).click()
  expect((await ul4).suggestedFilename()).toBe('plates-template-ul4.xlsx')

  const csv = [
    'Day,Type,Exercise,Sets,Reps,Load,Muscle,Note,Alternates',
    'Upper,,Bench Press,4,5-8,,,,',
    ',,Chin-ups,3,6-10,,,,',
    'Lower,legs,Back Squat,4,6,,,Sit back,Front Squat',
    ',,Plank,3,45 s,,,,',
    ',,,3,8-12,,,,',
  ].join('\n')
  await page
    .locator('#plan-file')
    .setInputFiles({ name: 'my-plan.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
  await expect(page.getByText('my-plan.csv: 2 days, 4 exercises.')).toBeVisible()
  // A CSV carries no template marker, so it comes in as a custom plan.
  await expect(page.getByText('Custom plan.', { exact: true })).toBeVisible()
  await expect(page.getByText('Row 6: No exercise name, row skipped.')).toBeVisible()
  await expect(page.getByLabel('Day 1 name')).toHaveValue('Upper')
  await expect(page.getByLabel('Chin-ups type')).toHaveText('Bodyweight')
  await expect(page.getByLabel('Plank type')).toHaveText('Timed hold')
  await snap(page, '12-import-preview')

  await page.getByLabel('Bench Press sets').fill('5')
  await page.getByRole('button', { name: 'Pick Chin-ups from library' }).click()
  await page.getByLabel('Search the library').fill('pull-ups')
  await page.getByRole('button', { name: 'Use Pull-ups' }).click()
  await expect(page.getByLabel('Upper exercise 2 name')).toHaveValue('Pull-ups')
  await page.getByRole('button', { name: 'Remove Plank' }).click()
  await expect(page.getByText('my-plan.csv: 2 days, 3 exercises.')).toBeVisible()

  await page.getByRole('button', { name: 'Use this plan' }).click()
  await page.getByRole('button', { name: 'Replace', exact: true }).click()
  await expect(page.getByText('Plan replaced')).toBeVisible()
  await expect(page).toHaveURL(/\/plan$/)
  await expect(page.getByText('Custom plan, 2 days', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Upper/ })).toBeVisible()
  await expect(page.getByText('2 exercises, 8 sets')).toBeVisible()
  await expect(page.getByText('1 exercises, 4 sets')).toBeVisible()

  await open(page, '/')
  await expect(page.getByRole('heading', { name: 'Upper' })).toBeVisible()
})

test('a day on the stats calendar opens its session to fix a set or remove it', async () => {
  await open(page, '/stats?tab=sessions')
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // The logs export as a spreadsheet, built in the browser.
  const xlsx = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Excel' }).click()
  expect((await xlsx).suggestedFilename()).toMatch(/^plates-logs-\d{4}-\d{2}-\d{2}\.xlsx$/)
  const csv = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  const csvFile = await csv
  expect(csvFile.suggestedFilename()).toMatch(/^plates-logs-\d{4}-\d{2}-\d{2}\.csv$/)
  const csvPath = await csvFile.path()
  if (!csvPath) throw new Error('The CSV download has no file')
  const text = readFileSync(csvPath, 'utf8')
  expect(text.split('\n')[0]).toContain('Weight (kg)')
  // The tracker layout: a sheet per day, previewed on screen, Excel only.
  await page.getByRole('radio', { name: 'Tracker' }).click()
  await expect(page.getByRole('table', { name: 'Tracker sheet preview' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download CSV' })).toHaveCount(0)
  const tracker = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Excel' }).click()
  expect((await tracker).suggestedFilename()).toMatch(/^plates-tracker-\d{4}-\d{2}-\d{2}\.xlsx$/)
  await page.getByRole('radio', { name: 'Log' }).click()
  expect(text).toContain('Barbell Row')
  expect(text).toContain('Grip gave out on rows')
  await page.getByRole('button', { name: `${today}, Pull A` }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Grip gave out on rows')).toBeVisible()
  await sheet.getByRole('button', { name: /^Barbell Row/ }).click()
  const reps = sheet.getByRole('region', { name: /Barbell Row/ }).getByLabel('Set 1 reps', { exact: true })
  await reps.fill('9')
  await expect(reps).toHaveValue('9')
  await snap(page, '13-history-edit')
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Session updated')).toBeVisible()
  await expect(sheet).not.toBeVisible()
  await page.getByRole('radio', { name: 'Lifts' }).click()
  await page.getByRole('combobox', { name: 'Lift' }).click()
  await page.getByRole('option', { name: 'Barbell Row' }).click()
  // The week's best row set is 65 × 7 (set 2); the edited set 1 is 60 × 9 and scores a hair under it.
  await expect(page.getByRole('cell', { name: '65 kg × 7' })).toBeVisible()
  await page.getByRole('radio', { name: 'Sessions' }).click()
  await page.getByRole('button', { name: `${today}, Pull A` }).click()
  await page.getByRole('button', { name: 'Delete session' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Session removed')).toBeVisible()
  await page.getByRole('radio', { name: 'Lifts' }).click()
  await expect(page.getByText('Nothing logged yet', { exact: false })).toBeVisible()
})

test('feedback is one tap and an optional line, from the account menu', async () => {
  await open(page, '/')
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('button', { name: /^Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Send feedback' }).click()
  await expect(page.getByRole('heading', { name: 'How is Plates for you?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await page.getByRole('radio', { name: 'Good' }).click()
  await page.getByLabel('Feedback', { exact: true }).fill('The targets are spot on.')
  await snap(page, '15b-feedback')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Thanks, noted.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How is Plates for you?' })).not.toBeVisible()
})

test('accounts stay apart: a second user starts clean and the first signs back in by username', async () => {
  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)
  await hydrated(page)
  await snap(page, '14-login')

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await hydrated(page)
  // The URL moves before the page does: wait for the sign-up form, or the username lands in the sign-in box.
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await page.getByLabel('Username').fill('sam')
  await page.getByLabel('Email').fill('sam@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start training' }).click()
  // The default plan, not the one the first user imported.
  await expect(page.getByRole('heading', { name: 'Pull A' })).toBeVisible()
  await open(page, '/stats')
  await expect(page.getByText('Nothing logged yet', { exact: false })).toBeVisible()
  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)
  await hydrated(page)

  await page.getByLabel('Email or username').fill('alex')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await snap(page, '16-login-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Upper' })).toBeVisible()
})

test('the library is searchable and shows a picture and cues', async () => {
  await open(page, '/library')
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await page.getByLabel('Search the library').fill('barbell row')
  await expect(page.getByText(/^\d+ exercises?$/)).toBeVisible()
  await page.getByRole('button', { name: 'Open Barbell Row' }).click()
  await expect(page.getByRole('heading', { name: 'Barbell Row', exact: true })).toBeVisible()
  await expect(page.getByText('Back. Barbell.', { exact: false })).toBeVisible()
  await expect(page.getByRole('listitem').first()).toBeVisible()
  await snap(page, '18-library')
  // Previous and Next step through the rows in view without closing the detail.
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: /^Next, / }).click()
  await expect(page.getByRole('heading', { name: 'Barbell Row', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: /^Previous, Barbell Row/ }).click()
  await expect(page.getByRole('heading', { name: 'Barbell Row', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Barbell Row', exact: true })).not.toBeVisible()
})

test('How it works lists every section and its links jump to them', async () => {
  await open(page, '/how-it-works')
  await expect(page.getByRole('heading', { name: 'How it works', exact: true })).toBeVisible()
  // Signed in: the way back into the app, and no welcome.
  await expect(page.getByRole('link', { name: 'Open app' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Get started' })).toHaveCount(0)
  // Ten sections from src/content/guide, each with a jump link of the same name.
  const links = page.getByRole('navigation', { name: 'How it works sections' }).getByRole('link')
  await expect(links).toHaveCount(10)
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(10)
  // MDX bold becomes an on-screen label, and a list item carries the text.
  await expect(page.getByText('Every tap saves', { exact: false })).toBeVisible()
  // The app's own pieces inside the text: an exercise picture, the progression methods, the day kinds, a tip.
  await expect(page.getByRole('link', { name: 'About Barbell Bench Press' })).toBeVisible()
  await expect(page.getByText('Reps first, then weight', { exact: true })).toBeVisible()
  await expect(page.getByText('Full body', { exact: true })).toBeVisible()
  await expect(page.getByText('Rate every session honestly', { exact: false })).toBeVisible()
  await links.filter({ hasText: 'Your data' }).click()
  await expect(page).toHaveURL(/#data$/)
  await expect(page.getByRole('heading', { name: 'Your data' })).toBeInViewport()
  // From 1280px the links are a sticky column that marks the section being read.
  if ((page.viewportSize()?.width ?? 0) >= 1280) {
    await expect(links.filter({ hasText: 'Your data' })).toHaveAttribute('aria-current', 'location')
    await expect(links.filter({ hasText: 'A session, start to finish' })).not.toHaveAttribute(
      'aria-current',
      'location',
    )
  }
  await snap(page, '18b-guide')
  // Signed in there is no welcome and no live phone; the sections show screenshots of the screens.
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /^Zen mode:/ })).toBeVisible()
  // The picture opens the exercise in the library, and closing it comes back here.
  await page.getByRole('link', { name: 'About Barbell Bench Press' }).click()
  await expect(page).toHaveURL(/\/library\?exercise=barbell-bench-press/)
  await expect(page.getByRole('dialog', { name: 'Barbell Bench Press' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/how-it-works/)
})

test('settings change units, and start fresh wipes the data', async () => {
  await open(page, '/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('radio', { name: 'Pounds' }).click()
  await expect(page.getByText('Lifting in lb')).toBeVisible()
  // Each kind of weight has its smallest step, in the unit's own list; a barbell takes a plate each side.
  const bar = page.getByRole('radiogroup', { name: 'Bar plates' })
  await expect(bar.getByRole('radio', { name: '2.5 lb', exact: true })).toBeVisible()
  await bar.getByRole('radio', { name: '5 lb', exact: true }).click()
  await expect(page.getByText('Barbell steps of 10 lb')).toBeVisible()
  // The toggle reads the saved setting: wait for it to come back as 5 before pressing the next one.
  await expect(bar.getByRole('radio', { name: '5 lb', exact: true })).toBeChecked()
  await bar.getByRole('radio', { name: '2.5 lb', exact: true }).click()
  await expect(page.getByText('Barbell steps of 5 lb')).toBeVisible()
  const dumbbells = page.getByRole('radiogroup', { name: 'Dumbbells' })
  await dumbbells.getByRole('radio', { name: '10 lb', exact: true }).click()
  await expect(page.getByText('Dumbbell steps of 10 lb')).toBeVisible()
  await expect(dumbbells.getByRole('radio', { name: '10 lb', exact: true })).toBeChecked()
  // Same for all leaves one row; unticked, each kind keeps its own value.
  const same = page.getByRole('checkbox', { name: 'Same for all' })
  await same.click()
  await expect(page.getByText('Steps of 2.5 lb for all')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Smallest step' })).toBeVisible()
  await expect(dumbbells).toHaveCount(0)
  await same.click()
  await expect(page.getByText('A step for each kind')).toBeVisible()
  await expect(dumbbells.getByRole('radio', { name: '10 lb', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Let it sleep' }).click()
  await expect(page.getByText('The screen can sleep as usual')).toBeVisible()
  await page.getByRole('radio', { name: 'Keep it on' }).click()
  await expect(page.getByText('The screen stays on while you train')).toBeVisible()
  await snap(page, '17-settings')
  // The look lives in the account menu, is kept on the device and applied before paint, so it survives a reload.
  const pickLook = async (name: string) => {
    if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: /^Account menu/ }).click()
    await page.getByRole('menuitem', { name: 'Look' }).click()
    await page.getByRole('menuitemradio', { name }).click()
    await page.keyboard.press('Escape')
    // On phones the sidebar sheet sits behind the menu; one Escape may close only the menu.
    if ((page.viewportSize()?.width ?? 0) < 768) {
      const sheet = page.getByRole('dialog', { name: 'Sidebar' })
      await sheet.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => page.keyboard.press('Escape'))
      await sheet.waitFor({ state: 'hidden' })
    }
  }
  await pickLook('Catppuccin Latte')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'latte')
  await snap(page, '17b-latte')
  await pickLook('Lime')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lime')
  await page.reload()
  await hydrated(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lime')
  await snap(page, '17c-lime')
  await pickLook('Slate')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system')
  await open(page, '/')
  // The streak sits top right: no sessions this week yet, so it reads 0.
  await expect(page.getByLabel('0 weeks streak')).toBeVisible()

  // The split is switched in place, after a confirmation, without leaving Settings.
  await open(page, '/settings')
  // The plan is custom since the upload, so no template reads as picked until one is.
  await page.getByRole('button', { name: /^Change split, on Custom plan/ }).click()
  await page.getByRole('radio', { name: /^Upper \/ Lower 4 days/ }).click()
  await page.getByRole('button', { name: 'Switch to Upper / Lower' }).click()
  await expect(page.getByText('Now on Upper / Lower')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Change split, on Upper / Lower' })).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)

  // Each template names the program it follows. "Start with empty days" takes the split's days without its lifts:
  // Today then offers the Plan instead of Start, and Reset on Plan brings the template's lifts back.
  await page.getByRole('button', { name: 'Change split, on Upper / Lower' }).click()
  await expect(page.getByText("Brandon Campbell's PHUL")).toBeVisible()
  await page.getByRole('checkbox', { name: 'Start with empty days' }).click()
  await snap(page, '17d-empty-days')
  await page.getByRole('button', { name: 'Start with empty days' }).click()
  await expect(page.getByText('Now on Upper / Lower, with empty days')).toBeVisible()
  await open(page, '/')
  await expect(page.getByText('No lifts yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Start / })).toHaveCount(0)
  await page.getByRole('link', { name: 'Add lifts on Plan' }).click()
  await expect(page).toHaveURL(/\/plan$/)
  await expect(page.getByText('0 exercises, 0 sets').first()).toBeVisible()
  await page.getByRole('button', { name: 'Reset to the original plan' }).click()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByText('Plan reset')).toBeVisible()
  await expect(page.getByText('6 exercises, 20 sets').first()).toBeVisible()
  await open(page, '/settings')

  // A plan of your own: pick the kind of each day, add one, build.
  await page.getByRole('button', { name: 'Change split, on Upper / Lower' }).click()
  await page.getByRole('radio', { name: /^Your own/ }).click()
  // The upload earlier left a plan of your own, so "Your own" offers it back first; start over instead.
  await expect(page.getByText('Your plan, as you left it.')).toBeVisible()
  await page.getByRole('button', { name: 'Start over with new days' }).click()
  await page.getByRole('button', { name: 'Add a day' }).click()
  await page.getByRole('combobox', { name: 'Day 5 type' }).click()
  await page.getByRole('option', { name: 'Arms' }).click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await expect(page.getByText('Now on your own plan, 5 days')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Change split, on Custom plan' })).toBeVisible()
  await open(page, '/plan')
  await expect(page.getByText('Custom plan, 5 days', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Arms/ }).first()).toBeVisible()
  await open(page, '/settings')

  await page.getByRole('button', { name: 'Start fresh' }).click()
  await expect(page.getByRole('button', { name: 'Wipe and start over' })).toBeDisabled()
  await page.getByLabel('Confirmation').fill('start fresh')
  await page.getByRole('button', { name: 'Wipe and start over' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await hydrated(page)
  await expect(page.getByText('1 of 5')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Kilograms' })).toBeChecked()
})

test('delete account removes the user and every log, and says so on the sign-in page', async () => {
  // Start fresh left the account at setup; finish it so Settings opens.
  await open(page, '/setup')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start training' }).click()
  await expect(page).toHaveURL(/\/$/)

  await open(page, '/settings')
  await expect(page.getByRole('heading', { name: 'Delete account' })).toBeVisible()
  await page.getByRole('link', { name: 'What is kept and what is not' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Deleting it' })).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: 'Delete account' }).click()
  await expect(page.getByRole('button', { name: 'Delete everything' })).toBeDisabled()
  // The last chance to keep a copy: the zip of everything, with a README that says what each file is.
  const downloading = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: 'Download all my data (.zip)' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^plates-data-alex-\d{4}-\d{2}-\d{2}\.zip$/)
  const files = unzipSync(readFileSync(await download.path()))
  expect(Object.keys(files).sort()).toEqual([
    'README.md',
    'everything.json',
    'feedback.json',
    'plan.xlsx',
    'sessions.csv',
    'settings.json',
    'tape.csv',
    'weigh-ins.csv',
  ])
  expect(strFromU8(files['README.md'])).toContain('# Your Plates data')
  // The plan comes as the workbook Bring your own plan reads back, its rep ranges kept as text, not dates.
  const plan = XLSX.utils.sheet_to_json<(string | number)[]>(XLSX.read(files['plan.xlsx']).Sheets.Plan, { header: 1 })
  expect(plan[0]).toEqual(['Day', 'Type', 'Exercise', 'Sets', 'Reps', 'Load', 'Muscle', 'Note', 'Alternates'])
  expect(plan[1][4]).toMatch(/^\d+-\d+$/)
  expect(JSON.parse(strFromU8(files['settings.json'])).units).toBe('kg')
  await page.getByLabel('Confirmation').fill('delete my account')
  await snap(page, '17-delete-account')
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await expect(page).toHaveURL(/\/login\?deleted=true$/)
  await expect(page.getByText('Your account and all of its data are deleted.')).toBeVisible()

  // The username no longer signs in, and the database holds no trace beyond the deletion log.
  await page.getByLabel('Email or username').fill('alex')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Wrong email, username or password.')).toBeVisible()
  expect(await traceOf('alex@example.com')).toEqual({
    user: 0,
    account: 0,
    session: 0,
    settings: 0,
    plans: 0,
    workouts: 0,
    deletions: 1,
  })
})
