import type { BodyweightLog, Plan, Settings, Units, Workout } from '../types'
import { attachBodyweight, bestSet, effectiveSets, finished, sessionsInWeek, setScore } from './stats'
import { fmtSet, fmtWeight } from './units'

/** One line per exercise in the finish summary: the best set, and whether it moved. */
export interface SummaryLine {
  exerciseId: string
  name: string
  /** The best set, written out: "62.5 kg × 8", "12 reps", "45 s". */
  best: string
  /** Beat every earlier best for this exercise. */
  pr: boolean
  /** Top weight against the previous session of this exercise, as "+2.5 kg". Weight lifts only. */
  change?: string
}

export interface SessionSummary {
  lines: SummaryLine[]
  /** Sessions finished this week, this one included, against the plan's week. */
  week: { done: number; planned: number }
}

/** Sessions the plan asks for in a week: the days with a weekday, or the rolling days up to six. */
export function plannedPerWeek(plan: Plan, settings: Pick<Settings, 'schedule'>): number {
  if (settings.schedule === 'weekday') {
    const withDay = plan.days.filter((d) => d.weekday !== undefined).length
    return withDay || Math.min(plan.days.length, 6)
  }
  return Math.min(plan.days.length, 6)
}

/**
 * What finishing a session says, from what is known when it finishes: `done` (marked done, with its finish time),
 * the finished sessions before it and the weigh-ins (so bodyweight lifts score), the plan and its schedule for the
 * week's count. The server says it to the lifter; the demo on How it works says it on the page.
 */
export function finishSummary(
  done: Workout,
  past: Workout[],
  weighIns: BodyweightLog[],
  plan: Plan,
  settings: Pick<Settings, 'units' | 'schedule'>,
  now: Date,
): SessionSummary {
  const earlier = attachBodyweight(past, weighIns)
  const [scored] = attachBodyweight([done], weighIns)
  const week = { done: sessionsInWeek(earlier, now) + 1, planned: plannedPerWeek(plan, settings) }
  return summarize(scored, earlier, settings.units, week)
}

/**
 * What this session did: each exercise's best set, whether it is a new best, and how the top weight
 * moved against the previous session of that exercise. `earlier` holds the finished sessions before
 * this one.
 */
export function summarize(
  workout: Workout,
  earlier: Workout[],
  units: Units,
  week: { done: number; planned: number },
): SessionSummary {
  const past = finished(earlier)
    .filter((w) => w.id !== workout.id)
    .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
  const lines: SummaryLine[] = []
  for (const entry of workout.entries) {
    const best = bestSet(entry)
    if (!best) continue
    const score = setScore(entry, best, workout.bodyweight)
    let previousBest = 0
    let previousTop: number | undefined
    for (const w of past) {
      const e = w.entries.find((x) => x.exerciseId === entry.exerciseId)
      if (!e) continue
      const b = bestSet(e)
      if (b) previousBest = Math.max(previousBest, setScore(e, b, w.bodyweight))
      if (previousTop === undefined && entry.loadType === 'weight') {
        const tops = effectiveSets(e).map((s) => s.weight ?? 0)
        if (tops.length) previousTop = Math.max(...tops)
      }
    }
    const line: SummaryLine = {
      exerciseId: entry.exerciseId,
      name: entry.name,
      best: fmtSet(entry.loadType, best, units),
      pr: previousBest > 0 && score > previousBest,
    }
    if (entry.loadType === 'weight' && previousTop !== undefined) {
      const top = Math.max(...effectiveSets(entry).map((s) => s.weight ?? 0))
      const diff = Math.round((top - previousTop) * 100) / 100
      if (diff !== 0) line.change = `${diff > 0 ? '+' : '−'}${fmtWeight(Math.abs(diff), units)}`
    }
    lines.push(line)
  }
  return { lines, week }
}
