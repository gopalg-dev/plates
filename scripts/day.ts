/*
 * One day in the life of a test account, to watch Today, Stats and the Report change day by day on the dev server.
 * It writes to the database the dev server uses (MONGODB_URI and MONGODB_DB from .env), for one account only.
 *
 *   bun scripts/day.ts [--email day@example.com] [--start 2026-09-14] [--split full3] [--rest | --train] [--reset]
 *
 * The first run signs the account up (password "password123") on the start day, three weeks back when not given,
 * and plays that day. Every run after plays the next calendar day: a session on the plan's training days
 * (Monday, Wednesday and Friday on a three-day plan), a rest day otherwise; --train and --rest override that.
 * Mondays weigh in. --reset wipes the account's data and starts over. The day played last is kept in a small
 * state file in the system temp folder, keyed by the email.
 *
 * The sets are what the simulated lifter in lifter.ts allows: a capacity per lift that grows fast, then slowly,
 * fatigue across the sets, a rep to spare when the target is easy and a miss when it has run ahead, now and then a
 * lift skipped, so the log reads like a person's and the app's targets, bests and stalls behave as they would.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { hashPassword } from 'better-auth/crypto'
import { ObjectId } from 'mongodb'
import { incrementFor, stepsOf } from '../src/lib/logic/progression'
import type { LoggedSet, SplitId } from '../src/lib/types'
import { getDb } from '../src/server/db'
import * as repo from '../src/server/repo'
import { grown, repsAllowed, startCapacity } from './lifter'

// ---------------------------------------------------------------- arguments

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const flag = (name: string) => args.includes(`--${name}`)
const email = opt('email', 'day@example.com').toLowerCase()
const split = opt('split', 'full3') as SplitId
const PASSWORD = 'password123'

// ---------------------------------------------------------------- the day being played

const RealDate = Date
const stateFile = path.join(os.tmpdir(), `plates-day-${email.replace(/[^a-z0-9]/g, '_')}.json`)
const state: { played?: string } = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {}
if (flag('reset')) delete state.played

function dayAt(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new RealDate(y, m - 1, d, 18, 0, 0)
}
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const start = opt('start', keyOf(new RealDate(RealDate.now() - 21 * 86_400_000)))
const played = state.played ? new RealDate(dayAt(state.played).getTime() + 86_400_000) : dayAt(start)
if (played.getTime() > RealDate.now()) {
  console.log(`${keyOf(played)} is in the future; nothing played.`)
  process.exit(0)
}

// The app's clock is this day at 18:00, so every row the repo writes lands on it.
let clock = played.getTime()
class FakeDate extends RealDate {
  constructor(...a: unknown[]) {
    if (a.length === 0) super(clock)
    // @ts-expect-error spread into Date
    else super(...a)
  }
  static now() {
    return clock
  }
}
globalThis.Date = FakeDate as unknown as DateConstructor

// ---------------------------------------------------------------- the account

const db = await getDb()
let user = await db.collection('user').findOne({ email })
if (user && flag('reset')) {
  const uid = user._id.toHexString()
  for (const name of ['settings', 'plans', 'plan', 'workouts', 'bodyweights', 'measurements', 'feedback']) {
    await db.collection(name).deleteMany(name === 'settings' ? { _id: uid as never } : { userId: uid })
  }
  await db.collection('account').deleteMany({ userId: user._id })
  await db.collection('user').deleteOne({ email })
  console.log(`Wiped ${email}'s data.`)
  user = null
}
const first = !user
if (!user) {
  const username =
    email
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_.]/g, '')
      .slice(0, 30) || 'day'
  const _id = new ObjectId()
  const stamp = { createdAt: new Date(), updatedAt: new Date() }
  await db
    .collection('user')
    .insertOne({ _id, name: username, email, emailVerified: true, username, displayUsername: username, ...stamp })
  await db.collection('account').insertOne({
    _id: new ObjectId(),
    accountId: _id.toHexString(),
    providerId: 'credential',
    userId: _id,
    password: await hashPassword(PASSWORD),
    ...stamp,
  })
  user = await db.collection('user').findOne({ _id })
  if (!user) throw new Error('could not sign the account up')
}
const UID = user._id.toHexString()
if (first) {
  await repo.saveSettings(UID, {
    units: 'kg',
    trainingAge: 'under1',
    setupDone: true,
    bodyweight: 72,
    goal: 'gain',
    progression: 'double',
    joinedAt: new Date().toISOString(),
  })
  await repo.applySplit(UID, split)
  console.log(`Signed up ${email} / ${PASSWORD} with the ${split} split, joined ${keyOf(played)}.`)
}

// ---------------------------------------------------------------- the lifter

// Seeded by the day number, so each day rolls its own dice and a rerun of a day rolls the same.
let seed = Math.floor(played.getTime() / 86_400_000)
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

/** The reps left in the tank as the app asks for them: three or more, one or two, none. */
const left = (rir: number) => (rir >= 3 ? 3 : rir >= 1 ? 1 : 0)

