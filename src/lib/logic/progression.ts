import type { Exercise, LoggedSet, Muscle, Progression, SetTarget, Settings, Units, WorkoutEntry } from '../types'
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

/** One earlier session of an exercise, newest first in a history, with how that session felt. */
export interface PastEntry {
  entry: WorkoutEntry
  /** 1 easy, 2 ok, 3 hard, 4 too much. */
  effort?: number
}

export interface Suggestion {
  /** Blank sets, one per planned set. Nothing is logged until the user marks a set done. */
  sets: LoggedSet[]
  /** What each set should aim for, by index. Shown as placeholders; adopted when the set is marked done. */
  suggested?: SetTarget[]
  hint?: string
}

/** Sessions at the same top weight without reaching the top of the range before the load comes down. */
export const STALL_SESSIONS = 3

export const PROGRESSION_OPTIONS: { value: Progression; title: string; detail: string; example: string }[] = [
  {
    value: 'double',
    title: 'Reps first, then weight',
    detail: 'Add reps each session. At the top of the range, add weight and start the range again.',
    example: '60 kg × 8 → × 10 → × 12, then 62.5 kg × 8',
  },
  {
    value: 'linear',
    title: 'Weight every session',
    detail: 'Finish every set, add weight next time.',
    example: '60 kg → 62.5 kg → 65 kg',
  },
  {
    value: 'topset',
    title: 'Last set all out',
    detail: 'Do the last set for as many reps as you can. More reps, more weight next time.',
    example: 'Last set 60 kg × 10, next time 62.5 kg',
  },
]

export const PROGRESSION_LABEL: Record<Progression, string> = Object.fromEntries(
  PROGRESSION_OPTIONS.map((o) => [o.value, o.title]),
) as Record<Progression, string>

/** Under a year of training adds weight every session; from then on, reps first. */
export function defaultProgression(trainingAge: Settings['trainingAge']): Progression {
  return trainingAge === 'under1' ? 'linear' : 'double'
}

export function progressionOf(settings: Pick<Settings, 'trainingAge' | 'progression'>): Progression {
  return settings.progression ?? defaultProgression(settings.trainingAge)
}

function blank(n: number): LoggedSet[] {
  return Array.from({ length: n }, () => ({ done: false }))
}

function doneOf(entry: WorkoutEntry): LoggedSet[] {
  return entry.sets.filter((s) => s.done)
}

function carry<T>(done: LoggedSet[], n: number, map: (s: LoggedSet, i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => map(done[Math.min(i, done.length - 1)], i))
}

/** The nearest multiple of a plate step. */
function roundTo(n: number, step: number): number {
  return Math.round(Math.round(n / step) * step * 100) / 100
}

