/**
 * Two years of a beginner using Plates, driven through the real server code (repo.*) against a
 * throwaway local database, with a fake clock. A lifter model answers every session: how many reps
 * it can do at the weight the app asks for, how the session felt, reps left on the last set.
 *
 *   bun run db:simulate -- [split] [progression] [days]            one run, prints the summary
 *   bun run db:simulate -- matrix [splits] [methods] [days]        every split × method, writes results.json
 *   bun run db:simulate -- seed [split] [method] [days] [--email …]  two years for a new account in the dev database
 *
 * Needs the local MongoDB (bun run db:up). Uses its own database, workout_plan_v3_sim, and drops it first.
 * Results land beside this file: scripts/sim-results.json or scripts/sim-run-<split>-<method>.json.
 */
import './sim-env'
import fs from 'node:fs'
import path from 'node:path'
import { hashPassword } from 'better-auth/crypto'
import { MongoClient, ObjectId } from 'mongodb'
import { deloadHint } from '../src/lib/logic/effort'
import { incrementFor } from '../src/lib/logic/progression'
import { attachBodyweight, epley, weeklyStrength } from '../src/lib/logic/stats'
import { liftTrend } from '../src/lib/logic/trend'
import type { LoggedSet, Progression } from '../src/lib/types'
import * as repo from '../src/server/repo'

// ---------------------------------------------------------------- fake clock

const RealDate = Date
let clock = new RealDate(2024, 9, 14, 18, 0, 0).getTime() // Monday 14 Oct 2024, 18:00
class FakeDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(clock)
    // @ts-expect-error spread into Date
    else super(...args)
  }
  static now() {
    return clock
  }
}
globalThis.Date = FakeDate as unknown as DateConstructor
const today = () => new RealDate(clock)
const advance = (days: number) => (clock += days * 86_400_000)

// ---------------------------------------------------------------- deterministic noise

let seed = 12345
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

// ---------------------------------------------------------------- the lifter

/** Starting capacity of a 60 kg beginner: a one-rep max in kg per lift, by its name and muscle. */
function startCapacity(name: string, muscle: string, loadType: string): number {
  const n = name.toLowerCase()
  if (loadType === 'time') return 30 // seconds
  if (loadType === 'bodyweight') {
    if (/pull-?up|chin-?up/.test(n)) return 4
    if (/dip/.test(n)) return 6
    if (/push-?up/.test(n)) return 15
    return 8
  }
  const base: Record<string, number> = {
    chest: 45,
    back: 50,
    shoulders: 30,
    biceps: 25,
    triceps: 30,
    quads: 70,
    hamstrings: 70,
    calves: 90,
    abs: 30,
  }
  let c = base[muscle] ?? 40
  if (/leg press/.test(n)) c *= 1.8
  else if (/deadlift/.test(n)) c *= 1.4
  else if (/hip thrust/.test(n)) c *= 1.5
  else if (/shrug/.test(n)) c *= 1.5
  // Small isolation lifts are set per hand already; the dumbbell factor applies only to presses and rows.
  else if (/lateral raise|rear delt|reverse fly/.test(n)) return c * 0.4
  else if (/face pull/.test(n)) c *= 0.6
  else if (/fly/.test(n)) c *= 0.5
  else if (/pushdown|extension|skull/.test(n)) c *= 0.8
  else if (/curl/.test(n) && muscle !== 'hamstrings') c *= 1.0
  if (/\bdb\b|dumbbell/.test(n)) c *= 0.4 // one hand
  return c
}

const LOWER = new Set(['quads', 'hamstrings', 'calves'])

/** Gains come fast, then slow: a saturating curve over the two years. */
function grown(cap0: number, muscle: string, loadType: string, day: number): number {
  const A = loadType === 'weight' ? (LOWER.has(muscle) ? 1.2 : 0.9) : 2.0
  const tau = loadType === 'weight' ? 220 : 250
  return cap0 * (1 + A * (1 - Math.exp(-day / tau)))
}

// ---------------------------------------------------------------- one run

interface SetLog {
  w: number
  reps: number
  target?: number
  targetReps?: number
  failed: boolean
}
interface EntryLog {
  id: string
  name: string
  loadType: string
  sets: SetLog[]
  hint?: string
  rampOffer: boolean
  ramped: boolean
  planSets: number
}
interface SessionLog {
  day: number
  date: string
  dayId: string
  dayName: string
  effort: number
  deload: boolean
  entries: EntryLog[]
}
interface RunResult {
  split: string
  progression: Progression
  sessions: SessionLog[]
  alerts: { day: number; kind: string; title: string }[]
  deloads: number[]
  trends: { day: number; lift: string; trend: string }[]
  anomalies: string[]
  months: { day: number; lifts: Record<string, { w: number; reps: number; e1rm: number; sets: number }> }[]
}

