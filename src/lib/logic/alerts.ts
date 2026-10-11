import type { BodyweightLog, Goal, Units, Workout } from '../types'
import { addDays, bestSet, finished, setScore } from './stats'

/** Something on Today that asks for a decision: a lift that stopped moving, a week slipping, a scale not moving. */
export interface Alert {
  kind: 'stall' | 'week' | 'weight'
  title: string
  detail: string
}

/** Weeks without a new best before a lift counts as stuck. */
export const STALL_WEEKS = 4
/** Sessions of the lift needed inside that window; fewer means it was simply not trained enough. */
const STALL_MIN_SESSIONS = 3

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

/**
 * Lifts trained at least three times in the last four weeks whose best set never beat the best from
 * before those weeks. At most two, the longest-trained first.
 */
export function stallAlerts(workouts: Workout[], now: Date): Alert[] {
  const since = addDays(now, -STALL_WEEKS * 7)
  const end = addDays(now, 1)
  const recentBest = new Map<string, { name: string; sessions: number; score: number }>()
  const olderBest = new Map<string, number>()
  for (const w of finished(workouts)) {
    const recent = inRange(w.finishedAt!, since, end)
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
  const stuck: Alert[] = []
  for (const [id, r] of recentBest) {
    const before = olderBest.get(id)
    if (before === undefined || r.sessions < STALL_MIN_SESSIONS || r.score > before) continue
    stuck.push({
      kind: 'stall',
      title: `${r.name} has not moved in ${STALL_WEEKS} weeks.`,
      detail: 'Swap it for an alternate on Plan, or take a lighter week on it.',
    })
  }
  return stuck.slice(0, 2)
}

/** When the sessions left this week are more than, or as many as, the days left in it. */
export function weekAlert(done: number, planned: number, now: Date): Alert | null {
  const left = planned - done
  if (left <= 0) return null
  const daysLeft = 7 - ((now.getDay() + 6) % 7) // today included, Monday to Sunday
  if (left < daysLeft) return null
  return {
    kind: 'week',
    title: `${left} ${left === 1 ? 'session' : 'sessions'} left this week.`,
    detail: daysLeft === 1 ? 'Today is the last day.' : `${daysLeft} days to go.`,
  }
}

function avg(xs: number[]): number | undefined {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined
}

/**
 * Three weeks of weigh-ins against the goal. Gaining or cutting without the scale moving by at least
 * 0.1 kg a week says the food is wrong, not the training.
 */
export function bodyweightAlert(logs: BodyweightLog[], goal: Goal | undefined, units: Units, now: Date): Alert | null {
  if (!goal || goal === 'hold') return null
  const end = addDays(now, 1)
  const weeks = [0, 1, 2].map((i) =>
    avg(
      logs
        .filter((l) => inRange(l.date, addDays(now, -7 * (i + 1)), i === 0 ? end : addDays(now, -7 * i)))
        .map((l) => l.weight),
    ),
  )
  if (weeks.some((w) => w === undefined)) return null
  const perWeek = (weeks[0]! - weeks[2]!) / 2
  const flat = units === 'kg' ? 0.1 : 0.2
  if (goal === 'gain' && perWeek < flat) {
    return {
      kind: 'weight',
      title: 'Weight flat for 3 weeks.',
      detail: `Eat more: aim for +${units === 'kg' ? '0.25 kg' : '0.5 lb'} a week.`,
    }
  }
  if (goal === 'cut' && perWeek > -flat) {
    return {
      kind: 'weight',
      title: 'Weight flat for 3 weeks.',
      detail: `Eat less: aim for −${units === 'kg' ? '0.25 kg' : '0.5 lb'} a week.`,
    }
  }
  return null
}
