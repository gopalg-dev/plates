import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { backdateJoin, lastCode, lastMagicLink, resetDatabase } from './db'

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
/** The emailed sign-in link, kept so a later flow can show that it only works once. */
let usedLink = ''

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

/** The root document sets this flag once React runs on the client. */
async function hydrated(page: Page) {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })
}

async function snap(page: Page, name: string) {
  const project = test.info().project.name
  await page.screenshot({ path: `${shots}/${project}-${name}.png`, fullPage: true })
}

test('first run: create an account, then setup one question at a time', async () => {
  await open(page, '/')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await hydrated(page)
  await page.getByLabel('Username').fill('alex')
  await page.getByLabel('Email').fill('alex@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await snap(page, '00-signup')
  await page.getByRole('button', { name: 'Create account' }).click()
  // The address proves itself with the emailed six-digit code before the account is usable.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Verification code' }).fill(await lastCode('alex@example.com'))
  await snap(page, '00b-signup-code')
  await page.getByRole('button', { name: 'Verify' }).click()

  await expect(page).toHaveURL(/\/setup$/)
  await expect(page.getByRole('heading', { name: 'Which units do you lift in?' })).toBeVisible()
  await expect(page.getByText('1 of 5')).toBeVisible()
  await snap(page, '01-setup-units')

  await page.getByRole('radio', { name: 'Pounds' }).click()
  await page.getByRole('radio', { name: 'Kilograms' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  // The split: the default stays selected, the others are a tap away.
  await expect(page.getByRole('heading', { name: 'Which split?' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Push \/ Pull \/ Legs 6 days/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /One muscle a day/ })).toBeVisible()
  await snap(page, '01b-setup-split')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'What do you weigh today?' })).toBeVisible()
  await page.getByLabel('Bodyweight in kg', { exact: true }).fill('72')
  await snap(page, '02-setup-bodyweight')
  await page.getByRole('button', { name: 'Continue' }).click()

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
})

test('logs a workout with the set logger', async () => {
  await open(page, '/')
  await page.getByRole('button', { name: 'Start Pull A' }).click()
  await expect(page.getByRole('heading', { name: 'Pull A' })).toBeVisible()
  await expect(page.getByText(/Started/)).toBeVisible()

  // Pull-ups open first. Log a set by reps only.
  await expect(page.getByRole('button', { name: /Pull-ups/ })).toHaveAttribute('aria-expanded', 'true')
  const pullups = page.getByRole('region', { name: /Pull-ups/ })
  await pullups.getByLabel('Set 1 reps', { exact: true }).fill('8')
  await pullups.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(page.getByText('1 of 20 sets done')).toBeVisible()
  await expect(page.getByText('1/4')).toBeVisible()
  await snap(page, '05-today-logging')

  // Barbell Row: weight and reps, two sets.
  await page.getByRole('button', { name: /Barbell Row/ }).click()
  const row = page.getByRole('region', { name: /Barbell Row/ })
  await row.getByLabel('Set 1 weight', { exact: true }).fill('60')
  await row.getByLabel('Set 1 reps', { exact: true }).fill('8')
  await row.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(page.getByText('2 of 20 sets done')).toBeVisible()
  await row.getByRole('button', { name: 'Increase Set 2 weight' }).click()
  await row.getByLabel('Set 2 reps', { exact: true }).fill('7')
  await row.getByRole('button', { name: 'Mark set 2 done' }).click()
  await expect(row.getByLabel('Set 2 weight', { exact: true })).toHaveValue('62.5')
  await expect(page.getByText('3 of 20 sets done')).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible()
  await page.getByRole('radio', { name: 'Hard' }).click()
  await page.getByLabel('Session note').fill('Grip gave out on rows')
  await snap(page, '05b-finish-check-in')
  await page.getByRole('button', { name: 'Save and finish' }).click()
  // The finish summary: every lift's best set and the week's count. First session, so nothing is a new best yet.
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible()
  await expect(page.getByText('1 of 6 sessions this week.')).toBeVisible()
  await expect(page.getByText('62.5 kg × 7')).toBeVisible()
  await snap(page, '05c-finish-summary')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Push A' })).toBeVisible()
  await snap(page, '06-today-after-finish')
})

