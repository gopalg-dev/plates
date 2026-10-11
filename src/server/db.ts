import { MongoClient, type Db } from 'mongodb'

let client: MongoClient | undefined
let connected: Promise<MongoClient> | undefined
let override: Db | undefined

const uri = () => process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const name = () => process.env.MONGODB_DB ?? 'workout_plan_v3'

function theClient(): MongoClient {
  // ignoreUndefined: a field the app left undefined (a set with no weight yet) is left out, not stored as null.
  client ??= new MongoClient(uri(), { serverSelectionTimeoutMS: 4000, ignoreUndefined: true })
  return client
}

/** Tests hand in a database so no real server is needed. */
export function useDbForTests(db: Db | undefined) {
  override = db
}

export async function getDb(): Promise<Db> {
  if (override) return override
  connected ??= theClient()
    .connect()
    .catch((err) => {
      connected = undefined
      throw err
    })
  await connected
  return theClient().db(name())
}

/**
 * The same database without awaiting a connection: the driver connects on first use.
 * Better Auth's MongoDB adapter takes a `Db` at module load, so it needs this shape.
 */
export function getDbSync(): Db {
  if (override) return override
  return theClient().db(name())
}
