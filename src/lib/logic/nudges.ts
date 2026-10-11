import type { NudgeKind, NudgeSnooze } from '../types'

export interface Nudge {
  kind: NudgeKind
  title: string
  detail: string
}

/** How often each is asked for, in days: the scale weekly, the tape every four weeks. */
export const NUDGE_EVERY: Record<NudgeKind, number> = { weight: 7, measure: 28 }
/** The first wait after "Not now": a quarter of the cadence. It doubles each time, up to the cadence. */
const FIRST_WAIT: Record<NudgeKind, number> = { weight: 1, measure: 7 }

export type Snoozes = Partial<Record<NudgeKind, NudgeSnooze>>

export function daysBetween(iso: string, now: Date): number {
  const a = new Date(now)
  a.setHours(0, 0, 0, 0)
  const b = new Date(iso)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

/**
 * Days a reminder stays quiet after being waved away for the nth time in a row: 1, 2, 4, then 7
 * for the scale; 7, 14, then 28 for the tape. Nobody is asked daily for a thing they never do, and
 * nothing goes away for good: the cues are what keep the habit.
 */
export function snoozeDays(kind: NudgeKind, times: number): number {
  return Math.min(NUDGE_EVERY[kind], FIRST_WAIT[kind] * 2 ** Math.max(0, times - 1))
}

/** Whether a reminder is still quiet: waved away since the thing was last logged, and the wait not over. */
function quiet(kind: NudgeKind, snoozes: Snoozes | undefined, lastLogAt: string | null, now: Date): boolean {
  const s = snoozes?.[kind]
  if (!s) return false
  if (lastLogAt && s.at <= lastLogAt) return false
  return daysBetween(s.at, now) < snoozeDays(kind, s.times)
}

function weightNudge(lastAt: string | null, now: Date): Nudge | null {
  if (!lastAt) return { kind: 'weight', title: 'Weigh-in due.', detail: 'Once a week, same time of day.' }
  const since = daysBetween(lastAt, now)
  if (since >= NUDGE_EVERY.weight) {
    return { kind: 'weight', title: 'Weigh-in due.', detail: `Last logged ${since} days ago.` }
  }
  return null
}

function measureNudge(lastAt: string | null, now: Date): Nudge | null {
  if (!lastAt) {
    return { kind: 'measure', title: 'Tape day.', detail: 'Arm, chest and waist set the baseline. Then every 4 weeks.' }
  }
  const since = daysBetween(lastAt, now)
  if (since >= NUDGE_EVERY.measure) {
    return { kind: 'measure', title: 'Tape day.', detail: `Last measured ${since} days ago.` }
  }
  return null
}

/**
 * One quiet reminder at a time. Weigh-in weekly, tape every four weeks; a first measurement right
 * away gives the baseline the later ones compare against. A reminder waved away stays quiet for a
 * while (see `snoozeDays`) and the next one, if due, shows instead.
 */
export function nudgeFor(
  lastBodyweightAt: string | null,
  lastMeasurementAt: string | null,
  now: Date,
  snoozes?: Snoozes,
): Nudge | null {
  const weight = weightNudge(lastBodyweightAt, now)
  if (weight && !quiet('weight', snoozes, lastBodyweightAt, now)) return weight
  const measure = measureNudge(lastMeasurementAt, now)
  if (measure && !quiet('measure', snoozes, lastMeasurementAt, now)) return measure
  return null
}
