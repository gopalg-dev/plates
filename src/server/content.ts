import type { Db } from 'mongodb'
import type { Content, SplitTemplate } from '#/lib/content'
import { LIBRARY, type LibraryExercise } from '#/lib/library'
import { BUNDLED_SPLITS } from '#/lib/splits'
import type { PlanDay, SplitId } from '#/lib/types'
import { getDb } from './db'

/**
 * Reference content in the database: `library` (one document per exercise, `_id` is the exercise
 * id) and `splits` (one per template, `_id` is the split id). Seeded from the bundled copies when a
 * collection is empty, so a fresh database works at once; `bun run db:seed` does the same by hand
 * and can add what a newer bundle brings or reset to it. Edits made in the database stay: a seed
 * never overwrites a document that is already there unless asked to reset.
 */

type LibraryDoc = Omit<LibraryExercise, 'id'> & { _id: string; updatedAt: string }
type SplitDoc = Omit<SplitTemplate, 'id'> & { _id: string; updatedAt: string }

export interface SeedReport {
  library: number
  splits: number
}

/** Inserts the bundled content. With `reset`, replaces everything; otherwise only adds what is missing. */
export async function seedContent(db: Db, { reset = false } = {}): Promise<SeedReport> {
  const library = db.collection<LibraryDoc>('library')
  const splits = db.collection<SplitDoc>('splits')
  const updatedAt = new Date().toISOString()
  if (reset) await Promise.all([library.deleteMany({}), splits.deleteMany({})])
  const have = {
    library: new Set((await library.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id)),
    splits: new Set((await splits.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id)),
  }
  const newLibrary = LIBRARY.filter((ex) => !have.library.has(ex.id)).map(({ id, ...rest }) => ({
    _id: id,
    ...rest,
    updatedAt,
  }))
  const newSplits = BUNDLED_SPLITS.filter((s) => !have.splits.has(s.id)).map(({ id, ...rest }) => ({
    _id: id,
    ...rest,
    updatedAt,
  }))
  if (newLibrary.length) await library.insertMany(newLibrary)
  if (newSplits.length) await splits.insertMany(newSplits)
  return { library: newLibrary.length, splits: newSplits.length }
}

const CACHE_MS = 60_000
let cache: { at: number; content: Content } | undefined

/** Both lists, read at most once a minute per server process; an empty collection is seeded first. */
export async function readContent(): Promise<Content> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.content
  const db = await getDb()
  const [libraryCount, splitCount] = await Promise.all([
    db.collection('library').countDocuments({}, { limit: 1 }),
    db.collection('splits').countDocuments({}, { limit: 1 }),
  ])
  if (libraryCount === 0 || splitCount === 0) await seedContent(db)
  const [libraryDocs, splitDocs] = await Promise.all([
    db.collection<LibraryDoc>('library').find().sort({ name: 1 }).toArray(),
    db.collection<SplitDoc>('splits').find().sort({ order: 1 }).toArray(),
  ])
  const content: Content = {
    library: libraryDocs.map(({ _id, updatedAt: _u, ...rest }) => ({ id: _id, ...rest })),
    splits: splitDocs.map(({ _id, updatedAt: _u, ...rest }) => ({ id: _id, ...rest })),
  }
  cache = { at: Date.now(), content }
  return content
}

/** Forgets the cached copy, for tests and the seed script. */
export function forgetContent() {
  cache = undefined
}

/** A fresh copy of one template's days. */
export async function splitTemplate(id: SplitId): Promise<PlanDay[]> {
  const { splits } = await readContent()
  const found = splits.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown split "${id}"`)
  return structuredClone(found.days)
}