let UID = 'sim-user'

async function run(
  split: string,
  progression: Progression,
  totalDays: number,
  client: MongoClient,
  into?: { db: string; userId: string },
): Promise<RunResult> {
  if (into) {
    // Into a real database for one account: that account's own rows go first, nothing else is touched.
    process.env.MONGODB_DB = into.db
    UID = into.userId
    const live = client.db(into.db)
    for (const name of ['settings', 'plans', 'plan', 'workouts', 'bodyweights', 'measurements', 'feedback']) {
      await live.collection(name).deleteMany(name === 'settings' ? { _id: UID as never } : { userId: UID })
    }
  } else {
    UID = 'sim-user'
    const db = client.db('workout_plan_v3_sim')
    await db.dropDatabase()
    if (process.env.MONGODB_DB !== 'workout_plan_v3_sim') throw new Error('refusing to run outside the sim database')
  }
  clock = new RealDate(2024, 9, 14, 18, 0, 0).getTime()
  seed = 12345

  const result: RunResult = {
    split,
    progression,
    sessions: [],
    alerts: [],
    deloads: [],
    trends: [],
    anomalies: [],
    months: [],
  }
  await repo.saveSettings(UID, {
    units: 'kg',
    trainingAge: 'under1',
    setupDone: true,
    bodyweight: 60,
    goal: 'gain',
    progression,
  })
  await repo.applySplit(UID, split)
  let plan = await repo.getPlan(UID)
  const cap0 = new Map<string, number>()
  const info = new Map<string, { muscle: string; loadType: string }>()
  for (const d of plan.days)
    for (const e of d.exercises) {
      cap0.set(e.id, startCapacity(e.name, e.muscle, e.loadType))
      info.set(e.id, { muscle: e.muscle, loadType: e.loadType })
    }
  const trainingDays = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] }[
    plan.days.length
  ] ?? [1, 3, 5]
  const chosen = new Map<string, number>() // the weight the lifter last used per lift, for lifts with no target yet
  let deloadWeek = false
  let bw = 60

  for (let day = 0; day <= totalDays; day++) {
    const wd = today().getDay()
    // Monday: weigh in, check the deload hint, switch training age after a year.
    if (wd === 1) {
      bw = 60 + 8 * (day / totalDays)
      await repo.logBodyweight(UID, Math.round(bw * 10) / 10)
      // Tape day every four weeks: arm, chest and waist, all growing with the gain.
      if (day % 28 === 0) {
        const t = day / totalDays
        const cm = (from: number, to: number) => Math.round((from + (to - from) * t + (rnd() - 0.5) * 0.6) * 10) / 10
        await repo.logMeasurement(UID, { arm: cm(30, 36), chest: cm(88, 100), waist: cm(76, 82) })
      }
      const all = attachBodyweight(await repo.listWorkouts(UID, { sinceDays: 365 }), await repo.listBodyweights(UID))
      const hint = deloadHint(all, today())
      if (hint && !deloadWeek) {
        result.deloads.push(day)
        await repo.resetRamp(UID)
        deloadWeek = true
      } else deloadWeek = false
      if (day === 364) await repo.saveSettings(UID, { trainingAge: 'over1' })
    }
    const vacation = (day >= 180 && day < 190) || (day >= 540 && day < 550)
    const trains = trainingDays.includes(wd) && !vacation && rnd() > 0.05
    if (trains) {
      const todayData = await repo.getTodayData(UID)
      if (wd === 1) for (const a of todayData.alerts) result.alerts.push({ day, kind: a.kind, title: a.title })
      const w = await repo.startWorkout(UID, todayData.nextDayId)
      const session: SessionLog = {
        day,
        date: today().toISOString().slice(0, 10),
        dayId: w.dayId,
        dayName: w.dayName,
        effort: 2,
        deload: deloadWeek,
        entries: [],
      }
      const rirs: number[] = []
      let failed = 0
      for (let entry of w.entries) {
        const meta = info.get(entry.exerciseId) ?? { muscle: entry.muscle, loadType: entry.loadType }
        const cap =
          grown(
            cap0.get(entry.exerciseId) ?? startCapacity(entry.name, entry.muscle, entry.loadType),
            meta.muscle,
            meta.loadType,
            day,
          ) *
          (1 + (rnd() - 0.5) * 0.08)
        let ramped = false
        if (entry.rampOffer && rnd() < 0.8 && !deloadWeek) {
          entry = await repo.acceptRamp(UID, w.id, entry.exerciseId)
          ramped = true
        }
        const planEx = (await repo.getPlan(UID)).days
          .find((d) => d.id === w.dayId)
          ?.exercises.find((e) => e.id === entry.exerciseId)
        const log: EntryLog = {
          id: entry.exerciseId,
          name: entry.name,
          loadType: entry.loadType,
          sets: [],
          hint: entry.hint,
          rampOffer: !!entry.rampOffer,
          ramped,
          planSets: planEx?.sets ?? entry.sets.length,
        }
        const sets: LoggedSet[] = []
        const n = deloadWeek ? Math.ceil(entry.sets.length / 2) : entry.sets.length
        for (let i = 0; i < n; i++) {
          const fatigue = 1 - 0.03 * i
          const target = entry.suggested?.[i]
          if (entry.loadType === 'weight') {
            const step = incrementFor(entry.muscle, 'kg', entry.equipment, 2.5)
            let wgt = target?.weight ?? chosen.get(entry.exerciseId)
            if (wgt === undefined) {
              // First time: a weight for the middle of the range, rounded down to a plate step.
              const mid = (entry.repMin + entry.repMax) / 2
              wgt = Math.max(step, Math.floor(cap / (1 + mid / 30) / step) * step)
            }
            const achievable = Math.max(0, Math.floor(30 * ((cap * fatigue) / wgt - 1)))
            const amrap = progression === 'topset' && i === n - 1
            let reps = amrap ? Math.min(30, achievable) : Math.min(achievable, entry.repMax)
            if (deloadWeek) reps = Math.min(reps, entry.repMin)
            reps = Math.max(1, reps)
            const isFailed = reps < entry.repMin
            if (isFailed) failed++
            const rir = Math.max(0, achievable - reps)
            rirs.push(rir)
            const set: LoggedSet = { weight: wgt, reps, done: true }
            if (i === n - 1) set.left = rir >= 3 ? 3 : rir >= 1 ? 1 : 0
            sets.push(set)
            log.sets.push({ w: wgt, reps, target: target?.weight, targetReps: target?.reps, failed: isFailed })
            chosen.set(entry.exerciseId, wgt)
          } else if (entry.loadType === 'time') {
            const seconds = Math.min(Math.floor(cap * fatigue), entry.repMax)
            sets.push({ seconds, done: true })
            log.sets.push({ w: 0, reps: seconds, target: target?.seconds, failed: seconds < entry.repMin })
          } else {
            // Bodyweight: what the body allows. Short of the range it is logged as it is, and does not colour the rating.
            const achievable = Math.floor(cap * (1 - 0.1 * i))
            const reps = Math.max(1, Math.min(achievable, entry.repMax))
            sets.push({ reps, done: true })
            log.sets.push({ w: 0, reps, target: target?.reps, failed: reps < entry.repMin })
          }
        }
        // Sets left undone on a deload stay blank.
        for (let i = n; i < entry.sets.length; i++) sets.push({ done: false })
        await repo.saveEntrySets(UID, w.id, entry.exerciseId, sets)
        session.entries.push(log)
      }
      // How it felt, the way a person rates it: by the weight lifts. Half of them failing is too much; any
      // failing, or nothing left in the tank, is hard; three reps to spare everywhere is easy.
      const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : 2
      const weightSets = Math.max(1, rirs.length)
      session.effort = deloadWeek
        ? 1
        : failed / weightSets >= 0.5
          ? 4
          : failed > 0 || avgRir < 1
            ? 3
            : avgRir >= 3
              ? 1
              : 2
      await repo.finishWorkout(UID, w.id, { effort: session.effort })
      result.sessions.push(session)
    }
    // Month end: a snapshot of every lift's best set and the plan's sets.
    if (day % 30 === 0 && day > 0) {
      plan = await repo.getPlan(UID)
      const all = attachBodyweight(await repo.listWorkouts(UID, { sinceDays: 365 }), await repo.listBodyweights(UID))
      const lifts: RunResult['months'][number]['lifts'] = {}
      for (const d of plan.days)
        for (const e of d.exercises) {
          const weeks = weeklyStrength(all, e.id)
          const last = weeks[weeks.length - 1]
          if (last)
            lifts[e.name] = {
              w: last.weight,
              reps: last.reps || last.seconds,
              e1rm: Math.round(epley(last.weight, last.reps) * 10) / 10,
              sets: e.sets,
            }
          if (weeks.length) result.trends.push({ day, lift: e.name, trend: liftTrend(weeks, today()) })
        }
      result.months.push({ day, lifts })
    }
    advance(1)
  }
  findAnomalies(result)
  return result
}

