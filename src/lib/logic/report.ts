import { monthYear, shortDate } from '../format'
import type { BodyweightLog, DayType, Muscle, Plan, Settings, Units, Workout, WorkoutEntry } from '../types'
import { deloadHint } from './effort'
import {
  addDays,
  averageWeight,
  bestSet,
  dayKey,
  effectiveSets,
  type FinishedWorkout,
  finished,
  MUSCLES,
  type PR,
  plannedVolumeByMuscle,
  prsBetween,
  setScore,
  startOfWeek,
  totalsBetween,
  volumeByMuscle,
  weeklyStrength,
} from './stats'
import { plannedPerWeek } from './summary'
import { liftTrend } from './trend'
import { fmtWeight } from './units'

/*
 * The report: how a finished week or month went, next to the one before. Only finished periods are reported on,
 * as weekly and monthly training reports are; the week running now is Today's and the calendar's. Pure, so it can
 * be tested; the page works it out in the browser from the year of data Stats loads, and Today's card on the server.
 */

export type PeriodKind = 'week' | 'month'
export const PERIOD_KINDS: PeriodKind[] = ['week', 'month']

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** A muscle is under its target when it got less than this share of the planned hard sets a week. */
const UNDER_TARGET = 0.9

/** Sessions a period needs before its numbers mean anything. */
export const MIN_SESSIONS: Record<PeriodKind, number> = { week: 1, month: 3 }

/** A finished week (Monday to Sunday) or calendar month, and the one before it. Ends are exclusive. */
export interface Period {
  kind: PeriodKind
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
}

function monthStart(d: Date, shift = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + shift, 1)
}

/** The start of the week or month that holds `d`. */
function periodStart(kind: PeriodKind, d: Date): Date {
  return kind === 'week' ? startOfWeek(d) : monthStart(d)
}

/** The start of the period `n` steps from the one holding `anchor`: -1 the one before, 1 the one after. */
export function shiftPeriod(kind: PeriodKind, anchor: Date, n: number): Date {
  return kind === 'week' ? addDays(startOfWeek(anchor), 7 * n) : monthStart(anchor, n)
}

/** The start of the last finished week or month: the one before the one holding `now`. */
export function lastFinished(kind: PeriodKind, now: Date): Date {
  return shiftPeriod(kind, now, -1)
}

/** The finished period that holds `anchor`. An anchor in the period still running, or later, gives the last finished one. */
export function finishedPeriod(kind: PeriodKind, anchor: Date, now: Date): Period {
  const latest = lastFinished(kind, now)
  const held = periodStart(kind, anchor)
  const start = held.getTime() > latest.getTime() ? latest : held
  return { kind, start, end: shiftPeriod(kind, start, 1), prevStart: shiftPeriod(kind, start, -1), prevEnd: start }
}

/** Whether a later finished period exists to step to. */
export function hasNext(period: Period, now: Date): boolean {
  return period.start.getTime() < lastFinished(period.kind, now).getTime()
}

/**
 * When the first report arrives, for someone with no session before the period now running: the day that period
 * ends. Null once there is a finished period with sessions to report on.
 */
export function firstReportOn(kind: PeriodKind, now: Date, workouts: Workout[]): Date | null {
  const running = periodStart(kind, now)
  const before = finished(workouts).some((w) => new Date(w.finishedAt).getTime() < running.getTime())
  return before ? null : shiftPeriod(kind, running, 1)
}

/** "October 2026", or "Oct 5 – 11" for a week ("Sep 28 – Oct 4" across a month). */
export function periodLabel(p: Period): string {
  if (p.kind === 'month') return monthYear(p.start)
  const last = addDays(p.end, -1)
  const end = last.getMonth() === p.start.getMonth() ? String(last.getDate()) : shortDate(last.toISOString())
  return `${shortDate(p.start.toISOString())} – ${end}`
}

/** What every comparison is against. */
export function beforeLabel(kind: PeriodKind): string {
  return kind === 'week' ? 'the week before' : 'the month before'
}

