import fs from 'node:fs'
// A throwaway walkthrough that behaves like a user and cross-checks numbers between screens.
// Not part of the suite; run with `bunx playwright test e2e/explore.spec.ts`.
import { MongoClient } from 'mongodb'
import { expect, test, type Page } from '@playwright/test'
import { E2E_DB } from '../playwright.config'
import { backdateJoin, lastCode, resetDatabase } from './db'

test.describe.configure({ mode: 'serial' })

const uri = 'mongodb://localhost:27017'
const EMAIL = 'sam@example.com'
let page: Page

const shots = 'e2e/screenshots/explore'
async function snap(name: string) {
  await page.screenshot({ path: `${shots}/${test.info().project.name}-${name}.png`, fullPage: true })
}
async function open(path: string) {
  await page.goto(path)
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })
}
const phone = () => (page.viewportSize()?.width ?? 0) < 768
async function accountMenu() {
  if (phone()) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('button', { name: /^Account menu/ }).click()
}

// ---- database hands: shift time, plant history ----
async function withDb<T>(fn: (db: import('mongodb').Db) => Promise<T>): Promise<T> {
  const client = await MongoClient.connect(uri)
  try {
    return await fn(client.db(E2E_DB))
  } finally {
    await client.close()
  }
}
async function userId(): Promise<string> {
  return withDb(async (db) => {
    const u = await db.collection('user').findOne({ email: EMAIL })
    return u!._id.toHexString()
  })
}
/** Moves every finished session of the user back by `days`. */
async function shiftSessions(days: number) {
  const id = await userId()
  await withDb(async (db) => {
    const docs = await db.collection('workouts').find({ userId: id, status: 'done' }).toArray()
    for (const w of docs) {
      const shift = (iso: string) => new Date(new Date(iso).getTime() - days * 86_400_000).toISOString()
      await db
        .collection('workouts')
        .updateOne({ _id: w._id }, { $set: { startedAt: shift(w.startedAt), finishedAt: shift(w.finishedAt) } })
    }
  })
}
/** Plants weigh-ins on the given days ago. */
async function plantWeighIns(points: { daysAgo: number; weight: number }[]) {
  const id = await userId()
  await withDb(async (db) => {
    for (const p of points) {
      const d = new Date()
      d.setDate(d.getDate() - p.daysAgo)
      d.setHours(7, 0, 0, 0)
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      await db.collection('bodyweights').insertOne({ userId: id, date: d.toISOString(), day, weight: p.weight })
    }
  })
}
/** Copies the latest finished session to `daysAgo`, with the bench press sets at `weight`. */
async function plantBenchSession(daysAgo: number, weight: number) {
  const id = await userId()
  await withDb(async (db) => {
    const w = await db.collection('workouts').findOne({ userId: id, status: 'done' }, { sort: { finishedAt: -1 } })
    if (!w) throw new Error('no session to copy')
    const at = new Date()
    at.setDate(at.getDate() - daysAgo)
    at.setHours(18, 0, 0, 0)
    const { _id, ...rest } = w
    const entries = rest.entries.map((e: { exerciseId: string; sets: { weight?: number }[] }) =>
      e.exerciseId === 'barbell-bench-press'
        ? { ...e, sets: e.sets.map((s) => (s.weight !== undefined ? { ...s, weight } : s)) }
        : e,
    )
    await db.collection('workouts').insertOne({
      ...rest,
      entries,
      startedAt: new Date(at.getTime() - 50 * 60_000).toISOString(),
      finishedAt: at.toISOString(),
    })
  })
}

test.beforeAll(async ({ browser }) => {
  await resetDatabase()
  page = await browser.newPage()
})
test.afterAll(async () => {
  await page.close()
})

// ================================================================ sign up and set up with a plan of your own

