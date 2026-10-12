import type { Workout } from '../types'
import { addDays, bestSet, finished, setScore, startOfWeek } from './stats'

/** How a session felt, picked once at Finish. */
export type Effort = 1 | 2 | 3 | 4

export const EFFORTS: Effort[] = [1, 2, 3, 4]

export const EFFORT_LABEL: Record<Effort, string> = {
  1: 'Easy',
  2: 'OK',
  3: 'Hard',
  4: 'Too much',
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

/** Average rating of finished sessions in [start, end). Undefined when none was rated. */
export function averageEffort(ws: Workout[], start: Date, end: Date): number | undefined {
  const rated = finished(ws).filter((w) => inRange(w.finishedAt, start, end) && typeof w.effort === 'number')
  if (rated.length === 0) return undefined
  return rated.reduce((sum, w) => sum + (w.effort as number), 0) / rated.length
}

export function effortThisWeek(ws: Workout[], now: Date): number | undefined {
  const start = startOfWeek(now)
  return averageEffort(ws, start, addDays(start, 7))
}

export function effortLabel(avg: number): string {
  const e = Math.min(4, Math.max(1, Math.round(avg))) as Effort
  return EFFORT_LABEL[e]
}

function bestScores(ws: Workout[], start: Date, end: Date): Map<string, number> {
  const out = new Map<string, number>()
  for (const w of finished(ws)) {
    if (!inRange(w.finishedAt, start, end)) continue
    for (const e of w.entries) {
      const b = bestSet(e)
      if (!b) continue
      const s = setScore(e, b, w.bodyweight)
      if (s > (out.get(e.exerciseId) ?? 0)) out.set(e.exerciseId, s)
    }
  }
  return out
}

/**
 * Did any lift beat its best from the window before? Compares the last `days` days with the `days`
 * before that. Undefined when one of the windows has no data.
 */
export function strengthMoved(ws: Workout[], now: Date, days = 14): boolean | undefined {
  const recent = bestScores(ws, addDays(now, -days), addDays(now, 1))
  const before = bestScores(ws, addDays(now, -2 * days), addDays(now, -days))
  if (recent.size === 0 || before.size === 0) return undefined
  for (const [id, score] of recent) {
    const prev = before.get(id)
    if (prev !== undefined && score > prev + 1e-9) return true
  }
  return false
}

/**
 * The share of lifts trained in the last `days` days that did not beat their best from the `days`
 * before. Undefined when there is nothing to compare.
 */
export function stuckShare(ws: Workout[], now: Date, days = 14): number | undefined {
  const recent = bestScores(ws, addDays(now, -days), addDays(now, 1))
  const before = bestScores(ws, addDays(now, -2 * days), addDays(now, -days))
  let compared = 0
  let stuck = 0
  for (const [id, score] of recent) {
    const prev = before.get(id)
    if (prev === undefined) continue
    compared++
    if (score <= prev + 1e-9) stuck++
  }
  return compared === 0 ? undefined : stuck / compared
}

/** Lifts stuck out of those compared before a deload is called for: three in four. */
export const DELOAD_STUCK_SHARE = 0.75

/**
 * Two hard weeks in a row and most lifts stuck: take a deload week. "No lift moved at all" was the
 * rule before; with a dozen lifts something always creeps, and a two-year simulation saw the hint
 * once in twenty-four lifter-years.
 */
export function deloadHint(ws: Workout[], now: Date): boolean {
  const thisWeek = startOfWeek(now)
  const lastWeek = averageEffort(ws, addDays(thisWeek, -7), thisWeek)
  const weekBefore = averageEffort(ws, addDays(thisWeek, -14), addDays(thisWeek, -7))
  if (lastWeek === undefined || weekBefore === undefined) return false
  if (lastWeek < 3 || weekBefore < 3) return false
  const share = stuckShare(ws, now)
  return share !== undefined && share >= DELOAD_STUCK_SHARE
}