/** "same as the week before", or "▲ 8 vs the week before": the change said in words, the glyph only beside them. */
export function compared(now: number, prev: number, before: string): string {
  const d = Math.round((now - prev) * 10) / 10
  if (d === 0) return `same as ${before}`
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} vs ${before}`
}

/** The same for a weight: "▲ 0.2 kg vs the week before". */
export function comparedWeight(now: number, prev: number, units: Units, before: string): string {
  const d = Math.round((now - prev) * 10) / 10
  if (d === 0) return `same as ${before}`
  return `${d > 0 ? '▲' : '▼'} ${fmtWeight(Math.abs(d), units)} vs ${before}`
}

export type Tone = 'up' | 'down' | 'same'

/** Which way a number moved against the period before. */
export function toneOf(now: number, prev: number): Tone {
  const d = Math.round((now - prev) * 10) / 10
  return d === 0 ? 'same' : d > 0 ? 'up' : 'down'
}

/** Weeks a span is spread over, for "a week" numbers over a month. */
function weeksIn(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / WEEK_MS
}

/** The plan asks for sessions from the day the account began, not from the first of a month joined on the 22nd. */
function plannedFrom(settings: ReportData['settings'], start: Date): Date {
  if (!settings.joinedAt) return start
  const joined = new Date(settings.joinedAt)
  joined.setHours(0, 0, 0, 0)
  return joined.getTime() > start.getTime() ? joined : start
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function between(ws: Workout[], start: Date, end: Date): FinishedWorkout[] {
  const s = start.getTime()
  const e = end.getTime()
  return finished(ws).filter((w) => {
    const t = new Date(w.finishedAt).getTime()
    return t >= s && t < e
  })
}

export interface BestOf {
  exerciseId: string
  name: string
  loadType: WorkoutEntry['loadType']
  weight: number
  reps: number
  seconds: number
  score: number
}

/** Periods in a row with at least one session, counted back from `period` itself; the data holds a year. */
function periodsInARow(ws: Workout[], period: Period): number {
  let n = 0
  let start = period.start
  while (n < 60 && between(ws, start, shiftPeriod(period.kind, start, 1)).length > 0) {
    n++
    start = shiftPeriod(period.kind, start, -1)
  }
  return n
}

/** Each lift's best set over the sessions given, by the same score the bests use. */
function bests(ws: FinishedWorkout[]): Map<string, BestOf> {
  const out = new Map<string, BestOf>()
  for (const w of ws) {
    for (const e of w.entries) {
      const b = bestSet(e)
      if (!b) continue
      const score = setScore(e, b, w.bodyweight)
      if (score <= (out.get(e.exerciseId)?.score ?? 0)) continue
      out.set(e.exerciseId, {
        exerciseId: e.exerciseId,
        name: e.name,
        loadType: e.loadType,
        weight: b.weight ?? 0,
        reps: b.reps ?? 0,
        seconds: b.seconds ?? 0,
        score,
      })
    }
  }
  return out
}

/** A lift without a new best whose best set still beat the period before's. */
export interface Mover {
  from: BestOf
  to: BestOf
  /** Change in the set's score, in %. */
  changePct: number
}

/** The lifts trained in the span that were stuck or slipping as it ended, by name. */
function fadingAt(ws: Workout[], start: Date, end: Date): { stuck: string[]; slipping: string[] } {
  const upTo = ws.filter((w) => w.finishedAt && new Date(w.finishedAt).getTime() < end.getTime())
  const at = new Date(end.getTime() - 1)
  const seen = new Set<string>()
  const out = { stuck: [] as string[], slipping: [] as string[] }
  for (const w of between(ws, start, end)) {
    for (const e of w.entries) {
      if (seen.has(e.exerciseId)) continue
      seen.add(e.exerciseId)
      const trend = liftTrend(weeklyStrength(upTo, e.exerciseId), at)
      if (trend === 'stuck' || trend === 'slipping') out[trend].push(e.name)
    }
  }
  return out
}

export interface BodyweightChange {
  /** The 7-day averages going into the period and out of it. */
  from?: number
  to: number
}

/** How bodyweight moved over the span, from the week before it to its last week; null without a weigh-in at its end. */
function bodyweightChange(logs: BodyweightLog[], start: Date, end: Date): BodyweightChange | null {
  const to = averageWeight(logs, addDays(end, -7), end)
  if (to === undefined) return null
  return { from: averageWeight(logs, addDays(start, -7), start), to }
}

/** Counts of Easy, OK, Hard and Too much, in that order. */
function effortCounts(ws: FinishedWorkout[]): [number, number, number, number] {
  const out: [number, number, number, number] = [0, 0, 0, 0]
  for (const w of ws) if (w.effort && w.effort >= 1 && w.effort <= 4) out[w.effort - 1]++
  return out
}

/** The average reps left on each lift's last set, where it was given. */
function averageLeft(ws: FinishedWorkout[]): number | undefined {
  const lefts: number[] = []
  for (const w of ws) {
    for (const e of w.entries) {
      const last = effectiveSets(e).at(-1)
      if (last?.left !== undefined) lefts.push(last.left)
    }
  }
  return lefts.length ? round1(lefts.reduce((a, b) => a + b, 0) / lefts.length) : undefined
}

export interface MuscleLine {
  muscle: Muscle
  /** Hard sets in a week; over a month, the average a week. */
  perWeek: number
  prevPerWeek: number
  /** Planned hard sets a week. */
  target: number
}

export interface Report {
  enough: boolean
  sessions: { done: number; prev: number; planned: number }
  sets: { now: number; prev: number }
  bests: PR[]
  prevBestCount: number
  /** Periods in a row with a session, this one included: 3 on a third week running. */
  streak: number
  /** Most improved first; at most three. */
  movers: Mover[]
  bodyweight: BodyweightChange | null
  attention: {
    stuck: string[]
    slipping: string[]
    /** Muscles clearly under the hard sets a week the plan asks (see UNDER_TARGET). */
    under: MuscleLine[]
    tooMuch: number
    deload: boolean
  }
  muscles: MuscleLine[]
  effort: {
    counts: [number, number, number, number]
    prevCounts: [number, number, number, number]
    left?: number
    prevLeft?: number
  }
}

export interface ReportData {
  settings: Pick<Settings, 'trainingAge' | 'schedule' | 'joinedAt'>
  plan: Plan
  workouts: Workout[]
  bodyweights: BodyweightLog[]
}

export function buildReport(data: ReportData, period: Period): Report {
  const { settings, plan, workouts, bodyweights } = data
  const { kind, start, end, prevStart, prevEnd } = period
  const current = between(workouts, start, end)
  const before = between(workouts, prevStart, prevEnd)
  const weeks = kind === 'week' ? 1 : weeksIn(start, end)
  const prevWeeks = kind === 'week' ? 1 : weeksIn(prevStart, prevEnd)

  const target = plannedVolumeByMuscle(plan, settings.trainingAge)
  const vol = volumeByMuscle(workouts, start, end)
  const prevVol = volumeByMuscle(workouts, prevStart, prevEnd)
  const muscles: MuscleLine[] = MUSCLES.filter((m) => target[m] > 0 || vol[m] > 0).map((m) => ({
    muscle: m,
    perWeek: round1(vol[m] / weeks),
    prevPerWeek: round1(prevVol[m] / prevWeeks),
    target: target[m],
  }))

  const prs = prsBetween(workouts, start, end)
  // A lift with a new best is listed with it; movers are the others that beat the period before.
  const withBest = new Set(prs.map((p) => p.exerciseId))
  const best = bests(current)
  const prevBest = bests(before)
  const movers: Mover[] = []
  for (const [id, to] of best) {
    const from = prevBest.get(id)
    if (withBest.has(id) || !from || from.score <= 0 || to.score <= from.score) continue
    movers.push({ from, to, changePct: ((to.score - from.score) / from.score) * 100 })
  }
  movers.sort((a, b) => b.changePct - a.changePct)

  return {
    enough: current.length >= MIN_SESSIONS[kind],
    sessions: {
      done: current.length,
      prev: before.length,
      planned: Math.max(1, Math.round(plannedPerWeek(plan, settings) * weeksIn(plannedFrom(settings, start), end))),
    },
    sets: { now: totalsBetween(workouts, start, end).sets, prev: totalsBetween(workouts, prevStart, prevEnd).sets },
    bests: prs,
    prevBestCount: prsBetween(workouts, prevStart, prevEnd).length,
    streak: periodsInARow(workouts, period),
    movers: movers.slice(0, 3),
    bodyweight: bodyweightChange(bodyweights, start, end),
    attention: {
      ...fadingAt(workouts, start, end),
      under: muscles.filter((m) => m.target > 0 && m.perWeek < m.target * UNDER_TARGET),
      tooMuch: current.filter((w) => w.effort === 4).length,
      deload: deloadHint(
        workouts.filter((w) => w.finishedAt && new Date(w.finishedAt).getTime() < end.getTime()),
        new Date(end.getTime() - 1),
      ),
    },
    muscles,
    effort: {
      counts: effortCounts(current),
      prevCounts: effortCounts(before),
      left: averageLeft(current),
      prevLeft: averageLeft(before),
    },
  }
}

/** One period in the run up to the one reported on. */
export interface HistoryPoint {
  start: Date
  /** "Sep 14" for a week, "Sep" for a month. */
  label: string
  sessions: number
  sets: number
  /** The 7-day average at the period's end. */
  weight?: number
  /** The period reported on: the last point. */
  current: boolean
}

/** The last eight weeks or six months up to and including the period, oldest first. */
export function history(data: Pick<ReportData, 'workouts' | 'bodyweights'>, period: Period): HistoryPoint[] {
  const n = period.kind === 'week' ? 8 : 6
  const out: HistoryPoint[] = []
  for (let i = n - 1; i >= 0; i--) {
    const start = shiftPeriod(period.kind, period.start, -i)
    const end = shiftPeriod(period.kind, start, 1)
    out.push({
      start,
      label:
        period.kind === 'week' ? shortDate(start.toISOString()) : start.toLocaleDateString('en-US', { month: 'short' }),
      sessions: between(data.workouts, start, end).length,
      sets: totalsBetween(data.workouts, start, end).sets,
      weight: averageWeight(data.bodyweights, addDays(end, -7), end),
      current: i === 0,
    })
  }
  return out
}

/**
 * One day of the period: the sessions trained on it, in the order they were done. `dayType` and `dayName` are the
 * first's, what the cell is painted in; `dayTypes` holds every one, so two sessions make a split cell.
 */
export interface PeriodDay {
  date: Date
  key: string
  dayType: DayType | null
  dayTypes: DayType[]
  dayName?: string
}

/** Every day of the period in order, with what was trained on it. */
export function daysOf(period: Period, workouts: Workout[]): PeriodDay[] {
  const trained = new Map<string, { dayTypes: DayType[]; dayName: string }>()
  const inPeriod = [...between(workouts, period.start, period.end)].sort(
    (a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime(),
  )
  for (const w of inPeriod) {
    const key = dayKey(w.finishedAt)
    const on = trained.get(key)
    if (on) on.dayTypes.push(w.dayType)
    else trained.set(key, { dayTypes: [w.dayType], dayName: w.dayName })
  }
  const out: PeriodDay[] = []
  for (let d = period.start; d.getTime() < period.end.getTime(); d = addDays(d, 1)) {
    const key = dayKey(d)
    const on = trained.get(key)
    out.push({
      date: d,
      key,
      dayType: on?.dayTypes[0] ?? null,
      dayTypes: on?.dayTypes ?? [],
      ...(on ? { dayName: on.dayName } : {}),
    })
  }
  return out
}

/** Today's line about the report that has just come: the period, its headline, and the day that opens it. */
export interface ReviewCard {
  kind: PeriodKind
  /** "Week of Oct 5 – 11" or "October 2026". */
  title: string
  /** "6 of 6 sessions, 2 new bests". */
  detail: string
  /** A day inside the period, YYYY-MM-DD, for the report's link. */
  at: string
}

/**
 * The report to announce on Today: for the first two days after a week or a month ends, the one just finished,
 * when it had enough sessions. Null on other days.
 */
export function reviewCard(kind: PeriodKind, now: Date, data: ReportData): ReviewCard | null {
  const fresh = kind === 'week' ? now.getDay() === 1 || now.getDay() === 2 : now.getDate() <= 2
  if (!fresh) return null
  const period = finishedPeriod(kind, lastFinished(kind, now), now)
  const r = buildReport(data, period)
  if (!r.enough) return null
  const n = r.bests.length
  return {
    kind,
    title: kind === 'week' ? `Week of ${periodLabel(period)}` : periodLabel(period),
    detail: `${r.sessions.done} of ${r.sessions.planned} sessions, ${n} new ${n === 1 ? 'best' : 'bests'}`,
    at: dayKey(period.start),
  }
}
