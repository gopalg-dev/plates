/**
 * Two years of a beginner using Plates, driven through the real server code (repo.*) against a
 * throwaway local database, with a fake clock. A lifter model answers every session: how many reps
 * it can do at the weight the app asks for, how the session felt, reps left on the last set.
 *
 *   bun run db:simulate -- [split] [progression] [days]            one run, prints the summary
 *   bun run db:simulate -- matrix [splits] [methods] [days]        every split × method, writes results.json
 *   bun run db:simulate -- seed [split] [method] [days] [--email …]  two years for a new account in the dev database
 *
 * Any of them takes the gym's smallest steps in kg, as Settings holds them: --plate 5 --dumbbell 2 --stack 5,
 * or --same 5 for one value everywhere. Unset is the app's defaults. Two more stories, on top of any run:
 *   --empty   the split is started with empty days and the lifter fills each day from the library by hand, so
 *             every lift carries the library's own sets and range rather than the template's
 *   --swaps   now and then a machine is taken: the lift is swapped mid-session, for today or for good, sometimes
 *             after a set is already done; and some sessions are paused for five minutes
 *
 * Needs the local MongoDB (bun run db:up). Uses its own database, workout_plan_v3_sim, and drops it first.
 * Results land beside this file: scripts/sim-results.json or scripts/sim-run-<split>-<method>.json.
 */
import './sim-env'
import fs from 'node:fs'
import path from 'node:path'
import { hashPassword } from 'better-auth/crypto'
import { MongoClient, ObjectId } from 'mongodb'
import { DAY_BLOCKS } from '../src/lib/day-blocks'
import { findLibraryByName, LIBRARY, nameKey } from '../src/lib/library'
import { deloadHint } from '../src/lib/logic/effort'
import { incrementFor, stepsOf } from '../src/lib/logic/progression'
import { activeMinutes } from '../src/lib/logic/session-time'
import { attachBodyweight, epley, weeklyStrength } from '../src/lib/logic/stats'
import { liftTrend } from '../src/lib/logic/trend'
import type { LoggedSet, Progression, Settings, WorkoutEntry } from '../src/lib/types'
import * as repo from '../src/server/repo'
import { grown, repsAllowed, startCapacity } from './lifter'

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
  /** The top of the lift's range: the app only steps the weight up once a set reaches it. */
  repMax: number
  /** What the app steps this lift by; weight lifts only. */
  step?: number
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
  /** The machine-taken story: every swap made, and every paused session. */
  swaps: { day: number; from: string; to: string; forGood: boolean; afterASet: boolean }[]
  pauses: number
  /**
   * Honest training observations that are not data bugs: a light lift plateauing because its smallest step is a big
   * relative jump, a bodyweight lift stuck under its range. The data is right; the lifter is just stuck.
   */
  notes: string[]
}

let UID = 'sim-user'
/** The gym's smallest steps, from the command line; empty is the app's defaults. */
let gym: Pick<Settings, 'plate' | 'dumbbellStep' | 'stackStep' | 'sameStep'> = {}
/** The two stories: a split started empty and filled by hand; machines taken and sessions paused. */
let story = { empty: false, swaps: false }