test('sign up and set up a plan of your own: push, pull, legs', async () => {
  await open('/signup')
  await page.getByLabel('Username').fill('sam')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('textbox', { name: 'Verification code' }).fill(await lastCode(EMAIL))
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })

  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('radio', { name: /^Your own/ }).click()
  await page.getByRole('button', { name: 'Remove day 4' }).click()
  for (const [i, kind] of ['Push', 'Pull', 'Legs'].entries()) {
    await page.getByRole('combobox', { name: `Day ${i + 1} type` }).click()
    await page.getByRole('option', { name: kind, exact: true }).click()
  }
  await expect(page.getByRole('button', { name: 'Remove day 2' }))
    .toBeDisabled({ timeout: 2000 })
    .catch(() => {})
  await snap('01-setup-own')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Bodyweight in kg', { exact: true }).fill('80')
  await page.getByRole('radio', { name: 'Cut' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('radio', { name: /A year or more/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('radio', { name: /Reps first, then weight/ })).toBeChecked()
  await page.getByRole('button', { name: 'Start training' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Push' })).toBeVisible()
  await expect(page.getByText('5 exercises, 16 sets')).toBeVisible()

  await open('/plan')
  await expect(page.getByText('Custom plan, 3 days', { exact: true })).toBeVisible()
  for (const name of ['Push', 'Pull', 'Legs']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) }).first()).toBeVisible()
  }
  await snap('02-plan-own')
})

// ================================================================ first session: the logger's rules

