import type { BodyweightLog, Goal, Units, Workout } from '../types'
import { PERIOD_KINDS, type ReportData, reviewCard } from './report'
import { addDays, bestSet, dayKey, finished, setScore, startOfWeek } from './stats'

/**
 * Something on Today that asks for a look: a lift that stopped moving, a week slipping, a scale not moving, or the
 * report on a week or month just finished.
 */
export interface Alert {
  kind: 'stall' | 'weight' | 'review'
  /** Stable id for this exact alert (the lift, the period), so dismissing one hides only that one. */
  key: string
  title: string
  detail: string
  /** Where the alert's action leads. */
  to: string
}

/** The report on a week or month just finished, for its first two days. The week's first, when both fall on one day. */
export function reviewAlerts(now: Date, data: ReportData): Alert[] {
  return PERIOD_KINDS.flatMap((kind) => {
    const card = reviewCard(kind, now, data)
    return card
      ? [
          {
            kind: 'review' as const,
            key: `review:${kind}:${card.at}`,
            title: card.title,
            detail: card.detail,
            to: `/report?period=${kind}&at=${card.at}`,
          },
        ]
      : []
  })
}

/** The alerts the user has not dismissed: an alert stays hidden while its key is in the dismissed record. */
export function shownAlerts(alerts: Alert[], dismissed: Record<string, string> | undefined): Alert[] {
  return dismissed ? alerts.filter((a) => !dismissed[a.key]) : alerts
}

/** Weeks without a new best before a lift counts as stuck. */
export const STALL_WEEKS = 4
/** Sessions of the lift needed inside that window; fewer means it was simply not trained enough. */
const STALL_MIN_SESSIONS = 3

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

/** Lifts trained at least three times in the four weeks before `now` whose best set never beat the best from before those weeks. */
function stalledLifts(workouts: Workout[], now: Date): { id: string; name: string }[] {
  const since = addDays(now, -STALL_WEEKS * 7)
  const end = addDays(now, 1)
  const recentBest = new Map<string, { name: string; sessions: number; score: number }>()
  const olderBest = new Map<string, number>()
  for (const w of finished(workouts)) {
    const recent = inRange(w.finishedAt, since, end)
    for (const e of w.entries) {
      const b = bestSet(e)
      if (!b) continue
      const score = setScore(e, b, w.bodyweight)
      if (recent) {
        const cur = recentBest.get(e.exerciseId) ?? { name: e.name, sessions: 0, score: 0 }
        recentBest.set(e.exerciseId, { name: e.name, sessions: cur.sessions + 1, score: Math.max(cur.score, score) })
      } else {
        olderBest.set(e.exerciseId, Math.max(olderBest.get(e.exerciseId) ?? 0, score))
      }
    }
  }
  const stuck: { id: string; name: string }[] = []
  for (const [id, r] of recentBest) {
    const before = olderBest.get(id)
    if (before === undefined || r.sessions < STALL_MIN_SESSIONS || r.score > before) continue
    stuck.push({ id, name: r.name })
  }
  return stuck
}

/**
 * Lifts that stalled this week: stuck now and not a week ago. Said once, when it starts; a lift
 * that stays stuck is on the Lifts tab under Stuck, not on Today every Monday for a year (a
 * two-year simulation showed the same two lines 150 times). At most two.
 */
export function stallAlerts(workouts: Workout[], now: Date): Alert[] {
  // Two weeks back, not one: a stall flickers as sessions cross the window's edge.
  const before = new Set([-7, -14].flatMap((d) => stalledLifts(workouts, addDays(now, d)).map((s) => s.id)))
  return stalledLifts(workouts, now)
    .filter((s) => !before.has(s.id))
    .slice(0, 2)
    .map((s) => ({
      kind: 'stall' as const,
      key: `stall:${s.id}`,
      title: `${s.name} has not moved in ${STALL_WEEKS} weeks.`,
      detail: 'Swap it for an alternate on Plan, or take a lighter week on it.',
      to: '/plan',
    }))
}

function avg(xs: number[]): number | undefined {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined
}

/**
 * Three weeks of weigh-ins against the goal. Gaining or cutting without the scale moving by at least
 * 0.1 kg a week says the food is wrong, not the training.
 */
export function bodyweightAlert(logs: BodyweightLog[], goal: Goal | undefined, units: Units, now: Date): Alert | null {
  // Said the week it starts, not every week the scale stays flat.
  const alert = flatScale(logs, goal, units, now)
  const said = [-7, -14].some((d) => flatScale(logs, goal, units, addDays(now, d)) !== null)
  return alert && !said ? alert : null
}

function flatScale(logs: BodyweightLog[], goal: Goal | undefined, units: Units, now: Date): Alert | null {
  if (!goal || goal === 'hold') return null
  const end = addDays(now, 1)
  const weeks = [0, 1, 2].map((i) =>
    avg(
      logs
        .filter((l) => inRange(l.date, addDays(now, -7 * (i + 1)), i === 0 ? end : addDays(now, -7 * i)))
        .map((l) => l.weight),
    ),
  )
  const [latest, middle, oldest] = weeks
  if (latest === undefined || middle === undefined || oldest === undefined) return null
  const perWeek = (latest - oldest) / 2
  const flat = units === 'kg' ? 0.1 : 0.2
  const key = `weight:${dayKey(startOfWeek(now))}`
  if (goal === 'gain' && perWeek < flat) {
    return {
      kind: 'weight',
      key,
      title: 'Weight flat for 3 weeks.',
      detail: `Eat more: aim for +${units === 'kg' ? '0.25 kg' : '0.5 lb'} a week.`,
      to: '/stats?tab=body',
    }
  }
  if (goal === 'cut' && perWeek > -flat) {
    return {
      kind: 'weight',
      key,
      title: 'Weight flat for 3 weeks.',
      detail: `Eat less: aim for −${units === 'kg' ? '0.25 kg' : '0.5 lb'} a week.`,
      to: '/stats?tab=body',
    }
  }
  return null
}