// ---------------------------------------------------------------- checks

function findAnomalies(r: RunResult) {
  const bySession = r.sessions
  const lastTop = new Map<string, { w: number; day: number; failed: boolean; allTop: boolean }>()
  const flat = new Map<string, number>()
  const short = new Map<string, number>()
  const noBump = new Map<string, number>()
  for (const s of bySession) {
    for (const e of s.entries) {
      if (e.loadType === 'bodyweight') {
        // A bodyweight lift under its range for a long run: the app never offers the easier alternate.
        if (e.sets.every((x) => x.failed)) short.set(e.id, (short.get(e.id) ?? 0) + 1)
        else short.set(e.id, 0)
        if ((short.get(e.id) ?? 0) === 12)
          r.anomalies.push(`${s.date} ${e.name}: under its rep range for 12 sessions, nothing changed`)
        continue
      }
      if (e.loadType !== 'weight') continue
      // Every set at the top of the range, session rated ok or easier, and the next target did not move.
      const prevNo = noBump.get(e.id)
      if (prevNo !== undefined && e.sets[0]?.target !== undefined && e.sets[0].target <= prevNo)
        r.anomalies.push(
          `${s.date} ${e.name}: every set topped out last time, felt fine, target still ${e.sets[0].target}`,
        )
      const topped = e.sets.every((x) => x.reps >= (x.targetReps ?? 0) && !x.failed)
      if (topped && s.effort <= 2 && r.progression !== 'topset') noBump.set(e.id, Math.max(...e.sets.map((x) => x.w)))
      else noBump.delete(e.id)
      const top = Math.max(...e.sets.map((x) => x.w))
      const prev = lastTop.get(e.id)
      if (prev) {
        const t = e.sets[0]?.target
        if (t !== undefined && t % 1.25 !== 0)
          r.anomalies.push(`${s.date} ${e.name}: target ${t} is not on a plate step`)
        if (t !== undefined && t < prev.w * 0.85 && !s.deload)
          r.anomalies.push(`${s.date} ${e.name}: target ${t} fell from ${prev.w} without a deload`)
        if (prev.failed && t !== undefined && t > prev.w && r.progression === 'linear')
          r.anomalies.push(`${s.date} ${e.name}: weight went up to ${t} right after a failed set at ${prev.w}`)
        if (top === prev.w) flat.set(e.id, (flat.get(e.id) ?? 0) + 1)
        else flat.set(e.id, 0)
        if ((flat.get(e.id) ?? 0) === 9) r.anomalies.push(`${s.date} ${e.name}: same weight ${top} for 9 sessions`)
      }
      if (e.sets.length > 6) r.anomalies.push(`${s.date} ${e.name}: ${e.sets.length} sets, over the cap`)
      lastTop.set(e.id, {
        w: top,
        day: s.day,
        failed: e.sets.some((x) => x.failed),
        allTop: e.sets.every((x) => !x.failed),
      })
    }
  }
}