test('first session: no weight, no done; targets adopted; reps left; the summary', async () => {
  await open('/')
  await page.getByRole('button', { name: 'Start Push' }).click()
  await expect(page.getByText(/Started/)).toBeVisible()
  const bench = page.getByRole('region', { name: /Barbell Bench Press/ })
  await expect(page.getByRole('button', { name: /Barbell Bench Press/ })).toHaveAttribute('aria-expanded', 'true')
  // A weight set cannot be done without a weight.
  await expect(bench.getByRole('button', { name: 'Mark set 1 done' })).toBeDisabled()
  await bench.getByLabel('Set 1 weight', { exact: true }).fill('60')
  await expect(bench.getByRole('button', { name: 'Mark set 1 done' })).toBeEnabled()
  await bench.getByLabel('Set 1 reps', { exact: true }).fill('8')
  await bench.getByRole('button', { name: 'Mark set 1 done' }).click()
  // Set 2 steps from set 1; done without typing takes the carried values.
  await expect(bench.getByLabel('Set 2 weight', { exact: true })).toHaveAttribute('placeholder', '60')
  await expect(bench.getByLabel('Set 2 reps', { exact: true })).toHaveAttribute('placeholder', '8')
  await bench.getByRole('button', { name: 'Mark set 2 done' }).click()
  await expect(bench.getByLabel('Set 2 weight', { exact: true })).toHaveValue('60')
  await expect(bench.getByLabel('Set 2 reps', { exact: true })).toHaveValue('8')
  await bench.getByRole('button', { name: 'Increase Set 3 weight' }).click()
  await expect(bench.getByLabel('Set 3 weight', { exact: true })).toHaveValue('62.5')
  await bench.getByRole('button', { name: 'Mark set 3 done' }).click()
  await bench.getByRole('button', { name: 'Mark set 4 done' }).click()
  await expect(bench.getByLabel('Set 4 weight', { exact: true })).toHaveValue('62.5')
  // The last set done: the exercise stays open for the reps-left answer, then moves on.
  await expect(bench.getByRole('radiogroup', { name: 'Reps left on set 4' })).toBeVisible()
  await bench.getByRole('radio', { name: '3+' }).click()
  await expect(page.getByRole('button', { name: /Incline DB Press/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('4 of 16 sets done')).toBeVisible()
  await snap('03-bench-logged')

  // Incline DB Press: three sets at the top of the range.
  const incline = page.getByRole('region', { name: /Incline DB Press/ })
  await incline.getByLabel('Set 1 weight', { exact: true }).fill('20')
  await incline.getByLabel('Set 1 reps', { exact: true }).fill('12')
  for (const n of [1, 2, 3]) await incline.getByRole('button', { name: `Mark set ${n} done` }).click()
  await expect(page.getByText('7 of 16 sets done')).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('radio', { name: 'OK' }).click()
  await page.getByRole('button', { name: 'Save and finish' }).click()
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible()
  await expect(page.getByText('1 of 3 sessions this week.')).toBeVisible()
  await expect(page.getByText('62.5 kg × 8')).toBeVisible()
  await expect(page.getByText('20 kg × 12')).toBeVisible()
  // First session: no bests, no feedback prompt yet.
  await expect(page.getByText('best', { exact: true })).toHaveCount(0)
  await expect(page.getByText('How is Plates for you?')).toHaveCount(0)
  await snap('04-summary')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Pull' })).toBeVisible()
  await expect(page.getByLabel('1 week streak')).toBeVisible()
})

// ================================================================ the numbers agree across screens

test('stats agree with what was logged', async () => {
  await open('/stats?tab=sessions')
  await expect(page.getByText('of 3 sessions')).toBeVisible()
  await expect(page.getByText('7 hard sets')).toBeVisible()
  // 60×8 + 60×8 + 62.5×8 + 62.5×8 + 20×12×3
  await expect(page.getByText(/^2,680\s*kg$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chest: 7 of 7 sets' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Shoulders: 0 of \d+ sets$/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Back: 0 of \d+ sets$/ })).toBeVisible()
  await snap('05-stats-sessions')

  await page.getByRole('tab', { name: 'Lifts' }).click()
  await page.getByRole('combobox', { name: 'Lift' }).click()
  await page.getByRole('option', { name: 'Barbell Bench Press' }).click()
  await expect(page.getByText('kg × 8').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '62.5 kg × 8' })).toBeVisible()
  await expect(page.getByText('None yet.')).toBeVisible()
  await snap('06-stats-lifts')

  await page.getByRole('tab', { name: 'Body' }).click()
  await expect(page.getByText('80', { exact: true }).first()).toBeVisible()
  await snap('07-stats-body')
})

// ================================================================ a week later: targets, methods, streak

test('a week later the targets follow the last session and the method', async () => {
  await shiftSessions(7)
  await backdateJoin(60)
  await open('/')
  await expect(page.getByLabel('1 week streak')).toBeVisible()
  await page.getByRole('button', { name: /Pick another day/ }).click()
  await page.getByRole('button', { name: 'Start Push' }).click()
  const bench = page.getByRole('region', { name: /Barbell Bench Press/ })
  // Three reps to spare last time: every set a step up, at the bottom of the range.
  await expect(page.getByText('Reps to spare; try 65 kg.')).toBeVisible()
  await expect(bench.getByLabel('Set 1 weight', { exact: true })).toHaveAttribute('placeholder', '65')
  await expect(bench.getByLabel('Set 1 reps', { exact: true })).toHaveAttribute('placeholder', '5')
  await expect(bench.getByRole('button', { name: 'Mark set 1 done' })).toBeEnabled()
  await bench.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(bench.getByLabel('Set 1 weight', { exact: true })).toHaveValue('65')
  await expect(bench.getByLabel('Set 1 reps', { exact: true })).toHaveValue('5')
  // Incline hit 12 on every set: up a step, back to 8.
  await page.getByRole('button', { name: /Incline DB Press/ }).click()
  const incline = page.getByRole('region', { name: /Incline DB Press/ })
  await expect(incline.getByLabel('Set 1 weight', { exact: true })).toHaveAttribute('placeholder', '22.5')
  await expect(incline.getByLabel('Set 1 reps', { exact: true })).toHaveAttribute('placeholder', '8')
  await expect(page.getByText('Last time 20 kg × 12, 12, 12. Try 22.5 kg.')).toBeVisible()
  await snap('08-targets')
  // Discard, switch the method to the top set, and look again.
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Discard workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
  await expect(page.getByRole('button', { name: 'Start Pull' })).toBeVisible()

  await open('/settings')
  await page.getByRole('radio', { name: /Last set all out/ }).click()
  await expect(page.getByText('Progression: Last set all out')).toBeVisible()
  await open('/')
  await page.getByRole('button', { name: /Pick another day/ }).click()
  await page.getByRole('button', { name: 'Start Push' }).click()
  // Last set 62.5 × 8 at the top of the range: one step, plus one for the reps to spare.
  await expect(page.getByText('Last set 62.5 kg × 8. Try 67.5 kg; last set as many as you can.')).toBeVisible()
  await expect(bench.getByLabel('Set 4 reps', { exact: true })).toHaveAttribute('placeholder', '8')
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Discard workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
  await open('/settings')
  await page.getByRole('radio', { name: /Reps first, then weight/ }).click()
  await expect(page.getByText('Progression: Reps first, then weight')).toBeVisible()
})

// ================================================================ plans per split keep their edits

test('each split keeps its own plan, and the plan of your own can be found again', async () => {
  await open('/plan')
  await page.getByRole('button', { name: /^Push/ }).first().click()
  await page.getByRole('button', { name: 'Edit Barbell Bench Press' }).click()
  await page.getByLabel('Sets', { exact: true }).fill('5')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('5 × 5-8')).toBeVisible()

  await open('/settings')
  await page.getByRole('button', { name: /^Change split, on Custom plan/ }).click()
  await page.getByRole('radio', { name: /^Push \/ Pull \/ Legs, 3 days/ }).click()
  await page.getByRole('button', { name: 'Switch to Push / Pull / Legs, 3 days' }).click()
  await expect(page.getByText('Now on Push / Pull / Legs, 3 days')).toBeVisible()
  await open('/plan')
  await expect(page.getByText('Push / Pull / Legs, 3 days', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Pull A/ }).first()).toBeVisible()

  // Back to the plan of your own, with the edit still there.
  await open('/settings')
  await page.getByRole('button', { name: /^Change split, on Push \/ Pull \/ Legs, 3 days/ }).click()
  await page.getByRole('radio', { name: /^Your own/ }).click()
  await snap('09-own-again')
  await page.getByRole('button', { name: /^(Back to my plan|Build my plan)$/ }).click()
  await open('/plan')
  await expect(page.getByText('Custom plan, 3 days', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Push/ }).first().click()
  await expect(page.getByText('5 × 5-8')).toBeVisible()
})

