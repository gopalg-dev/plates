import type { BodyweightLog, DayType, LoggedSet, Muscle, Plan, TrainingAge, Workout, WorkoutEntry } from '../types'
import { activeMinutes } from './session-time'

export const MUSCLES: Muscle[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'calves',
  'abs',
]

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  abs: 'Abs',
}

// ---- dates (local time) ----

export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Monday 00:00 of the week that contains the date. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const offset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - offset)
  return x
}

// ---- helpers ----

/** A workout that was finished: done, and stamped with the time it ended. */
export type FinishedWorkout = Workout & { finishedAt: string }

/** The finished workouts, oldest first. The type carries the finish time, so callers need no assertion. */
export function finished(ws: Workout[]): FinishedWorkout[] {
  return ws
    .filter((w): w is FinishedWorkout => w.status === 'done' && Boolean(w.finishedAt))
    .sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime())
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

export function effectiveSets(entry: WorkoutEntry): LoggedSet[] {
  return entry.sets.filter((s) => s.done && ((s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0))
}

/** Epley estimate of a one-rep max. */
export function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/**
 * One number to rank sets by. Weight lifts: the Epley estimate. Bodyweight work: the same estimate
 * at the session's bodyweight when one is known, so 8 pull-ups at 80 kg beat 8 at 70 kg; plain reps
 * when no weigh-in exists. Holds: seconds.
 */
export function setScore(entry: Pick<WorkoutEntry, 'loadType'>, s: LoggedSet, bodyweight?: number): number {
  if (entry.loadType === 'weight') return epley(s.weight ?? 0, s.reps ?? 0)
  if (entry.loadType === 'bodyweight') return bodyweight ? epley(bodyweight, s.reps ?? 0) : (s.reps ?? 0)
  return s.seconds ?? 0
}

/**
 * Gives each session the weigh-in in force at the time: the latest on or before it, else the first
 * after it. Sessions keep no bodyweight of their own, so a weigh-in logged late still counts.
 */
export function attachBodyweight(ws: Workout[], logs: BodyweightLog[]): Workout[] {
  if (logs.length === 0) return ws
  const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return ws.map((w) => {
    const at = new Date(w.finishedAt ?? w.startedAt).getTime()
    let before: BodyweightLog | undefined
    for (const l of sorted) {
      if (new Date(l.date).getTime() <= at) before = l
      else break
    }
    const bodyweight = (before ?? sorted[0]).weight
    return { ...w, bodyweight }
  })
}

export function bestSet(entry: WorkoutEntry): LoggedSet | undefined {
  let best: LoggedSet | undefined
  let bestScore = 0
  for (const s of effectiveSets(entry)) {
    const score = setScore(entry, s)
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return best
}

// ---- consistency ----

export function sessionsInWeek(ws: Workout[], now: Date): number {
  const start = startOfWeek(now)
  const end = addDays(start, 7)
  return finished(ws).filter((w) => inRange(w.finishedAt, start, end)).length
}

export interface CalendarDay {
  /** Local calendar day, YYYY-MM-DD. */
  date: string
  type: DayType | null
  /** Local midnight of the day as an ISO string, for display formatting. */
  iso: string
  dayOfMonth: number
  /** After today. Shown as an empty slot so the week still reads as a full row. */
  future: boolean
  /** Before the user joined. Nothing can have been logged, so the day is shown dimmed. */
  before: boolean
}

export interface CalendarWeek {
  /** Monday of the week, local, YYYY-MM-DD. Selecting a week in the UI selects this key. */
  start: string
  /** Seven cells, Monday first. Null before the 1st and after the last day of the month. */
  days: (CalendarDay | null)[]
}

/**
 * The weeks of one month, Monday to Sunday. Cells before the 1st and after the last day are null.
 * `joinedAt` marks days before the user joined, so the UI can keep them out of reach.
 */
export function monthCalendar(ws: Workout[], now: Date, month: Date, joinedAt?: string): CalendarWeek[] {
  const byDay = new Map<string, DayType>()
  for (const w of finished(ws)) byDay.set(dayKey(w.finishedAt), w.dayType)
  const todayKey = dayKey(now)
  const joinedKey = joinedAt ? dayKey(new Date(joinedAt)) : undefined
  const y = month.getFullYear()
  const m = month.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  const weekOf = (day: number) => dayKey(startOfWeek(new Date(y, m, day)))
  const weeks: CalendarWeek[] = []
  let days: (CalendarDay | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day)
    const key = dayKey(d)
    days.push({
      date: key,
      type: byDay.get(key) ?? null,
      iso: d.toISOString(),
      dayOfMonth: day,
      future: key > todayKey,
      before: joinedKey !== undefined && key < joinedKey,
    })
    if (days.length === 7) {
      weeks.push({ start: weekOf(day), days })
      days = []
    }
  }
  if (days.length > 0) {
    while (days.length < 7) days.push(null)
    weeks.push({ start: weekOf(daysInMonth), days })
  }
  return weeks
}

/** Weeks in a row with a session in each. A current week still in progress does not break the streak. */
export function weeklyStreak(ws: Workout[], now: Date, min = 1): number {
  return weeklyStreakOf(
    finished(ws).map((w) => w.finishedAt),
    now,
    min,
  )
}

/** The same streak from finish times alone, for screens that only carry dates. */
export function weeklyStreakOf(finishedAt: string[], now: Date, min = 1): number {
  const count = (start: Date) => finishedAt.filter((iso) => inRange(iso, start, addDays(start, 7))).length
  let weekStart = startOfWeek(now)
  if (count(weekStart) < min) weekStart = addDays(weekStart, -7)
  let streak = 0
  while (streak < 520 && count(weekStart) >= min) {
    streak++
    weekStart = addDays(weekStart, -7)
  }
  return streak
}

// ---- volume ----

export function emptyByMuscle(): Record<Muscle, number> {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
}

/** Hard sets per muscle over sessions finished from `start` up to, not including, `end`. */
export function volumeByMuscle(ws: Workout[], start: Date, end: Date): Record<Muscle, number> {
  const out = emptyByMuscle()
  for (const w of finished(ws)) {
    if (!inRange(w.finishedAt, start, end)) continue
    for (const e of w.entries) out[e.muscle] += effectiveSets(e).length
  }
  return out
}

export function volumeByMuscleInWeek(ws: Workout[], now: Date): Record<Muscle, number> {
  const start = startOfWeek(now)
  return volumeByMuscle(ws, start, addDays(start, 7))
}

export function plannedSetsFor(sets: number, trainingAge: TrainingAge): number {
  return trainingAge === 'under1' ? Math.min(sets, 3) : sets
}

export function plannedVolumeByMuscle(plan: Plan, trainingAge: TrainingAge): Record<Muscle, number> {
  const out = emptyByMuscle()
  for (const d of plan.days) for (const e of d.exercises) out[e.muscle] += plannedSetsFor(e.sets, trainingAge)
  return out
}

// ---- strength ----

export interface StrengthPoint {
  date: string
  weight: number
  reps: number
  seconds: number
  score: number
}

export function strengthSeries(ws: Workout[], exerciseId: string): StrengthPoint[] {
  const out: StrengthPoint[] = []
  for (const w of finished(ws)) {
    const entry = w.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    const best = bestSet(entry)
    if (!best) continue
    out.push({
      date: w.finishedAt,
      weight: best.weight ?? 0,
      reps: best.reps ?? 0,
      seconds: best.seconds ?? 0,
      score: setScore(entry, best, w.bodyweight),
    })
  }
  return out
}

export interface WeeklyPoint {
  /** Monday of the week, local, YYYY-MM-DD. */
  week: string
  /** 1 for the week this lift was first logged. A week with no session still counts, so a gap shows as a gap. */
  weekNo: number
  /** When the best set of the week was lifted. */
  date: string
  weight: number
  reps: number
  seconds: number
  score: number
  sessions: number
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** The best set of each calendar week for one lift, oldest first: "week one 60 kg, week two 62.5 kg". */
export function weeklyStrength(ws: Workout[], exerciseId: string): WeeklyPoint[] {
  const byWeek = new Map<string, WeeklyPoint>()
  for (const p of strengthSeries(ws, exerciseId)) {
    const week = dayKey(startOfWeek(new Date(p.date)))
    const cur = byWeek.get(week)
    if (!cur) {
      byWeek.set(week, { week, weekNo: 0, ...p, sessions: 1 })
    } else {
      cur.sessions++
      if (p.score > cur.score) Object.assign(cur, p)
    }
  }
  const out = [...byWeek.values()].sort((a, b) => (a.week < b.week ? -1 : 1))
  const first = out[0]
  if (!first) return out
  const start = fromKey(first.week).getTime()
  for (const p of out) p.weekNo = Math.round((fromKey(p.week).getTime() - start) / (7 * 86_400_000)) + 1
  return out
}

export interface WeekTotals {
  /** Done sets with reps or seconds. */
  sets: number
  /** Weight × reps over the weighted sets, plus bodyweight × reps over bodyweight sets when a weigh-in is known. */
  lifted: number
  /** Minutes between starting and finishing, summed over the week's sessions. */
  minutes: number
}

/** Totals for the week that holds `at`. */
export function weekTotals(ws: Workout[], at: Date): WeekTotals {
  const start = startOfWeek(at)
  return totalsBetween(ws, start, addDays(start, 7))
}

/** Totals over sessions finished from `start` up to, not including, `end`. */
export function totalsBetween(ws: Workout[], start: Date, end: Date): WeekTotals {
  const out: WeekTotals = { sets: 0, lifted: 0, minutes: 0 }
  for (const w of finished(ws)) {
    if (!inRange(w.finishedAt, start, end)) continue
    out.minutes += activeMinutes(w, end)
    for (const e of w.entries) {
      for (const s of effectiveSets(e)) {
        out.sets++
        if (e.loadType === 'weight') out.lifted += (s.weight ?? 0) * (s.reps ?? 0)
        else if (e.loadType === 'bodyweight') out.lifted += (w.bodyweight ?? 0) * (s.reps ?? 0)
      }
    }
  }
  return out
}

export interface PR {
  exerciseId: string
  name: string
  loadType: WorkoutEntry['loadType']
  date: string
  weight: number
  reps: number
  seconds: number
  score: number
}

/** Best sets in the last `days` days that beat every earlier best for that exercise. Newest first. */
export function recentPRs(ws: Workout[], now: Date, days = 14): PR[] {
  return prsBetween(ws, addDays(now, -days))
}

/**
 * Best sets from `start` (up to `end` when given) that beat every earlier best for that exercise, newest first.
 * Every session before `start` still counts towards the earlier best.
 */
export function prsBetween(ws: Workout[], start: Date, end?: Date): PR[] {
  const since = start.getTime()
  const best = new Map<string, number>()
  const prs: PR[] = []
  for (const w of finished(ws)) {
    if (end && new Date(w.finishedAt).getTime() >= end.getTime()) break
    for (const e of w.entries) {
      const b = bestSet(e)
      if (!b) continue
      const score = setScore(e, b, w.bodyweight)
      const prev = best.get(e.exerciseId) ?? 0
      if (score > prev) {
        best.set(e.exerciseId, score)
        if (prev > 0 && new Date(w.finishedAt).getTime() >= since) {
          prs.push({
            exerciseId: e.exerciseId,
            name: e.name,
            loadType: e.loadType,
            date: w.finishedAt,
            weight: b.weight ?? 0,
            reps: b.reps ?? 0,
            seconds: b.seconds ?? 0,
            score,
          })
        }
      }
    }
  }
  return prs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// ---- bodyweight ----

export interface BodyweightTrend {
  latest?: number
  latestDate?: string
  weekAvg?: number
  prevWeekAvg?: number
  changePct?: number
}

function avg(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** The average weigh-in from `start` up to, not including, `end`; undefined when there is none. */
export function averageWeight(logs: BodyweightLog[], start: Date, end: Date): number | undefined {
  return avg(logs.filter((l) => inRange(l.date, start, end)).map((l) => l.weight))
}

export function bodyweightTrend(logs: BodyweightLog[], now: Date): BodyweightTrend {
  const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const latest = sorted.at(-1)
  const weekAgo = addDays(now, -7)
  const weekAvg = averageWeight(sorted, weekAgo, addDays(now, 1))
  const prevWeekAvg = averageWeight(sorted, addDays(now, -14), weekAgo)
  const changePct =
    weekAvg !== undefined && prevWeekAvg !== undefined && prevWeekAvg > 0
      ? ((weekAvg - prevWeekAvg) / prevWeekAvg) * 100
      : undefined
  return {
    latest: latest?.weight,
    latestDate: latest?.date,
    weekAvg,
    prevWeekAvg,
    changePct,
  }
}

/** Noon on a local calendar day, so formatting never slips to the day before in western time zones. */
export function noon(key: string): string {
  return `${key}T12:00:00`
}

/** Local midnight of a YYYY-MM-DD key as a timestamp, the chart's time axis. */
export function keyTime(key: string): number {
  return new Date(noon(key)).setHours(0, 0, 0, 0)
}
