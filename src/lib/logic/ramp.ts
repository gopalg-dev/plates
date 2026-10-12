import type { Exercise, Muscle, TrainingAge, Workout, WorkoutEntry } from '../types'
import { dayKey, finished, startOfWeek, weeklyStrength } from './stats'
import { liftTrend } from './trend'

/**
 * The set ramp: the third lever of progressive overload, after weight and reps. A lift that was
 * trained often, completed in full and felt fine earns one more set a week, up to a cap, until a
 * deload week drops it back to the plan's number. Stuck or slipping lifts never ramp: more sets on
 * a stalled lift is the thing the volume research warns about.
 */

/** Sets one exercise can hold. */
export const RAMP_MAX_SETS = 6
/** Hard sets a muscle can be planned for in a week; the top of the range the dose-response work supports. */
export const RAMP_MAX_WEEKLY = 20
/** The lift must have been trained this often in these many days: a lift done once a month does not ramp. */
export const RAMP_WINDOW_DAYS = 14
export const RAMP_MIN_SESSIONS = 2
/**
 * Effort of 1 easy, 2 ok, 3 hard, 4 too much: at or under this, the sessions count. Hard is the
 * normal rating of a session whose targets sit at the top of the range, which is where the app
 * puts them; a two-year simulation with "ok or easier" never earned a single set.
 */
const RAMP_EFFORT_MAX = 3

/** Every planned set done, each reaching the bottom of the rep range (or the seconds). */
export function completedInRange(entry: WorkoutEntry): boolean {
  if (entry.sets.length === 0) return false
  return entry.sets.every((s) => {
    if (!s.done) return false
    const got = entry.loadType === 'time' ? (s.seconds ?? 0) : (s.reps ?? 0)
    return got >= entry.repMin
  })
}

/**
 * Whether a lift has earned a set this week. Over a year of training only (under a year the logger
 * caps every lift at three), below both caps, not already ramped this week, trained at least twice
 * in the last two weeks with every one of those sessions completed in range and none rated too much,
 * and neither stuck nor slipping.
 */
export function rampOffer(
  ex: Exercise,
  weeklyByMuscle: Record<Muscle, number>,
  workouts: Workout[],
  now: Date,
  trainingAge: TrainingAge,
): boolean {
  if (trainingAge !== 'over1') return false
  if (ex.sets >= RAMP_MAX_SETS) return false
  if (weeklyByMuscle[ex.muscle] + 1 > RAMP_MAX_WEEKLY) return false
  if (ex.ramp?.at === dayKey(startOfWeek(now))) return false
  const since = now.getTime() - RAMP_WINDOW_DAYS * 86_400_000
  const recent = finished(workouts)
    .filter((w) => new Date(w.finishedAt!).getTime() >= since)
    .map((w) => ({ w, entry: w.entries.find((e) => e.exerciseId === ex.id && e.sets.some((s) => s.done)) }))
    .filter((x): x is { w: Workout; entry: WorkoutEntry } => x.entry !== undefined)
  if (recent.length < RAMP_MIN_SESSIONS) return false
  if (!recent.every(({ w, entry }) => w.effort !== undefined && w.effort <= RAMP_EFFORT_MAX && completedInRange(entry)))
    return false
  const trend = liftTrend(weeklyStrength(workouts, ex.id), now)
  return trend !== 'stuck' && trend !== 'slipping'
}
