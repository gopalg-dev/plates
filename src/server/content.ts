import { type Collection, type Db, MongoBulkWriteError } from 'mongodb'
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
  /** Library entries that were in the database without the fields a newer bundle added, now filled in. */
  filled: number
}

/**
 * The usual sets and range came to the library after the first databases were seeded: an entry without them takes
 * the bundle's. Only the missing fields are written, so edits made in the database stay.
 */
async function fillLibrary(library: Collection<LibraryDoc>): Promise<number> {
  const res = await library.bulkWrite(
    LIBRARY.map((ex) => ({
      updateOne: {
        filter: { _id: ex.id, sets: { $exists: false } },
        update: { $set: { sets: ex.sets, repMin: ex.repMin, repMax: ex.repMax } },
      },
    })),
    { ordered: false },
  )
  return res.modifiedCount
}

/**
 * Inserts the bundled content. With `reset`, replaces everything; otherwise only adds what is missing, and fills in
 * the fields a newer bundle added to entries already there.
 */
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
  // Unordered, and duplicate keys are not errors: two first requests can seed at the same time.
  const insert = async (
    col: { insertMany: (docs: never[], opts: { ordered: boolean }) => Promise<unknown> },
    docs: unknown[],
  ) => {
    if (docs.length === 0) return
    try {
      await col.insertMany(docs as never[], { ordered: false })
    } catch (err) {
      if (!(err instanceof MongoBulkWriteError) || err.code !== 11000) throw err
    }
  }
  await insert(library, newLibrary)
  await insert(splits, newSplits)
  const filled = await fillLibrary(library)
  return { library: newLibrary.length, splits: newSplits.length, filled }
}

const CACHE_MS = 60_000
let cache: { at: number; content: Content } | undefined
let reading: Promise<Content> | undefined

/** Both lists, read at most once a minute per server process; an empty collection is seeded first. */
export async function readContent(): Promise<Content> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.content
  // One read at a time: concurrent first requests would each try to seed.
  if (!reading) reading = readFresh().finally(() => (reading = undefined))
  return reading
}

async function readFresh(): Promise<Content> {
  const db = await getDb()
  const [libraryCount, splitCount, unfilled] = await Promise.all([
    db.collection('library').countDocuments({}, { limit: 1 }),
    db.collection('splits').countDocuments({}, { limit: 1 }),
    // Only the bundle's own entries can be filled in; one added to the database is its editor's to complete.
    db
      .collection<LibraryDoc>('library')
      .countDocuments({ _id: { $in: LIBRARY.map((ex) => ex.id) }, sets: { $exists: false } }, { limit: 1 }),
  ])
  if (libraryCount === 0 || splitCount === 0 || unfilled > 0) await seedContent(db)
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
