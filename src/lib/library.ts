import type { LoadType, Muscle } from './types'

// A curated subset of free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense).
// Names follow the app's own vocabulary; pictures stay on the project's GitHub raw host. The entries themselves are in
// `library-data.ts`, for the server, the scripts and the tests: this module is what the browser imports, and it must
// not carry the whole library, cues and all, in the bundle.

export const EQUIPMENT = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight'] as const
export type Equipment = (typeof EQUIPMENT)[number]

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
}

export type Level = 'beginner' | 'intermediate' | 'expert'

export interface LibraryExercise {
  id: string
  name: string
  /** The muscle the app counts it under. */
  muscle: Muscle
  /** Everything it works, in the source's words. */
  muscles: string[]
  equipment: Equipment
  /** A machine loaded with bar plates, one each side, rather than a pin stack: it steps like a barbell. */
  plateLoaded?: boolean
  loadType: LoadType
  /**
   * The sets and the range the lift is usually done for: heavy barbell lifts low, machine and dumbbell work in the
   * middle, small lifts high; seconds for a timed hold. A swap, a library pick and a new exercise start from them.
   */
  sets: number
  repMin: number
  repMax: number
  level: Level
  cues: string[]
  /** Paths under the image host, the start and the end of the movement: `Barbell_Squat/0.jpg`, `Barbell_Squat/1.jpg`. */
  images: string[]
}

/**
 * An entry as the app holds it: everything but the cues, which are most of the library's weight and come on their
 * own when an exercise's detail opens. The helpers below take rows, so they serve the server's whole entries too.
 */
export type LibraryRow = Omit<LibraryExercise, 'cues'>

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

/** The source photographs each exercise twice: at the start of the movement and at the end, in that order. */
export const FRAMES = ['start', 'end'] as const
export type Frame = (typeof FRAMES)[number]

export const FRAME_LABEL: Record<Frame, string> = {
  start: 'starting position',
  end: 'end position',
}

export function imageUrl(ex: Pick<LibraryExercise, 'images'>, frame: Frame = 'start'): string {
  return IMAGE_BASE + ex.images[FRAMES.indexOf(frame)]
}

export interface LibraryFilter {
  query?: string
  muscle?: Muscle
  equipment?: Equipment
}

/** Every word typed must appear in the name, the muscles or the equipment. Filters narrow further. */
export function searchLibrary<T extends LibraryRow>(filter: LibraryFilter, items: T[]): T[] {
  const tokens = (filter.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((ex) => {
    if (filter.muscle && ex.muscle !== filter.muscle) return false
    if (filter.equipment && ex.equipment !== filter.equipment) return false
    if (tokens.length === 0) return true
    const hay = `${ex.name} ${ex.muscles.join(' ')} ${ex.equipment}`.toLowerCase()
    return tokens.every((t) => hay.includes(t))
  })
}

export function findLibrary<T extends LibraryRow>(items: T[], id: string): T | undefined {
  return items.find((ex) => ex.id === id)
}

/** An exercise name as the library matches it: case, spaces and punctuation ignored ("Pullups" is "Pull-ups"). */
export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
/** One name index per list, built the first time a list is searched by name. */
const indexes = new WeakMap<LibraryRow[], Map<string, LibraryRow>>()

/** The library entry for an exercise name, matched by `nameKey`. */
export function findLibraryByName<T extends LibraryRow>(items: T[], name: string): T | undefined {
  let index = indexes.get(items)
  if (!index) {
    index = new Map(items.map((ex) => [nameKey(ex.name), ex]))
    indexes.set(items, index)
  }
  // The index was built from `items`, so what it holds is one of them.
  return index.get(nameKey(name)) as T | undefined
}
