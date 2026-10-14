import { findLibraryByName, type LibraryExercise, nameKey } from '../library'
import { slug } from '../seed-plan'
import { type Exercise, MAX_EXERCISES_PER_DAY, type PlanDay, type WorkoutEntry } from '../types'
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

/** A session lift as a plan line, for a swap on a session whose day no longer has the lift. */
export function lineOf(
  entry: Pick<WorkoutEntry, 'exerciseId' | 'name' | 'muscle' | 'loadType' | 'repMin' | 'repMax'>,
  sets: number,
): Exercise {
  return {
    id: entry.exerciseId,
    name: entry.name,
    sets,
    repMin: entry.repMin,
    repMax: entry.repMax,
    muscle: entry.muscle,
    loadType: entry.loadType,
  }
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

/** Takes an exercise off the day. The last one can go too: a day with no lifts waits on Plan to be filled. */
export function removeExerciseFrom(day: PlanDay, exerciseId: string): PlanDay {
  findExercise(day, exerciseId)
  return { ...day, exercises: day.exercises.filter((e) => e.id !== exerciseId) }
}

/** Replaces an exercise with one of its alternates. The old one becomes an alternate, so you can swap back. */
export function swapExerciseIn(day: PlanDay, exerciseId: string, newName: string, library: LibraryExercise[]): PlanDay {
  const next = structuredClone(day)
  const at = next.exercises.findIndex((e) => e.id === exerciseId)
  if (at < 0) throw new Error('Exercise not found')
  next.exercises[at] = swapLine(
    next.exercises[at],
    newName,
    library,
    next.exercises.filter((_, i) => i !== at).map((e) => e.id),
  )
  return next
}

/**
 * One plan line swapped for another lift, by name. The old name becomes an alternate, so you can swap back. A lift
 * the library knows brings its own shape: its load type (Pull-ups are bodyweight, Lat Pulldown takes a weight), its
 * muscle, and its usual sets and range (a hack squat is not done for a squat's 5-8). Unknown names keep the line's
 * numbers and have their load type guessed. `taken` holds the ids the new one must not clash with.
 */
export function swapLine(line: Exercise, newName: string, library: LibraryExercise[], taken: string[]): Exercise {
  const ex = structuredClone(line)
  const name = newName.trim()
  if (!name) throw new Error('Name is empty')
  if (nameKey(name) === nameKey(ex.name)) throw new Error(`${ex.name} is the lift already`)
  const others = (ex.alternates ?? []).filter((a) => a !== name)
  ex.alternates = [ex.name, ...others]
  ex.name = name
  const known = findLibraryByName(library, name)
  ex.loadType = known?.loadType ?? guessLoad(name, '')
  if (known) {
    ex.muscle = known.muscle
    ex.sets = known.sets
    ex.repMin = known.repMin
    ex.repMax = known.repMax
    // The set count is the new lift's own: the ramp's memory of the old one goes.
    delete ex.ramp
  }
  ex.id = uniqueId(slug(name), taken)
  return ex
}