test('plan shows the days and swaps an exercise for an alternate', async () => {
  await open(page, '/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
  await page.getByRole('button', { name: /Push A/ }).click()
  await expect(page.getByRole('button', { name: /Decline DB Press/ })).toBeVisible()
  await snap(page, '07-plan-day-open')

  await page.getByRole('button', { name: /Decline DB Press/ }).click()
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
  await expect(page.getByRole('button', { name: /Weighted Dips/ })).toBeVisible()

  // A day holds six: remove one, then add one in its place.
  await expect(page.getByRole('button', { name: 'Add exercise to Push A' })).toBeDisabled()
  await page.getByRole('button', { name: 'Edit Cable Crunch' }).click()
  await page.getByRole('button', { name: 'Remove from day' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByText('Removed from the day')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Cable Crunch' })).not.toBeVisible()
  await expect(page.getByText('5 of 6 exercises')).toBeVisible()
  await page.getByRole('button', { name: 'Add exercise to Push A' }).click()
  await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Chest Dips')
  await page.getByRole('button', { name: 'Add to day' }).click()
  await expect(page.getByText('Added to the day')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Chest Dips' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add exercise to Push A' })).toBeDisabled()
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
  await expect(page.getByText('Effort this week: hard.')).toBeVisible()
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
  await page.getByRole('tab', { name: 'Lifts' }).click()
  await page.getByRole('combobox', { name: 'Lift' }).click()
  await page.getByRole('option', { name: 'Barbell Row' }).click()
  await expect(page.getByRole('combobox', { name: 'Lift' })).toHaveText('Barbell Row')
  await expect(page.getByRole('cell', { name: '62.5 kg × 7' })).toBeVisible()
  // The week's totals sit under the session count.
  await page.getByRole('tab', { name: 'Sessions' }).click()
  await expect(page.getByText(/^918\s*kg$/)).toBeVisible()

  await page.getByRole('tab', { name: 'Body' }).click()
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
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Zen mode' }).click()
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
  const text = readFileSync((await csvFile.path())!, 'utf8')
  expect(text.split('\n')[0]).toContain('Weight (kg)')
  expect(text).toContain('Barbell Row')
  expect(text).toContain('Grip gave out on rows')
  await page.getByRole('button', { name: `${today}, Pull A` }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Grip gave out on rows')).toBeVisible()
  await sheet.getByRole('button', { name: /Barbell Row/ }).click()
  await sheet
    .getByRole('region', { name: /Barbell Row/ })
    .getByLabel('Set 1 reps', { exact: true })
    .fill('9')
  await snap(page, '13-history-edit')
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Session updated')).toBeVisible()
  await expect(sheet).not.toBeVisible()
  await page.getByRole('tab', { name: 'Lifts' }).click()
  await page.getByRole('combobox', { name: 'Lift' }).click()
  await page.getByRole('option', { name: 'Barbell Row' }).click()
  await expect(page.getByRole('cell', { name: '60 kg × 9' })).toBeVisible()
  await page.getByRole('tab', { name: 'Sessions' }).click()
  await page.getByRole('button', { name: `${today}, Pull A` }).click()
  await page.getByRole('button', { name: 'Delete session' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Session removed')).toBeVisible()
  await page.getByRole('tab', { name: 'Lifts' }).click()
  await expect(page.getByText('Nothing logged yet', { exact: false })).toBeVisible()
})

test('an emailed sign-in link signs a new user in and starts setup', async () => {
  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)
  await hydrated(page)
  await snap(page, '14-login')

  await page.getByLabel('Email', { exact: true }).fill('link@example.com')
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByText('Check your email')).toBeVisible()
  await snap(page, '15-link-sent')

  usedLink = await lastMagicLink('link@example.com')
  await page.goto(usedLink)
  await expect(page).toHaveURL(/\/setup$/)
  await hydrated(page)
  await page.getByRole('button', { name: 'Continue' }).click()
  // A different split: the plan starts from that template.
  await page.getByRole('radio', { name: /^Full body/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start training' }).click()
  await expect(page.getByRole('heading', { name: 'Full body A' })).toBeVisible()
  await open(page, '/plan')
  await expect(page.getByText('Full body, 3 days', { exact: true })).toBeVisible()
})

test('accounts stay apart: a second user starts clean and the first signs back in by username', async () => {
  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)
  await hydrated(page)
  // A sign-in link works once: opening it again lands on the sign-in page with the reason.
  await page.goto(usedLink)
  await expect(page).toHaveURL(/\/login\?error=/)
  await hydrated(page)
  await expect(page.getByRole('alert')).toContainText('already used or has expired')

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await hydrated(page)
  await page.getByLabel('Username').fill('sam')
  await page.getByLabel('Email').fill('sam@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Verification code' }).fill(await lastCode('sam@example.com'))
  await page.getByRole('button', { name: 'Verify' }).click()
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

  await page.getByRole('button', { name: 'Sign in with a password instead' }).click()
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

test('settings change units, and start fresh wipes the data', async () => {
  await open(page, '/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('radio', { name: 'Pounds' }).click()
  await expect(page.getByText('Lifting in lb')).toBeVisible()
  await snap(page, '17-settings')
  // The look lives in the account menu, is kept on the device and applied before paint, so it survives a reload.
  const pickLook = async (name: string) => {
    if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: /^Account menu/ }).click()
    await page.getByRole('menuitem', { name: 'Look' }).click()
    await page.getByRole('menuitemradio', { name }).click()
    await page.keyboard.press('Escape')
  }
  await pickLook('Chalk')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'chalk')
  await snap(page, '17b-chalk')
  await pickLook('Pocket')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pocket')
  await page.reload()
  await hydrated(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pocket')
  await snap(page, '17c-pocket')
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

  await page.getByRole('button', { name: 'Start fresh' }).click()
  await expect(page.getByRole('button', { name: 'Wipe and start over' })).toBeDisabled()
  await page.getByLabel('Confirmation').fill('start fresh')
  await page.getByRole('button', { name: 'Wipe and start over' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await hydrated(page)
  await expect(page.getByText('1 of 5')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Kilograms' })).toBeChecked()
})