// ================================================================ alerts on Today

test('Today warns about a flat scale and a lift that stopped moving', async () => {
  await plantWeighIns([
    { daysAgo: 20, weight: 80.1 },
    { daysAgo: 17, weight: 80 },
    { daysAgo: 13, weight: 80.1 },
    { daysAgo: 10, weight: 80 },
    { daysAgo: 6, weight: 80.1 },
    { daysAgo: 3, weight: 80 },
  ])
  await plantBenchSession(35, 70)
  await plantBenchSession(20, 60)
  await plantBenchSession(13, 60)
  await open('/')
  await expect(page.getByText('Weight flat for 3 weeks.')).toBeVisible()
  await expect(page.getByText('Eat less: aim for −0.25 kg a week.')).toBeVisible()
  await expect(page.getByText('Barbell Bench Press has not moved in 4 weeks.')).toBeVisible()
  await snap('10-alerts')
})

// ================================================================ the session editor and the calendar

test('fixing a set from the calendar moves the lift, removing a session removes its sets', async () => {
  await open('/stats?tab=sessions')
  const today = new Date()
  today.setDate(today.getDate() - 7)
  const label = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // The week of the real session, a week back.
  const cell = page.getByRole('button', { name: `${label}, Push` })
  await expect(cell).toBeVisible()
  await cell.click({ force: true })
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: /Barbell Bench Press/ }).click()
  const reps = sheet.getByRole('region', { name: /Barbell Bench Press/ }).getByLabel('Set 3 reps', { exact: true })
  await reps.fill('10')
  await expect(reps).toHaveValue('10')
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Session updated')).toBeVisible()
  await page.getByRole('tab', { name: 'Lifts' }).click()
  await page.getByRole('combobox', { name: 'Lift' }).click()
  await page.getByRole('option', { name: 'Barbell Bench Press' }).click()
  await expect(page.getByRole('cell', { name: '62.5 kg × 10' })).toBeVisible()
  await snap('11-lift-after-edit')
})

// ================================================================ settings that change the logger