async function train(): Promise<string[]> {
  const settings = await repo.getSettings(UID)
  const joined = settings.joinedAt ? new RealDate(settings.joinedAt) : played
  // How far the lifter has come: the capacity curve runs on days since the account began.
  const day = Math.max(0, Math.round((played.getTime() - joined.getTime()) / 86_400_000))
  const todayData = await repo.getTodayData(UID)
  const w = await repo.startWorkout(UID, todayData.nextDayId)
  const lines = [`${w.dayName}:`]
  const rirs: number[] = []
  let failed = 0
  for (const entry of w.entries) {
    // One lift in twenty is left blank on the day, as a real log has.
    if (rnd() < 0.05) {
      lines.push(`  ${entry.name}: skipped`)
      continue
    }
    const cap =
      grown(startCapacity(entry.name, entry.muscle, entry.loadType), entry.muscle, entry.loadType, day) *
      (1 + (rnd() - 0.5) * 0.08)
    const step = incrementFor('kg', entry.equipment, stepsOf(settings), entry.plateLoaded)
    const sets: LoggedSet[] = []
    entry.sets.forEach((_, i) => {
      const target = entry.suggested?.[i]
      const last = i === entry.sets.length - 1
      if (entry.loadType === 'weight') {
        // The app's target, or a first weight for the middle of the range, rounded down to the gym's step.
        const mid = (entry.repMin + entry.repMax) / 2
        const weight = target?.weight ?? Math.max(step, Math.floor(cap / (1 + mid / 30) / step) * step)
        const allowed = repsAllowed(cap, weight, i)
        const asked = target?.reps ?? entry.repMax
        // Stops at the target when it can, with a rep more now and then when the set was easy.
        let reps = Math.min(allowed, asked)
        if (allowed >= asked + 2 && rnd() < 0.3) reps = asked + 1
        reps = Math.max(1, reps)
        if (reps < entry.repMin) failed++
        const rir = Math.max(0, allowed - reps)
        rirs.push(rir)
        sets.push({ weight, reps, done: true, ...(last ? { left: left(rir) } : {}) })
      } else if (entry.loadType === 'time') {
        sets.push({ seconds: Math.max(5, Math.min(Math.floor(cap * (1 - 0.03 * i)), entry.repMax)), done: true })
      } else {
        sets.push({ reps: Math.max(1, Math.min(Math.floor(cap * (1 - 0.1 * i)), entry.repMax)), done: true })
      }
    })
    await repo.saveEntrySets(UID, w.id, entry.exerciseId, sets)
    const said = sets
      .map((s) =>
        s.weight !== undefined ? `${s.weight}×${s.reps}` : s.seconds !== undefined ? `${s.seconds}s` : `${s.reps}`,
      )
      .join(' ')
    lines.push(`  ${entry.name}: ${said}`)
  }
  // How it felt, the way a person rates it: by the weight lifts. Half of them failing is too much; any failing,
  // or next to nothing left in the tank, is hard; three reps to spare everywhere is easy.
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : 2
  const effort = failed / Math.max(1, rirs.length) >= 0.5 ? 4 : failed > 0 || avgRir < 0.5 ? 3 : avgRir >= 3 ? 1 : 2
  await repo.finishWorkout(UID, w.id, { effort })
  lines.push(`  effort ${['', 'easy', 'ok', 'hard', 'too much'][effort]}`)
  return lines
}

// ---------------------------------------------------------------- the day

const weekday = played.getDay() // 0 Sunday
const plan = await repo.getPlan(UID)
const trainingDays = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] }[plan.days.length] ?? [
  1, 3, 5,
]
const trains = flag('train') || (!flag('rest') && trainingDays.includes(weekday))
const name = played.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const out = [`${name}`]
if (weekday === 1 || first) {
  // A slow gain: a tenth of a kilo a week, with the scale's own wobble.
  const weeks = Math.round((played.getTime() - dayAt(start).getTime()) / (7 * 86_400_000))
  const weight = Math.round((72 + 0.1 * weeks + (rnd() - 0.5) * 0.4) * 10) / 10
  await repo.logBodyweight(UID, weight)
  out.push(`  weigh-in ${weight} kg`)
}
if (trains) out.push(...(await train()))
else out.push('  rest day')
clock = played.getTime()
state.played = keyOf(played)
fs.writeFileSync(stateFile, JSON.stringify(state))
console.log(out.join('\n'))
process.exit(0)
