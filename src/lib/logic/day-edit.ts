import { findLibraryByName, type LibraryExercise } from '../library'
import { slug } from '../seed-plan'
import { type Exercise, MAX_EXERCISES_PER_DAY, type PlanDay } from '../types'
import { guessLoad } from './plan-sheet'

/*
 * The edits a plan day takes from the exercise editor: change an exercise, add one, take one off, swap one for an
 * alternate. Pure: each returns a new day and leaves the one passed in alone. The server saves what they return;
 * the demo on How it works keeps it on the page.
 */

/** What the editor changes on an exercise. */
export type ExercisePatch = Partial<Omit<Exercise, 'id'>>

function findExercise(day: PlanDay, exerciseId: string): Exercise {
  const ex = day.exercises.find((e) => e.id === exerciseId)
  if (!ex) throw new Error('Exercise not found')
  return ex
}

/** `base`, or `base-2`, `base-3`… when the day already uses it. */
export function uniqueId(base: string, taken: string[]): string {
  let id = base
  let n = 2
  while (taken.includes(id)) id = `${base}-${n++}`
  return id
}

export function updateExerciseIn(day: PlanDay, exerciseId: string, patch: ExercisePatch): PlanDay {
  const next = structuredClone(day)
  const ex = findExercise(next, exerciseId)
  // A number typed by hand is the plan's number again: the ramp's memory of the old one goes.
  if (patch.sets !== undefined) delete ex.ramp
  Object.assign(ex, patch)
  return next
}

/** Adds an exercise to the end of the day. A day holds `MAX_EXERCISES_PER_DAY` at most. */
export function addExerciseTo(day: PlanDay, input: Omit<Exercise, 'id'>): PlanDay {
  if (day.exercises.length >= MAX_EXERCISES_PER_DAY) {
    throw new Error(`A day holds up to ${MAX_EXERCISES_PER_DAY} exercises`)
  }
  const next = structuredClone(day)
  const id = uniqueId(
    slug(input.name),
    next.exercises.map((e) => e.id),
  )
  next.exercises.push({ ...input, id })
  return next
}

/** Takes an exercise off the day. A day keeps at least one exercise. */
export function removeExerciseFrom(day: PlanDay, exerciseId: string): PlanDay {
  findExercise(day, exerciseId)
  if (day.exercises.length <= 1) throw new Error('A day needs at least one exercise')
  return { ...day, exercises: day.exercises.filter((e) => e.id !== exerciseId) }
}

/** Replaces an exercise with one of its alternates. The old one becomes an alternate, so you can swap back. */
export function swapExerciseIn(day: PlanDay, exerciseId: string, newName: string, library: LibraryExercise[]): PlanDay {
  const next = structuredClone(day)
  const ex = findExercise(next, exerciseId)
  const name = newName.trim()
  if (!name) throw new Error('Name is empty')
  const others = (ex.alternates ?? []).filter((a) => a !== name)
  ex.alternates = [ex.name, ...others]
  ex.name = name
  // The alternate's own shape: Pull-ups are bodyweight, Lat Pulldown takes a weight. Unknown names are guessed.
  const known = findLibraryByName(library, name)
  ex.loadType = known?.loadType ?? guessLoad(name, '')
  if (known) ex.muscle = known.muscle
  ex.id = uniqueId(
    slug(name),
    next.exercises.filter((e) => e !== ex).map((e) => e.id),
  )
  return next
}
