import type { Exercise, LoggedSet, Muscle, Units, WorkoutEntry } from '../types'
import { fmtWeight } from './units'

const LOWER: Muscle[] = ['quads', 'hamstrings', 'calves']

/** Double progression step: 2.5 kg upper, 5 kg lower (5 / 10 in lb). */
export function incrementFor(muscle: Muscle, units: Units): number {
  const lower = LOWER.includes(muscle)
  if (units === 'kg') return lower ? 5 : 2.5
  return lower ? 10 : 5
}

/** Rest between sets, in seconds. Big lifts get 2-3 min, small ones 60-90 s. */
export function restSecondsFor(exercise: Pick<Exercise, 'repMax' | 'loadType' | 'muscle'>): number {
  if (exercise.loadType === 'time') return 60
  if (exercise.repMax <= 10) return 150
  return 90
}

export interface Suggestion {
  sets: LoggedSet[]
  hint?: string
  bumped: boolean
}

function blank(n: number): LoggedSet[] {
  return Array.from({ length: n }, () => ({ done: false }))
}

function carry(doneSets: LoggedSet[], n: number, map: (s: LoggedSet) => LoggedSet): LoggedSet[] {
  return Array.from({ length: n }, (_, i) => map(doneSets[Math.min(i, doneSets.length - 1)]))
}

/**
 * Prefill the next session from the last one.
 * Weight lifts: every set hit the top of the range -> add the increment, drop to the bottom of the range.
 * Bodyweight: every set at the top -> slow the tempo. Otherwise add a rep where possible.
 * Timed holds: at the top -> add 5 seconds.
 */
export function suggestNext(
  exercise: Pick<Exercise, 'repMin' | 'repMax' | 'muscle' | 'loadType'>,
  targetSets: number,
  last: WorkoutEntry | undefined,
  units: Units,
): Suggestion {
  if (!last) return { sets: blank(targetSets), bumped: false }
  const doneSets = last.sets.filter((s) => s.done)
  if (doneSets.length === 0) return { sets: blank(targetSets), bumped: false }

  const fullCount = doneSets.length >= targetSets

  if (exercise.loadType === 'weight') {
    const weights = doneSets.map((s) => s.weight ?? 0)
    const top = Math.max(...weights)
    const reps = doneSets.map((s) => s.reps ?? 0)
    const allAtTop = fullCount && reps.every((r) => r >= exercise.repMax)
    const lastLine = `Last time ${fmtWeight(top, units)} × ${reps.join(', ')}.`
    if (allAtTop) {
      const next = top + incrementFor(exercise.muscle, units)
      return {
        sets: Array.from({ length: targetSets }, () => ({ weight: next, reps: exercise.repMin, done: false })),
        hint: `${lastLine} Try ${fmtWeight(next, units)}.`,
        bumped: true,
      }
    }
    return {
      sets: carry(doneSets, targetSets, (s) => ({ weight: s.weight, reps: s.reps, done: false })),
      hint: lastLine,
      bumped: false,
    }
  }

  if (exercise.loadType === 'bodyweight') {
    const reps = doneSets.map((s) => s.reps ?? 0)
    const allAtTop = fullCount && reps.every((r) => r >= exercise.repMax)
    if (allAtTop) {
      return {
        sets: carry(doneSets, targetSets, (s) => ({ reps: s.reps, done: false })),
        hint: `You hit ${exercise.repMax} on every set. Slow the lowering to 3 seconds.`,
        bumped: true,
      }
    }
    return {
      sets: carry(doneSets, targetSets, (s) => ({ reps: s.reps, done: false })),
      hint: `Last time ${reps.join(', ')}. Add a rep where you can.`,
      bumped: false,
    }
  }

  const secs = doneSets.map((s) => s.seconds ?? 0)
  const allAtTop = fullCount && secs.every((s) => s >= exercise.repMax)
  const next = allAtTop ? Math.max(...secs) + 5 : undefined
  return {
    sets: carry(doneSets, targetSets, (s) => ({ seconds: next ?? s.seconds, done: false })),
    hint: allAtTop ? `Last time ${secs.join(', ')} s. Try ${next} s.` : `Last time ${secs.join(', ')} s.`,
    bumped: allAtTop,
  }
}