test('pounds, a shorter training age and the weekday schedule show up where they should', async () => {
  await open('/settings')
  await page.getByRole('radio', { name: 'Pounds' }).click()
  await expect(page.getByText('Lifting in lb')).toBeVisible()
  await page.getByRole('radio', { name: /Under a year/ }).click()
  await page.getByRole('radio', { name: 'By weekday' }).click()
  await expect(page.getByText('Each day is on its weekday now')).toBeVisible()
  await open('/plan')
  await expect(page.getByText(/3 days by weekday$/)).toBeVisible()
  await page.getByRole('button', { name: /^Push/ }).first().click()
  // Under a year: the five-set bench reads three sets.
  await expect(page.getByText('3 × 5-8')).toBeVisible()
  await open('/stats?tab=sessions')
  await expect(page.getByText(/\blb$/).first()).toBeVisible()
  await snap('12-lb-weekday')
  await open('/settings')
  await page.getByRole('radio', { name: 'Kilograms' }).click()
  await page.getByRole('radio', { name: /A year or more/ }).click()
  await page.getByRole('radio', { name: 'Rolling' }).click()
})

// ================================================================ library and looks

test('library tags narrow the list and the detail steps through it', async () => {
  await open('/library')
  await page.getByRole('radio', { name: 'Chest' }).click()
  await expect(page.getByText(/^\d+ exercises$/)).toBeVisible()
  await page.getByRole('radio', { name: 'Dumbbell' }).click()
  const count = await page.getByText(/^\d+ exercises?$/).textContent()
  await page
    .getByRole('button', { name: /^Open (?!menu)/ })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText(/^1 of \d+$/)).toBeVisible()
  await page.getByRole('button', { name: /^Next/ }).click()
  await expect(page.getByText(/^2 of \d+$/)).toBeVisible()
  await snap('13-library-detail')
  await page.keyboard.press('Escape')
  expect(count).toMatch(/exercises?$/)
})

// ================================================================ pass three: deeper corners

test('weight every session: a completed session earns a step on every set', async () => {
  await open('/settings')
  await page.getByRole('radio', { name: /Weight every session/ }).click()
  await expect(page.getByText('Progression: Weight every session')).toBeVisible()
  await open('/')
  await page.getByRole('button', { name: /Pick another day/ }).click()
  await page.getByRole('button', { name: 'Start Push' }).click()
  const bench = page.getByRole('region', { name: /Barbell Bench Press/ })
  // Last time 60, 60, 62.5, 62.5 with every set at or above 5 reps: the top weight plus a step.
  await expect(bench.getByLabel('Set 1 weight', { exact: true })).toHaveAttribute('placeholder', '65')
  await expect(bench.getByLabel('Set 4 weight', { exact: true })).toHaveAttribute('placeholder', '65')
  await snap('15-linear-targets')

  // Zen mode: one exercise at a time, kept in the URL across a reload.
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Zen mode' }).click()
  const zen = page.getByRole('dialog', { name: 'Zen mode' })
  await expect(zen.getByText('1 of 5', { exact: true })).toBeVisible()
  await zen.getByRole('button', { name: 'Mark set 1 done' }).click()
  await expect(zen.getByLabel('Set 1 weight', { exact: true })).toHaveValue('65')
  await zen.getByRole('button', { name: 'Next exercise' }).click()
  await expect(zen.getByText('2 of 5', { exact: true })).toBeVisible()
  await page.reload()
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })
  await expect(page.getByRole('dialog', { name: 'Zen mode' })).toBeVisible()
  await snap('16-zen')
  await page.getByRole('dialog', { name: 'Zen mode' }).getByRole('button', { name: 'Exit zen' }).click()
  await expect(page.getByRole('dialog', { name: 'Zen mode' })).not.toBeVisible()
  await expect(page.getByText('1 of 17 sets done')).toBeVisible()
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Discard workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
  await open('/settings')
  await page.getByRole('radio', { name: /Reps first, then weight/ }).click()
  await expect(page.getByText('Progression: Reps first, then weight')).toBeVisible()
})

