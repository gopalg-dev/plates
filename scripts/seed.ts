/**
 * Seeds the development database with one account and a lived-in log, so Stats, the streak and
 * the calendar have something to show.
 *
 *   bun run db:seed                      seed@example.com / password123, 8 weeks on Push / Pull / Legs
 *   bun run db:seed -- --weeks 12 --split ul4 --email me@example.com --password hunter22
 *
 * Reads MONGODB_URI and MONGODB_DB from .env like the app. Only seeds an empty database: if any
 * account or log is already there it stops and changes nothing. Refuses a database that is not on
 * localhost unless --yes.
 */
import { hashPassword } from 'better-auth/crypto'
import { MongoClient, ObjectId } from 'mongodb'
import { buildSplit, splitInfo } from '../src/lib/splits'
import { SPLIT_IDS, type LoadType, type Muscle, type PlanDay, type SplitId } from '../src/lib/types'

// ---- arguments ----

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const email = opt('email', 'seed@example.com').toLowerCase()
const password = opt('password', 'password123')
const username = opt('username', email.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 30) || 'seed')
const weeks = Math.max(1, Number(opt('weeks', '8')))
const split = opt('split', 'ppl6') as SplitId
if (!SPLIT_IDS.includes(split)) throw new Error(`Unknown split "${split}". One of: ${SPLIT_IDS.join(', ')}`)

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB ?? 'workout_plan_v3'
/** The host only: a connection string carries the password, which must not reach a terminal or a log. */
const host = (() => {
  try {
    return new URL(uri).host
  } catch {
    return 'the configured server'
  }
})()
if (!/localhost|127\.0\.0\.1/.test(uri) && !args.includes('--yes')) {
  throw new Error(`Refusing to seed "${dbName}" on ${host}: not a local database. Pass --yes if you mean it.`)
}

// ---- the story: steady training, weight creeping down, lifts creeping up ----

/** Rough working weights by muscle, in kg, for a lifter a year in. */
const BASE: Record<Muscle, number> = {
  chest: 60,
  back: 60,
  shoulders: 30,
  biceps: 15,
  triceps: 25,
  quads: 80,
  hamstrings: 60,
  calves: 50,
  abs: 0,
}

/** Sessions land on these weekdays (Monday = 1), as many as the split needs per week. */
const TRAINING_DAYS = [1, 2, 4, 5, 6, 3, 0]

const random = (() => {
  // Deterministic, so two seeds give the same log.
  let s = 20261011
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
})()
const round = (n: number, step: number) => Math.round(n / step) * step

function at(day: Date, hour: number, minute = 0): Date {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d
}

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

interface SeedSet {
  weight?: number
  reps?: number
  seconds?: number
  done: boolean
}

/** The sets of one exercise in one session: a little heavier every fortnight, a rep or two of noise. */
function setsFor(loadType: LoadType, muscle: Muscle, sets: number, repMin: number, repMax: number, week: number): SeedSet[] {
  const out: SeedSet[] = []
  for (let i = 0; i < sets; i++) {
    const reps = repMin + Math.floor(random() * (repMax - repMin + 1))
    if (loadType === 'weight') {
      const weight = round(BASE[muscle] * (1 + 0.025 * Math.floor(week / 2)) - (i === sets - 1 ? 2.5 : 0), 2.5)
      out.push({ weight: Math.max(2.5, weight), reps, done: true })
    } else if (loadType === 'bodyweight') {
      out.push({ reps: reps + Math.floor(week / 3), done: true })
    } else {
      out.push({ seconds: round(30 + week * 2 + random() * 10, 5), done: true })
    }
  }
  return out
}

// ---- write ----

const client = new MongoClient(uri)
await client.connect()
const db = client.db(dbName)
const now = new Date()
const start = new Date(now)
start.setDate(start.getDate() - weeks * 7)
start.setHours(0, 0, 0, 0)

// A fresh database only: nothing here ever deletes or rewrites what someone logged.
const taken = ['user', 'settings', 'plan', 'workouts', 'bodyweights', 'measurements']
for (const name of taken) {
  if ((await db.collection(name).countDocuments({}, { limit: 1 })) > 0) {
    await client.close()
    throw new Error(`"${dbName}" on ${host} already has data in "${name}". Seeding only fills an empty database.`)
  }
}