/** A lift to swap to: the plan line's first alternate, else a library lift of the same muscle and kind. */
function swapTarget(entry: WorkoutEntry, alternates: string[] | undefined): string | undefined {
  const other = (name: string) => nameKey(name) !== nameKey(entry.name)
  const alt = alternates?.find(other)
  if (alt) return alt
  const pool = LIBRARY.filter((ex) => ex.muscle === entry.muscle && ex.loadType === entry.loadType && other(ex.name))
  return pool.length ? pool[Math.floor(rnd() * pool.length)].name : undefined
}

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
    swaps: [],
    pauses: 0,
    notes: [],
  }
  await repo.saveSettings(UID, {
    units: 'kg',
    trainingAge: 'under1',
    setupDone: true,
    bodyweight: 60,
    goal: 'gain',
    progression,
    ...gym,
  })
  await repo.applySplit(UID, split, { empty: story.empty })
  if (story.empty) {
    // The lifter fills each day by hand, picking from the library as the editor does: the library's own numbers.
    for (const d of await (await repo.getPlan(UID)).days) {
      await (async () => {
        if (
          await repo.startWorkout(UID, d.id).then(
            () => true,
            () => false,
          )
        )
          result.anomalies.push(`${d.name}: an empty day started a session`)
      })()
      for (const block of DAY_BLOCKS[d.type]()) {
        const lib = findLibraryByName(LIBRARY, block.name)
        if (!lib) throw new Error(`${block.name} is not in the library`)
        await repo.addExercise(UID, d.id, {
          name: lib.name,
          sets: lib.sets,
          repMin: lib.repMin,
          repMax: lib.repMax,
          muscle: lib.muscle,
          loadType: lib.loadType,
        })
      }
    }
  }
  let plan = await repo.getPlan(UID)
  /** After a swap for good, the lifts the next session of that day must show. */
  const expectOnDay = new Map<string, string>()
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
      const expected = expectOnDay.get(w.dayId)
      if (expected && !w.entries.some((e) => e.name === expected)) {
        result.anomalies.push(
          `${session.date} ${w.dayName}: ${expected} was swapped in for good, but the session lacks it`,
        )
      }
      expectOnDay.delete(w.dayId)
      const paused = story.swaps && result.sessions.length % 10 === 9
      if (paused) {
        await repo.pauseWorkout(UID, w.id, true)
        clock += 5 * 60_000
        result.pauses++
      }
      const rirs: number[] = []
      let failed = 0
      let entries = w.entries
      for (let k = 0; k < entries.length; k++) {
        let entry = entries[k]
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
        // The machine is taken, now and then: swap for today or for good, sometimes with a set already done.
        if (story.swaps && entry.loadType === 'weight' && !deloadWeek && rnd() < 0.06) {
          const to = swapTarget(entry, planEx?.alternates)
          if (to) {
            const afterASet = rnd() < 0.5
            const forGood = planEx !== undefined && rnd() < 0.4
            if (afterASet) {
              const wgt = entry.suggested?.[0]?.weight ?? chosen.get(entry.exerciseId) ?? 20
              const reps = Math.max(1, Math.min(repsAllowed(cap, wgt, 0), entry.repMax))
              await repo.saveEntrySets(UID, w.id, entry.exerciseId, [
                { weight: wgt, reps, done: true },
                ...entry.sets.slice(1).map(() => ({ done: false })),
              ])
              session.entries.push({
                ...logOf(entry, planEx?.sets),
                sets: [{ w: wgt, reps, failed: reps < entry.repMin }],
              })
            }
            const before = entries.length
            const updated = await repo.swapSessionExercise(UID, w.id, entry.exerciseId, to, forGood)
            entries = updated.entries
            result.swaps.push({ day, from: entry.name, to, forGood, afterASet })
            if (forGood) expectOnDay.set(w.dayId, to)
            if (afterASet ? entries.length !== before + 1 : entries.length !== before) {
              result.anomalies.push(
                `${session.date} ${entry.name} → ${to}: the session has ${entries.length} lifts, expected ${afterASet ? before + 1 : before}`,
              )
            }
            const ids = entries.map((e) => e.exerciseId)
            if (new Set(ids).size !== ids.length)
              result.anomalies.push(`${session.date}: duplicate lift ids after a swap: ${ids.join(', ')}`)
            // The new lift sits where the old one was (after it, when a set of the old one stays); it is logged next.
            if (afterASet) continue
            entry = entries[k]
          }
        }
        const log: EntryLog = {
          id: entry.exerciseId,
          name: entry.name,
          loadType: entry.loadType,
          sets: [],
          hint: entry.hint,
          rampOffer: !!entry.rampOffer,
          ramped,
          planSets: planEx?.sets ?? entry.sets.length,
          repMax: entry.repMax,
        }
        const sets: LoggedSet[] = []
        const n = deloadWeek ? Math.ceil(entry.sets.length / 2) : entry.sets.length
        for (let i = 0; i < n; i++) {
          const fatigue = 1 - 0.03 * i
          const target = entry.suggested?.[i]
          if (entry.loadType === 'weight') {
            const step = incrementFor('kg', entry.equipment, stepsOf({ units: 'kg', ...gym }), entry.plateLoaded)
            log.step = step
            let wgt = target?.weight ?? chosen.get(entry.exerciseId)
            if (wgt === undefined) {
              // First time: a weight for the middle of the range, rounded down to a plate step.
              const mid = (entry.repMin + entry.repMax) / 2
              wgt = Math.max(step, Math.floor(cap / (1 + mid / 30) / step) * step)
            }
            const achievable = repsAllowed(cap, wgt, i)
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
      if (paused) {
        const [done] = await repo.listWorkouts(UID, { limit: 1 })
        const minutes = activeMinutes(done, today())
        if (done.pausedAt || Math.round((done.pausedMs ?? 0) / 60_000) !== 5 || minutes !== 0) {
          result.anomalies.push(`${session.date}: finished while paused, pausedMs ${done.pausedMs}, minutes ${minutes}`)
        }
      }
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

/** A lift's log line before its sets are known. */
function logOf(entry: WorkoutEntry, planSets: number | undefined): EntryLog {
  return {
    id: entry.exerciseId,
    name: entry.name,
    loadType: entry.loadType,
    sets: [],
    hint: entry.hint,
    rampOffer: !!entry.rampOffer,
    ramped: false,
    planSets: planSets ?? entry.sets.length,
    repMax: entry.repMax,
  }
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
      // The app keeps a lift's history per plan day: the same name on two days (Push A 12-15, Push B 15-20) is two
      // lines with their own targets. The checker scopes by day too, or it reads one day's top against the other's.
      const key = `${s.dayId}|${e.id}`
      // The stall rule drops a weight a tenth after three flat sessions and says so: an intended drop, not a bug.
      const rebuilding = (e.hint ?? '').includes('build back up')
      if (e.loadType === 'bodyweight') {
        // A bodyweight lift under its range for a long run: the app never offers the easier alternate.
        if (e.sets.every((x) => x.failed)) short.set(key, (short.get(key) ?? 0) + 1)
        else short.set(key, 0)
        if ((short.get(key) ?? 0) === 12) r.notes.push(`${s.date} ${e.name}: under its rep range for 12 sessions`)
        continue
      }
      if (e.loadType !== 'weight') continue
      // Every set at the top of the range, session rated ok or easier, and the next target did not move: a real bug.
      const prevNo = noBump.get(key)
      if (prevNo !== undefined && e.sets[0]?.target !== undefined && e.sets[0].target <= prevNo && !rebuilding)
        r.anomalies.push(
          `${s.date} ${e.name}: every set topped out last time, felt fine, target still ${e.sets[0].target}`,
        )
      // Topped out means the top of the range on every set, which is what moves the weight; meeting the aim is not.
      const topped = e.sets.every((x) => x.reps >= e.repMax && !x.failed)
      if (topped && s.effort <= 2 && r.progression !== 'topset') noBump.set(key, Math.max(...e.sets.map((x) => x.w)))
      else noBump.delete(key)
      const top = Math.max(...e.sets.map((x) => x.w))
      const prev = lastTop.get(key)
      if (prev) {
        const t = e.sets[0]?.target
        // Data bugs: a target off the lift's weight step, or the weight rising right after a failure on linear.
        if (t !== undefined && e.step && Math.abs(t / e.step - Math.round(t / e.step)) > 1e-9)
          r.anomalies.push(`${s.date} ${e.name}: target ${t} is not on its ${e.step} kg step`)
        if (prev.failed && t !== undefined && t > prev.w && r.progression === 'linear')
          r.anomalies.push(`${s.date} ${e.name}: weight went up to ${t} right after a failed set at ${prev.w}`)
        // A drop with no deload and no stall-rebuild hint is a bug; the stall rebuild itself is an honest note.
        if (t !== undefined && t < prev.w * 0.85 && !s.deload) {
          if (rebuilding) r.notes.push(`${s.date} ${e.name}: stall rebuild, ${prev.w} → ${t}`)
          else r.anomalies.push(`${s.date} ${e.name}: target ${t} fell from ${prev.w} without a deload`)
        }
        if (top === prev.w) flat.set(key, (flat.get(key) ?? 0) + 1)
        else flat.set(key, 0)
        if ((flat.get(key) ?? 0) === 9)
          r.notes.push(`${s.date} ${e.name}: same weight ${top} for 9 sessions (step too big to clear)`)
      }
      if (e.sets.length > 6) r.anomalies.push(`${s.date} ${e.name}: ${e.sets.length} sets, over the cap`)
      lastTop.set(key, {
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
  if (r.swaps.length || r.pauses) {
    const forGood = r.swaps.filter((s) => s.forGood).length
    const afterASet = r.swaps.filter((s) => s.afterASet).length
    lines.push(
      `swaps ${r.swaps.length} (${forGood} for good, ${afterASet} after a set); paused sessions ${r.pauses}; e.g. ${r.swaps
        .slice(0, 3)
        .map((s) => `${s.from} → ${s.to}${s.forGood ? ' (plan)' : ''}`)
        .join(', ')}`,
    )
  }
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
    `training notes ${r.notes.length} (stuck light lifts, stall rebuilds; honest data, not bugs)${r.notes.length ? `:\n- ${r.notes.slice(0, 6).join('\n- ')}${r.notes.length > 6 ? `\n- …${r.notes.length - 6} more` : ''}` : ''}`,
  )
  lines.push(`DATA BUGS ${r.anomalies.length}${r.anomalies.length ? `:\n- ${r.anomalies.join('\n- ')}` : ' — clean'}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2)
// The gym's steps, the same for every mode; the positional words are what is left.
const stepFlag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : undefined
}
const same = stepFlag('same')
const picked =
  same !== undefined
    ? { plate: same, sameStep: true }
    : { plate: stepFlag('plate'), dumbbellStep: stepFlag('dumbbell'), stackStep: stepFlag('stack') }
gym = Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== undefined))
story = { empty: args.includes('--empty'), swaps: args.includes('--swaps') }
const STORY_FLAGS = ['--empty', '--swaps']
const pos = args.filter(
  (a, i) => !a.startsWith('--') && (!args[i - 1]?.startsWith('--') || STORY_FLAGS.includes(args[i - 1])),
)
if (story.empty || story.swaps)
  console.log(`stories: ${[story.empty && 'empty days', story.swaps && 'swaps'].filter(Boolean).join(', ')}\n`)
const inForce = stepsOf({ units: 'kg', ...gym })
console.log(`steps: bar plates ${inForce.plates}, dumbbells ${inForce.dumbbell}, stack ${inForce.stack} kg\n`)
const client = await MongoClient.connect('mongodb://localhost:27017')
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
if (pos[0] === 'matrix') {
  const splits = (pos[1] ?? 'full3,ppl3,ul4,ppl6').split(',')
  const methods = (pos[2] ?? 'linear,double,topset').split(',') as Progression[]
  const days = Number(pos[3] ?? 730)
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
} else if (pos[0] === 'seed') {
  // Two years for one new account in a real local database, so Stats can be looked at by eye.
  //   bun run db:simulate -- seed [split] [method] [days] [--db workout_plan_v3] [--email sim@example.com] [--password password123]
  const opt = (name: string, fallback: string) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback
  }
  const positional = pos.slice(1)
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
  const r = await run(pos[0] ?? 'full3', (pos[1] ?? 'linear') as Progression, Number(pos[2] ?? 730), client)
  console.log(summary(r))
  fs.writeFileSync(path.join(dir, `sim-run-${r.split}-${r.progression}.json`), JSON.stringify(r))
}
await client.close()
process.exit(0)
