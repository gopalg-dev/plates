/**
 * Seeds the reference content: the split templates and the exercise library, from the bundled
 * copies into the `splits` and `library` collections. The app reads them from there.
 *
 *   bun run db:seed              adds whatever the bundle has that the database lacks; edits stay
 *   bun run db:seed -- --reset   replaces both collections with the bundle
 *   bun run db:seed -- --demo    also makes a demo account with eight weeks of logs; empty database only
 *
 * Reads MONGODB_URI and MONGODB_DB from .env like the app. Refuses a database that is not on
 * localhost unless --yes. Never prints the connection string: it carries the password.
 */
import { hashPassword } from 'better-auth/crypto'
import { MongoClient, ObjectId } from 'mongodb'
import type { SplitTemplate } from '../src/lib/content'
import type { LoadType, Muscle, PlanDay } from '../src/lib/types'
import { seedContent } from '../src/server/content'

// ---- arguments ----

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB ?? 'workout_plan_v3'
const host = (() => {
  try {
    return new URL(uri).host
  } catch {
    return 'the configured server'
  }
})()
if (!/localhost|127\.0\.0\.1/.test(uri) && !flag('yes')) {
  throw new Error(`Refusing to seed "${dbName}" on ${host}: not a local database. Pass --yes if you mean it.`)
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(dbName)

// ---- content ----

const report = await seedContent(db, { reset: flag('reset') })
console.log(
  flag('reset')
    ? `Reset content in "${dbName}" on ${host}: ${report.splits} splits, ${report.library} exercises`
    : `Content in "${dbName}" on ${host}: added ${report.splits} splits and ${report.library} exercises the database lacked, completed ${report.filled} (missing sets and range, or cut-off cues)`,
)

// ---- demo account, only when asked, only into an empty database ----

if (flag('demo')) {
  const email = opt('email', 'demo@example.com').toLowerCase()
  const password = opt('password', 'password123')
  const username = opt(
    'username',
    email
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_.]/g, '')
      .slice(0, 30) || 'demo',
  )
  const weeks = Math.max(1, Number(opt('weeks', '8')))
  const splitId = opt('split', 'ppl6')

  for (const name of ['user', 'settings', 'plan', 'plans', 'workouts', 'bodyweights', 'measurements']) {
    if ((await db.collection(name).countDocuments({}, { limit: 1 })) > 0) {
      await client.close()
      throw new Error(`"${dbName}" already has data in "${name}". The demo only goes into an empty database.`)
    }
  }
  const template = await db.collection<Omit<SplitTemplate, 'id'> & { _id: string }>('splits').findOne({ _id: splitId })
  if (!template) {
    await client.close()
    throw new Error(`Unknown split "${splitId}"`)
  }

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
  const TRAINING_DAYS = [1, 2, 4, 5, 6, 3, 0]
  const random = (() => {
    let s = 20261011
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296
      return s / 4294967296
    }
  })()
  const round = (n: number, step: number) => Math.round(n / step) * step
  const at = (day: Date, hour: number, minute = 0) => {
    const d = new Date(day)
    d.setHours(hour, minute, 0, 0)
    return d
  }
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const setsFor = (loadType: LoadType, muscle: Muscle, sets: number, repMin: number, repMax: number, week: number) =>
    Array.from({ length: sets }, (_, i) => {
      const reps = repMin + Math.floor(random() * (repMax - repMin + 1))
      if (loadType === 'weight') {
        const weight = round(BASE[muscle] * (1 + 0.025 * Math.floor(week / 2)) - (i === sets - 1 ? 2.5 : 0), 2.5)
        return { weight: Math.max(2.5, weight), reps, done: true }
      }
      if (loadType === 'bodyweight') return { reps: reps + Math.floor(week / 3), done: true }
      return { seconds: round(30 + week * 2 + random() * 10, 5), done: true }
    })

  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - weeks * 7)
  start.setHours(0, 0, 0, 0)

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
  const days: PlanDay[] = structuredClone(template.days)
  await db.collection('settings').insertOne({
    _id: userId as never,
    units: 'kg',
    trainingAge: 'over1',
    setupDone: true,
    joinedAt: start.toISOString(),
    split: splitId,
    schedule: 'rolling',
  })
  await db.collection('plans').insertOne({ userId, split: splitId, days, updatedAt: start.toISOString() })

  const workouts: Record<string, unknown>[] = []
  let dayIndex = 0
  const perWeek = Math.min(days.length, 6)
  for (let d = new Date(start); d < now; d.setDate(d.getDate() + 1)) {
    if (!TRAINING_DAYS.slice(0, perWeek).includes(d.getDay())) continue
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

  const bodyweights: Record<string, unknown>[] = []
  const measurements: Record<string, unknown>[] = []
  let weight = 80
  for (let d = new Date(start), i = 0; d <= now; d.setDate(d.getDate() + 1), i++) {
    if (i % 3 === 0) {
      weight = round(weight - 0.08 + (random() - 0.5) * 0.6, 0.1)
      const date = at(d, 7, 10)
      if (date <= now)
        bodyweights.push({ _id: new ObjectId(), userId, date: date.toISOString(), day: dayKey(d), weight })
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
  console.log(
    `Demo account ${email} (password: ${password}): ${template.name}, ${weeks} weeks, ${workouts.length} sessions, ${bodyweights.length} weigh-ins, ${measurements.length} tape entries`,
  )
}

await client.close()
