import type { Exercise, LoggedSet, SetTarget, TrainingAge, WorkoutEntry } from '../types'
import { plannedSetsFor } from './stats'

/*
 * A session in progress brought up to date with its plan day, after the plan was changed mid-session and the lifter
 * chose "Plan and today". The rule: what is logged is never touched. The day's order and lifts win; a lift the session
 * already has keeps its sets, takes the plan's new name, range and type, and grows or shrinks its unticked sets to
 * the plan's number; a lift new to the day comes in fresh, as at the start of a session; a lift the day no longer has
 * goes, unless a set of it is ticked, and then it stays at the end.
 */

/** Grows or shrinks a list to `n` by its last item, for the set targets that go with the sets. */
function toLength<T>(list: T[], n: number): T[] {
  if (list.length >= n || list.length === 0) return list.slice(0, n)
  return [...list, ...Array.from({ length: n - list.length }, () => list[list.length - 1])]
}

/** One lift the session already had, fitted to the plan's version of it. Ticked sets stay, all of them. */
function fitted(entry: WorkoutEntry, ex: Exercise, trainingAge: TrainingAge): WorkoutEntry {
  const lastTicked = entry.sets.reduce((last, s, i) => (s.done ? i : last), -1)
  const count = Math.max(plannedSetsFor(ex.sets, trainingAge), lastTicked + 1)
  const sets: LoggedSet[] = Array.from({ length: count }, (_, i) => entry.sets[i] ?? { done: false })
  const suggested: SetTarget[] | undefined = entry.suggested && toLength(entry.suggested, count)
  return {
    ...entry,
    name: ex.name,
    muscle: ex.muscle,
    loadType: ex.loadType,
    repMin: ex.repMin,
    repMax: ex.repMax,
    ...(suggested ? { suggested } : {}),
    sets,
  }
}

/**
 * The session's entries for its updated plan day. `fresh` holds the entries for the day's lifts the session did
 * not have, built as a new session builds them (targets, hint). `kept` names the lifts that left the plan but stay
 * today because sets of them are ticked.
 */
export function syncEntries(
  entries: WorkoutEntry[],
  day: Exercise[],
  fresh: WorkoutEntry[],
  trainingAge: TrainingAge,
): { entries: WorkoutEntry[]; kept: string[] } {
  const had = new Map(entries.map((e) => [e.exerciseId, e]))
  const added = new Map(fresh.map((e) => [e.exerciseId, e]))
  const synced = day.flatMap((ex) => {
    const old = had.get(ex.id)
    if (old) return [fitted(old, ex, trainingAge)]
    const created = added.get(ex.id)
    return created ? [created] : []
  })
  const inDay = new Set(day.map((ex) => ex.id))
  const started = entries.filter((e) => !inDay.has(e.exerciseId) && e.sets.some((s) => s.done))
  return { entries: [...synced, ...started], kept: started.map((e) => e.name) }
}

/** The lifts of a day the session does not have yet: these need fresh entries built for them. */
export function missingFrom(entries: WorkoutEntry[], day: Exercise[]): Exercise[] {
  const had = new Set(entries.map((e) => e.exerciseId))
  return day.filter((ex) => !had.has(ex.id))
}