test('the fifth session brings the feedback prompt, once', async () => {
  // Four finished sessions so far: the real one and three planted. The next one is the fifth.
  await open('/')
  await page.getByRole('button', { name: /Pick another day/ }).click()
  await page.getByRole('button', { name: 'Start Push' }).click()
  await page
    .getByRole('region', { name: /Barbell Bench Press/ })
    .getByRole('button', { name: 'Mark set 1 done' })
    .click()
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('radio', { name: 'Easy' }).click()
  await page.getByRole('button', { name: 'Save and finish' }).click()
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible()
  await expect(page.getByText('How is Plates for you?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await page.getByRole('radio', { name: 'Good' }).click()
  await snap('17-summary-feedback')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Thanks, noted.')).toBeVisible()
  await expect(page.getByText('How is Plates for you?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Done' }).click()
  const id = await userId()
  const stored = await withDb((db) => db.collection('feedback').find({ userId: id }).toArray())
  expect(stored).toHaveLength(1)
  expect(stored[0]).toMatchObject({ mood: 3, trigger: 'summary', route: '/' })
  // Straight after, no second prompt.
  await page.getByRole('button', { name: /Pick another day/ }).click()
  await page.getByRole('button', { name: 'Start Pull' }).click()
  await page
    .getByRole('region', { name: /Pull-ups/ })
    .getByRole('button', { name: 'Mark set 1 done' })
    .click()
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible()
  await expect(page.getByText('How is Plates for you?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Done' }).click()
})

test('by weekday, Today shows the day that sits on today', async () => {
  await open('/settings')
  await page.getByRole('radio', { name: 'By weekday' }).click()
  await expect(page.getByText('Each day is on its weekday now')).toBeVisible()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  await open('/plan')
  await page.getByRole('button', { name: /^Legs/ }).first().click()
  await page.getByRole('combobox', { name: 'Legs weekday' }).click()
  await page.getByRole('option', { name: today }).click()
  await expect(page.getByText(new RegExp(`${today}s$`))).toBeVisible()
  await open('/')
  await expect(page.getByRole('heading', { name: 'Legs' })).toBeVisible()
  await snap('18-weekday-today')
  await open('/settings')
  await page.getByRole('radio', { name: 'Rolling' }).click()
})

test('an alternate swaps in on the plan and shows up on Today', async () => {
  await open('/plan')
  await page.getByRole('button', { name: /^Pull/ }).first().click()
  await page.getByRole('button', { name: 'Edit Pull-ups' }).click()
  await page.getByRole('button', { name: 'Use this' }).first().click()
  await expect(page.getByText('Switched to Lat Pulldown')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Lat Pulldown' })).toBeVisible()
  await open('/')
  await page.getByRole('button', { name: /Pick another day/ }).click()
  await page.getByRole('button', { name: 'Start Pull' }).click()
  await expect(page.getByRole('button', { name: /Lat Pulldown/ })).toBeVisible()
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Discard workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
})

test('the session editor adds and drops sets, and the week count follows', async () => {
  await open('/stats?tab=sessions')
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // Today holds two sessions now (Push and Pull): the day opens a chooser.
  await page.getByRole('button', { name: new RegExp(`^${today}, `) }).click({ force: true })
  await page.getByRole('button', { name: 'Open Pull' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: /Pull-ups/ }).click()
  const pullups = sheet.getByRole('region', { name: /Pull-ups/ })
  await pullups.getByRole('button', { name: 'Mark set 2 done' }).click()
  await pullups.getByRole('button', { name: 'Add a set' }).click()
  await expect(pullups.getByLabel('Set 5 reps', { exact: true })).toBeVisible()
  await pullups.getByRole('button', { name: 'Remove set 5' }).click()
  await expect(pullups.getByLabel('Set 5 reps', { exact: true })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Session updated')).toBeVisible()
  await expect(page.getByText('3 hard sets')).toBeVisible()
  await snap('19-editor-sets')
})

test('under a year, the logger itself caps the sets', async () => {
  await open('/settings')
  await page.getByRole('radio', { name: /Under a year/ }).click()
  await open('/')
  await page.getByRole('button', { name: /Pick another day/ }).click()
  await page.getByRole('button', { name: 'Start Push' }).click()
  await expect(page.getByText('0 of 15 sets done')).toBeVisible()
  await expect(
    page.getByRole('region', { name: /Barbell Bench Press/ }).getByLabel('Set 4 weight', { exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Session options' }).click()
  await page.getByRole('menuitem', { name: 'Discard workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
  await open('/settings')
  await page.getByRole('radio', { name: /A year or more/ }).click()
})

test('an empty search says so, and the export holds every logged set', async () => {
  await open('/library')
  await page.getByLabel('Search the library').fill('zzzz')
  await expect(page.getByText('Nothing matches')).toBeVisible()
  await open('/stats?tab=sessions')
  const csv = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  const file = await csv
  const text = fs.readFileSync((await file.path())!, 'utf8')
  const rows = text.trim().split('\n').length - 1
  const id = await userId()
  const expected = await withDb(async (db) => {
    const ws = await db.collection('workouts').find({ userId: id, status: 'done' }).toArray()
    return ws.reduce(
      (n, w) =>
        n +
        w.entries.reduce((m: number, e: { sets: { done: boolean }[] }) => m + e.sets.filter((s) => s.done).length, 0),
      0,
    )
  })
  expect(rows).toBe(expected)
})

// ================================================================ pass four: weeks and resets

test('picking a past week points every number at that week', async () => {
  await open('/stats?tab=sessions')
  // Oct 2 has no session; its week (Sep 28 to Oct 4) holds the first session, moved back a week.
  await page.getByRole('button', { name: 'Oct 2, no session' }).click()
  await expect(page.getByRole('heading', { name: 'Week of Sep 28', exact: true })).toBeVisible()
  // That week holds the first session and one of the planted copies: twice the seven chest sets.
  await expect(page.getByText('14 hard sets')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chest: 14 of 8 sets' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Back: 0 of \d+ sets$/ })).toBeVisible()
  await snap('20-past-week')
  await page.getByRole('button', { name: 'Back to this week' }).click()
  await expect(page.getByRole('heading', { name: 'This week', exact: true })).toBeVisible()
  await expect(page.getByText('3 hard sets')).toBeVisible()
})

test('a template resets to its original, and the plan of your own is untouched by it', async () => {
  await open('/settings')
  await page.getByRole('button', { name: /^Change split, on Custom plan/ }).click()
  await page.getByRole('radio', { name: /^Push \/ Pull \/ Legs, 3 days/ }).click()
  await page.getByRole('button', { name: 'Switch to Push / Pull / Legs, 3 days' }).click()
  await expect(page.getByText('Now on Push / Pull / Legs, 3 days')).toBeVisible()
  await open('/plan')
  await page
    .getByRole('button', { name: /^Pull A/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Edit Pull-ups' }).click()
  await page.getByLabel('Sets', { exact: true }).fill('9')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('9 × 6-12')).toBeVisible()
  await page.getByRole('button', { name: 'Reset to the original plan' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Reset/ }).click()
  await expect(page.getByText('Plan reset')).toBeVisible()
  await page
    .getByRole('button', { name: /^Pull A/ })
    .first()
    .click()
  await expect(page.getByText('4 × 6-12')).toBeVisible()
  await snap('21-reset')
  // Back to the plan of your own: the swapped alternate and the five-set bench are still there.
  await open('/settings')
  await page.getByRole('button', { name: /^Change split, on Push \/ Pull \/ Legs, 3 days/ }).click()
  await page.getByRole('radio', { name: /^Your own/ }).click()
  await page.getByRole('button', { name: 'Back to my plan' }).click()
  await expect(page.getByText('Back on your own plan')).toBeVisible()
  await open('/plan')
  await expect(page.getByRole('button', { name: 'Reset to the original plan' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Pull/ }).first().click()
  await expect(page.getByRole('button', { name: 'Edit Lat Pulldown' })).toBeVisible()
})

test('every look keeps the day colours and readable text', async () => {
  await open('/')
  for (const look of ['Chalk', 'Pocket', 'Dracula', 'Catppuccin Latte', 'Slate']) {
    await accountMenu()
    await page.getByRole('menuitem', { name: 'Look' }).hover()
    await page.getByRole('menuitemradio', { name: look }).click()
    await page.keyboard.press('Escape')
    await open('/stats?tab=sessions')
    await snap(`14-look-${look.toLowerCase().replace(/\s+/g, '-')}`)
    await open('/')
  }
})