// ---------------------------------------------------------------- report

function summary(r: RunResult): string {
  const lines: string[] = []
  const sessions = r.sessions.length
  const failedSets = r.sessions.flatMap((s) => s.entries.flatMap((e) => e.sets)).filter((x) => x.failed).length
  const allSets = r.sessions.flatMap((s) => s.entries.flatMap((e) => e.sets)).length
  const offers = r.sessions.flatMap((s) => s.entries).filter((e) => e.rampOffer).length
  const ramps = r.sessions.flatMap((s) => s.entries).filter((e) => e.ramped).length
  const efforts = [1, 2, 3, 4].map((k) => r.sessions.filter((s) => s.effort === k).length)
  lines.push(`## ${r.split} × ${r.progression}`)
  lines.push(
    `sessions ${sessions}, sets ${allSets}, failed sets ${failedSets} (${Math.round((100 * failedSets) / allSets)}%), effort easy/ok/hard/too much ${efforts.join('/')}`,
  )
  lines.push(
    `ramp offers ${offers}, taken ${ramps}; deload hints ${r.deloads.length} (days ${r.deloads.join(', ') || 'none'}); stall alerts ${r.alerts.filter((a) => a.kind === 'stall').length}, week alerts ${r.alerts.filter((a) => a.kind === 'week').length}, scale alerts ${r.alerts.filter((a) => a.kind === 'weight').length}`,
  )
  const marks = [30, 90, 180, 360, 540, 720]
  const names = Object.keys(r.months[r.months.length - 1]?.lifts ?? {})
  lines.push(`| Lift | ${marks.map((m) => `m${Math.round(m / 30)}`).join(' | ')} |`)
  lines.push(`|---|${marks.map(() => '---').join('|')}|`)
  for (const name of names) {
    const cells = marks.map((m) => {
      const snap = r.months.find((x) => x.day === m)?.lifts[name]
      return snap ? `${snap.w}×${snap.reps} (${snap.sets}s)` : '–'
    })
    lines.push(`| ${name} | ${cells.join(' | ')} |`)
  }
  const trendCounts: Record<string, number> = {}
  for (const t of r.trends) trendCounts[t.trend] = (trendCounts[t.trend] ?? 0) + 1
  lines.push(
    `trend readings: ${Object.entries(trendCounts)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  )
  lines.push(
    `anomalies ${r.anomalies.length}${r.anomalies.length ? `:\n- ${r.anomalies.slice(0, 12).join('\n- ')}` : ''}`,
  )
  return lines.join('\n')
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2)
const client = await MongoClient.connect('mongodb://localhost:27017')
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
if (args[0] === 'matrix') {
  const splits = (args[1] ?? 'full3,ppl3,ul4,ppl6').split(',')
  const methods = (args[2] ?? 'linear,double,topset').split(',') as Progression[]
  const days = Number(args[3] ?? 730)
  const out: RunResult[] = []
  for (const s of splits)
    for (const m of methods) {
      const t0 = performance.now()
      const r = await run(s, m, days, client)
      out.push(r)
      console.log(summary(r))
      console.log(`(${Math.round((performance.now() - t0) / 1000)} s)\n`)
      fs.writeFileSync(path.join(dir, 'sim-results.json'), JSON.stringify(out))
    }
} else if (args[0] === 'seed') {
  // Two years for one new account in a real local database, so Stats can be looked at by eye.
  //   bun run db:simulate -- seed [split] [method] [days] [--db workout_plan_v3] [--email sim@example.com] [--password password123]
  const opt = (name: string, fallback: string) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback
  }
  const positional = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--')))
  const dbName = opt('db', 'workout_plan_v3')
  const email = opt('email', 'sim@example.com').toLowerCase()
  const password = opt('password', 'password123')
  const username =
    email
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_.]/g, '')
      .slice(0, 30) || 'sim'
  const live = client.db(dbName)
  if (await live.collection('user').findOne({ email })) {
    throw new Error(
      `"${email}" already exists in "${dbName}". Pick another --email, or delete that account in the app first.`,
    )
  }
  const _id = new ObjectId()
  const stamp = { createdAt: new RealDate(), updatedAt: new RealDate() }
  await live
    .collection('user')
    .insertOne({ _id, name: username, email, emailVerified: true, username, displayUsername: username, ...stamp })
  await live.collection('account').insertOne({
    _id: new ObjectId(),
    accountId: _id.toHexString(),
    providerId: 'credential',
    userId: _id,
    password: await hashPassword(password),
    ...stamp,
  })
  const r = await run(
    positional[0] ?? 'full3',
    (positional[1] ?? 'double') as Progression,
    Number(positional[2] ?? 730),
    client,
    { db: dbName, userId: _id.toHexString() },
  )
  console.log(summary(r))
  console.log(
    `\nSigned up in "${dbName}": ${email} / ${password} (username ${username}). Sign in on the dev server to see it.`,
  )
} else {
  const r = await run(args[0] ?? 'full3', (args[1] ?? 'linear') as Progression, Number(args[2] ?? 730), client)
  console.log(summary(r))
  fs.writeFileSync(path.join(dir, `sim-run-${r.split}-${r.progression}.json`), JSON.stringify(r))
}
await client.close()
process.exit(0)