// The account: made the way Better Auth's MongoDB adapter stores it, verified, password hashed with its hasher.
const _id = new ObjectId()
const stamp = { createdAt: start, updatedAt: start }
await db
  .collection('user')
  .insertOne({ _id, name: username, email, emailVerified: true, username, displayUsername: username, ...stamp })
await db.collection('account').insertOne({
  _id: new ObjectId(),
  accountId: _id.toHexString(),
  providerId: 'credential',
  userId: _id,
  password: await hashPassword(password),
  ...stamp,
})
const userId = _id.toHexString()

const days: PlanDay[] = buildSplit(split)
await db.collection('settings').insertOne({
  _id: userId as never,
  units: 'kg',
  trainingAge: 'over1',
  setupDone: true,
  joinedAt: start.toISOString(),
  split,
  schedule: 'rolling',
  bodyweight: 0,
})
await db.collection('plan').insertOne({ _id: userId as never, days, updatedAt: start.toISOString() })

// Sessions: the split's days in order, on the week's training days, skipping the odd one like a human.
const workouts: Record<string, unknown>[] = []
let dayIndex = 0
const perWeek = Math.min(days.length, 6)
for (let d = new Date(start); d < now; d.setDate(d.getDate() + 1)) {
  const weekday = d.getDay()
  if (!TRAINING_DAYS.slice(0, perWeek).includes(weekday)) continue
  if (random() < 0.08) continue
  const week = Math.floor((d.getTime() - start.getTime()) / (7 * 86_400_000))
  const day = days[dayIndex % days.length]
  dayIndex++
  const startedAt = at(d, 17, 30 + Math.floor(random() * 20))
  const finishedAt = new Date(startedAt.getTime() + (45 + Math.floor(random() * 20)) * 60_000)
  if (finishedAt > now) break
  workouts.push({
    _id: new ObjectId(),
    userId,
    dayId: day.id,
    dayName: day.name,
    dayType: day.type,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status: 'done',
    effort: random() < 0.7 ? 3 : random() < 0.5 ? 2 : 4,
    ...(random() < 0.15 ? { note: 'Felt strong on the first lift.' } : {}),
    entries: day.exercises.map((ex) => ({
      exerciseId: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      loadType: ex.loadType,
      repMin: ex.repMin,
      repMax: ex.repMax,
      sets: setsFor(ex.loadType, ex.muscle, ex.sets, ex.repMin, ex.repMax, week),
    })),
  })
}
if (workouts.length) await db.collection('workouts').insertMany(workouts)

// Weigh-ins every few days, drifting down; tape every four weeks, drifting the right way.
const bodyweights: Record<string, unknown>[] = []
const measurements: Record<string, unknown>[] = []
let weight = 80
for (let d = new Date(start), i = 0; d <= now; d.setDate(d.getDate() + 1), i++) {
  if (i % 3 === 0) {
    weight = round(weight - 0.08 + (random() - 0.5) * 0.6, 0.1)
    const date = at(d, 7, 10)
    if (date <= now) bodyweights.push({ _id: new ObjectId(), userId, date: date.toISOString(), day: dayKey(d), weight })
  }
  if (i % 28 === 0) {
    const n = i / 28
    const date = at(d, 7, 15)
    if (date <= now) {
      measurements.push({
        _id: new ObjectId(),
        userId,
        date: date.toISOString(),
        day: dayKey(d),
        arm: round(35 + n * 0.3, 0.5),
        chest: round(98 + n * 0.5, 0.5),
        waist: round(84 - n * 0.7, 0.5),
      })
    }
  }
}
if (bodyweights.length) await db.collection('bodyweights').insertMany(bodyweights)
if (measurements.length) await db.collection('measurements').insertMany(measurements)
await db.collection('settings').updateOne({ _id: userId as never }, { $set: { bodyweight: weight } })

await client.close()
console.log(
  [
    `Seeded "${dbName}" on ${host} for ${email} (password: ${password}, username: ${username})`,
    `  ${splitInfo(split).name}, ${weeks} weeks from ${dayKey(start)}`,
    `  ${workouts.length} sessions, ${bodyweights.length} weigh-ins, ${measurements.length} tape entries`,
  ].join('\n'),
)
