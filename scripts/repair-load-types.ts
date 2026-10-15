/**
 * Repairs exercises whose load type disagrees with the library's, left behind by the alternate-swap
 * bug (a swapped-in alternate kept the old exercise's type: Pull-ups swapped to Lat Pulldown stayed
 * "bodyweight", so its sets were logged with no weight field).
 *
 *   bun run db:repair            lists what would change, touches nothing
 *   bun run db:repair -- --yes   applies it
 *
 * Only the bug's two shapes are touched, on plans and on logged workouts: bodyweight → weight where
 * the library says weight, and weight → bodyweight where the library says bodyweight and no set of
 * that entry has a weight above zero. Names the library does not know are left alone.
 *
 * Reads MONGODB_URI and MONGODB_DB from .env like the app. Never prints the connection string.
 */
import { type Collection, type Document, MongoClient } from 'mongodb'
import { findLibraryByName } from '../src/lib/library'
import { LIBRARY } from '../src/lib/library-data'
import type { LoadType, LoggedSet } from '../src/lib/types'

const args = process.argv.slice(2)
const apply = args.includes('--yes')

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB ?? 'workout_plan_v3'
const host = (() => {
  try {
    return new URL(uri).host
  } catch {
    return 'the configured server'
  }
})()

/** The type an exercise should have, or null when it is right or not the bug's shape. */
function fixedType(name: string, loadType: LoadType, sets: LoggedSet[] = []): LoadType | null {
  const lib = findLibraryByName(LIBRARY, name)
  if (!lib || lib.loadType === loadType) return null
  if (loadType === 'bodyweight' && lib.loadType === 'weight') return 'weight'
  if (loadType === 'weight' && lib.loadType === 'bodyweight' && !sets.some((s) => (s.weight ?? 0) > 0)) {
    return 'bodyweight'
  }
  return null
}

interface Change {
  where: string
  name: string
  from: LoadType
  to: LoadType
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(dbName)
const changes: Change[] = []
let writes = 0

/** Walks a collection of documents that hold `days[].exercises[]`: the plans, and the legacy single plan. */
async function repairPlans(col: Collection<Document>, label: string) {
  for await (const doc of col.find({})) {
    let touched = false
    for (const day of doc.days ?? []) {
      for (const ex of day.exercises ?? []) {
        const to = fixedType(ex.name, ex.loadType)
        if (!to) continue
        changes.push({
          where: `${label} ${doc.split ?? ''} · ${day.name} (user ${doc.userId})`,
          name: ex.name,
          from: ex.loadType,
          to,
        })
        ex.loadType = to
        touched = true
      }
    }
    if (touched && apply) {
      await col.updateOne({ _id: doc._id }, { $set: { days: doc.days } })
      writes++
    }
  }
}

async function repairWorkouts() {
  const col = db.collection('workouts')
  for await (const doc of col.find({})) {
    let touched = false
    for (const entry of doc.entries ?? []) {
      const to = fixedType(entry.name, entry.loadType, entry.sets ?? [])
      if (!to) continue
      const when = String(doc.finishedAt ?? doc.startedAt ?? '').slice(0, 10)
      changes.push({
        where: `workout ${when} ${doc.dayName} (user ${doc.userId})`,
        name: entry.name,
        from: entry.loadType,
        to,
      })
      entry.loadType = to
      touched = true
    }
    if (touched && apply) {
      await col.updateOne({ _id: doc._id }, { $set: { entries: doc.entries } })
      writes++
    }
  }
}

await repairPlans(db.collection('plans'), 'plan')
await repairPlans(db.collection('plan'), 'legacy plan')
await repairWorkouts()
await client.close()

if (changes.length === 0) {
  console.log(`Nothing to repair in "${dbName}" on ${host}.`)
} else {
  for (const c of changes) console.log(`${c.where}: ${c.name} ${c.from} → ${c.to}`)
  console.log(
    apply
      ? `Applied ${changes.length} change(s) across ${writes} document(s) in "${dbName}" on ${host}.`
      : `${changes.length} change(s) would be made in "${dbName}" on ${host}. Run again with --yes to apply.`,
  )
}
