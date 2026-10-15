import type { LibraryExercise } from './library'
import data from './library.json'

/**
 * The entries that ship with the app. They seed the `library` collection; the app reads from there. For the server,
 * the scripts and the tests only: a browser import would put the whole library, cues and all, in the bundle, while the
 * app gets rows from `getContentFn` and an entry's cues when its detail opens.
 */
export const LIBRARY = data as LibraryExercise[]
