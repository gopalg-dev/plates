import data from './library.json'
import type { LoadType, Muscle } from './types'

// A curated subset of free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense).
// Names follow the app's own vocabulary; pictures stay on the project's GitHub raw host.

export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'] as const
export type Equipment = (typeof EQUIPMENT)[number]

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
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
  loadType: LoadType
  level: Level
  cues: string[]
  /** Path under the image host, like `Barbell_Squat/0.jpg`. */
  image: string
}

/** The entries that ship with the app. They seed the `library` collection; the app reads from there. */
export const LIBRARY = data as LibraryExercise[]

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export function imageUrl(ex: Pick<LibraryExercise, 'image'>): string {
  return IMAGE_BASE + ex.image
}

export interface LibraryFilter {
  query?: string
  muscle?: Muscle
  equipment?: Equipment
}

/** Every word typed must appear in the name, the muscles or the equipment. Filters narrow further. */
export function searchLibrary(filter: LibraryFilter, items: LibraryExercise[]): LibraryExercise[] {
  const tokens = (filter.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((ex) => {
    if (filter.muscle && ex.muscle !== filter.muscle) return false
    if (filter.equipment && ex.equipment !== filter.equipment) return false
    if (tokens.length === 0) return true
    const hay = `${ex.name} ${ex.muscles.join(' ')} ${ex.equipment}`.toLowerCase()
    return tokens.every((t) => hay.includes(t))
  })
}

export function findLibrary(items: LibraryExercise[], id: string): LibraryExercise | undefined {
  return items.find((ex) => ex.id === id)
}

const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
/** One name index per list, built the first time a list is searched by name. */
const indexes = new WeakMap<LibraryExercise[], Map<string, LibraryExercise>>()

/** The library entry for an exercise name, ignoring case, spaces and punctuation ("Pullups" finds "Pull-ups"). */
export function findLibraryByName(items: LibraryExercise[], name: string): LibraryExercise | undefined {
  let index = indexes.get(items)
  if (!index) {
    index = new Map(items.map((ex) => [loose(ex.name), ex]))
    indexes.set(items, index)
  }
  return index.get(loose(name))
}