function listSets(indexes: number[]): string {
  const names = indexes.map((i) => String(i + 1))
  if (names.length === 1) return `Set ${names[0]}`
  return `Sets ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * What to aim for next time, from the last sessions of the exercise (newest first).
 *
 * Weight lifts follow dynamic double progression: each set that reached the top of the rep range goes
 * up by the increment and back to the bottom of the range; the others repeat. A session rated "too
 * much" holds every weight; one rated "easy" lets a set one rep short of the top go up too. Three
 * sessions in a row at the same weight without any set reaching the top bring the weight down by a
 * tenth to build back up. Bodyweight work at the top asks for a slower tempo; timed holds add 5 s.
 */
export function suggestNext(
  exercise: Pick<Exercise, 'repMin' | 'repMax' | 'muscle' | 'loadType'>,
  targetSets: number,
  history: PastEntry[],
  units: Units,
  method: Progression = 'double',
): Suggestion {
  const sets = blank(targetSets)
  const past = history.filter((h) => doneOf(h.entry).length > 0)
  const last = past[0]
  if (!last) return { sets }
  const done = doneOf(last.entry)

  if (exercise.loadType === 'weight') {
    const inc = incrementFor(exercise.muscle, units)
    const top = Math.max(...done.map((s) => s.weight ?? 0))
    const reps = done.map((s) => s.reps ?? 0)
    // One weight across the sets reads "60 kg × 8, 8, 7"; a pyramid reads "10 × 12, 12.5 × 10, 15 kg × 8".
    const oneWeight = done.every((s) => (s.weight ?? 0) === top)
    const lastLine = oneWeight
      ? `Last time ${fmtWeight(top, units)} × ${reps.join(', ')}.`
      : `Last time ${done
          .map((s, i) => `${fmtWeight(s.weight, i === done.length - 1 ? units : undefined)} × ${s.reps ?? 0}`)
          .join(', ')}.`

    const stalled =
      method !== 'topset' &&
      past.length >= STALL_SESSIONS &&
      past.slice(0, STALL_SESSIONS).every((h) => {
        const d = doneOf(h.entry)
        const t = Math.max(...d.map((s) => s.weight ?? 0))
        return t === top && !d.some((s) => (s.reps ?? 0) >= exercise.repMax)
      })
    if (stalled) {
      const lighter = Math.max(inc, roundTo(top * 0.9, inc))
      return {
        sets,
        suggested: sets.map(() => ({ weight: lighter, reps: exercise.repMin })),
        hint: `${STALL_SESSIONS} sessions at ${fmtWeight(top, units)}. Try ${fmtWeight(lighter, units)} and build back up.`,
      }
    }

    const hold = last.effort === 4
    // Three or more reps left on the last set: the weight was light, whatever the rep count said.
    const light = !hold && (done[done.length - 1].left ?? 0) >= 3

    if (method === 'topset') {
      // APRE: the last set's count sets the whole next session's load.
      const lastSet = done[done.length - 1]
      const r = lastSet.reps ?? 0
      const base = lastSet.weight ?? top
      const steps =
        (r < exercise.repMin ? -1 : r < exercise.repMax ? 0 : r < exercise.repMax + 3 ? 1 : 2) + (light ? 1 : 0)
      const next = hold ? base : Math.max(inc, base + steps * inc)
      const suggested = sets.map((_, i) => ({
        weight: next,
        reps: i === targetSets - 1 ? exercise.repMax : exercise.repMin,
      }))
      let hint = `Last set ${fmtWeight(base, units)} × ${r}.`
      if (hold) hint += ' That was too much; hold the weight.'
      else if (next > base) hint += ` Try ${fmtWeight(next, units)}; last set as many as you can.`
      else if (next < base) hint += ` Back to ${fmtWeight(next, units)}; last set as many as you can.`
      else hint += ' Same weight; last set as many as you can.'
      return { sets, suggested, hint }
    }

    if (method === 'linear') {
      // Every planned set done at or above the bottom of the range earns a plate step on all of them.
      const completed = done.length >= targetSets && done.every((s) => (s.reps ?? 0) >= exercise.repMin)
      const next = (completed || light) && !hold ? top + inc : top
      const suggested = carry(done, targetSets, (s) => ({ weight: next, reps: next > top ? exercise.repMin : s.reps }))
      let hint = lastLine
      if (hold) hint += ' That was too much; hold the weight.'
      else if (light) hint += ` Reps to spare; try ${fmtWeight(next, units)}.`
      else if (next > top) hint += ` Try ${fmtWeight(next, units)}.`
      return { sets, suggested, hint }
    }

    if (light) {
      return {
        sets,
        suggested: carry(done, targetSets, () => ({ weight: top + inc, reps: exercise.repMin })),
        hint: `${lastLine} Reps to spare; try ${fmtWeight(top + inc, units)}.`,
      }
    }

    const threshold = last.effort === 1 ? exercise.repMax - 1 : exercise.repMax
    const bumped: number[] = []
    const suggested = carry(done, targetSets, (s, i) => {
      const up = !hold && i < done.length && (s.reps ?? 0) >= threshold
      if (up) bumped.push(i)
      // A set below the top aims one rep higher than last time, up to the top of the range.
      return up
        ? { weight: (s.weight ?? 0) + inc, reps: exercise.repMin }
        : { weight: s.weight, reps: Math.min((s.reps ?? exercise.repMin) + 1, exercise.repMax) }
    })
    let hint = lastLine
    const nextWeights = new Set(bumped.map((i) => suggested[i].weight))
    const aims = suggested.map((t) => t.reps ?? exercise.repMin)
    if (hold) hint += ' That was too much; hold the weight.'
    else if (bumped.length === 0) hint += ` Aim for ${new Set(aims).size === 1 ? aims[0] : aims.join(', ')}.`
    else if (bumped.length === targetSets && nextWeights.size === 1) hint += ` Try ${fmtWeight(top + inc, units)}.`
    else if (bumped.length > 0 && nextWeights.size === 1) {
      hint += ` ${listSets(bumped)} up to ${fmtWeight(suggested[bumped[0]].weight, units)}.`
    } else if (bumped.length > 0) {
      hint += ` ${bumped.map((i) => `Set ${i + 1} up to ${fmtWeight(suggested[i].weight, units)}`).join(', ')}.`
    }
    return { sets, suggested, hint }
  }

  if (exercise.loadType === 'bodyweight') {
    const reps = done.map((s) => s.reps ?? 0)
    const allAtTop = done.length >= targetSets && reps.every((r) => r >= exercise.repMax)
    return {
      sets,
      suggested: carry(done, targetSets, (s) => ({ reps: s.reps })),
      hint: allAtTop
        ? `You hit ${exercise.repMax} on every set. Slow the lowering to 3 seconds.`
        : `Last time ${reps.join(', ')}. Add a rep where you can.`,
    }
  }

  const secs = done.map((s) => s.seconds ?? 0)
  const allAtTop = done.length >= targetSets && secs.every((s) => s >= exercise.repMax)
  const next = allAtTop ? Math.max(...secs) + 5 : undefined
  return {
    sets,
    suggested: carry(done, targetSets, (s) => ({ seconds: next ?? s.seconds })),
    hint: allAtTop ? `Last time ${secs.join(', ')} s. Try ${next} s.` : `Last time ${secs.join(', ')} s.`,
  }
}
