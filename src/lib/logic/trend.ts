import type { WeeklyPoint } from './stats'

/**
 * What a lift is doing lately, from its best set each week. Read against the same four-week window
 * as the stall alert on Today, so the two never disagree about a lift.
 */
export const TRENDS = ['climbing', 'stuck', 'slipping', 'idle', 'new'] as const
export type Trend = (typeof TRENDS)[number]

export const TREND_LABEL: Record<Trend, string> = {
  climbing: 'Climbing',
  stuck: 'Stuck',
  slipping: 'Slipping',
  idle: 'Idle',
  new: 'New',
}

/** Weeks the trend looks back over. */
export const TREND_WEEKS = 4
/** Days without a session before a lift is idle. */
export const IDLE_DAYS = 14
/** Weeks of history before a lift can be read at all. */
const MIN_WEEKS = 3
/** A best set this far under the earlier best is slipping, not noise. */
const SLIP = 0.95

function daysAgo(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
}

/**
 * Idle: no session in two weeks. New: under three weeks of history. Then the best of the last four
 * weeks against the best before them: above is climbing, five percent under is slipping, anything
 * else is stuck. With no history before the window, the latest week stands against the weeks before it.
 */
export function liftTrend(weeks: WeeklyPoint[], now: Date): Trend {
  if (weeks.length === 0) return 'new'
  const last = weeks[weeks.length - 1]
  if (daysAgo(last.date, now) > IDLE_DAYS) return 'idle'
  if (weeks.length < MIN_WEEKS) return 'new'
  const since = now.getTime() - TREND_WEEKS * 7 * 86_400_000
  const older = weeks.filter((p) => new Date(p.date).getTime() < since)
  const recent = weeks.filter((p) => new Date(p.date).getTime() >= since)
  const best = (ps: WeeklyPoint[]) => Math.max(...ps.map((p) => p.score))
  const [now_, before] =
    older.length > 0 && recent.length > 0 ? [best(recent), best(older)] : [last.score, best(weeks.slice(0, -1))]
  if (now_ > before) return 'climbing'
  if (now_ < before * SLIP) return 'slipping'
  return 'stuck'
}
