import { MongoClient } from 'mongodb'
import { E2E_DB } from '../playwright.config'

// The e2e run always uses the local Docker database; see playwright.config.ts.
const uri = 'mongodb://localhost:27017'

/** Wipes the e2e database so each browser project starts from first run. */
export async function resetDatabase() {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 4000 })
  try {
    await client.db(E2E_DB).dropDatabase()
  } finally {
    await client.close()
  }
}

/**
 * The newest outbox mail to `email` that carries `field`. Without a mail provider the server keeps
 * mails in an outbox; the server writes them in the background, so this waits a few seconds for one.
 */
async function lastMail(email: string, field: 'link' | 'code'): Promise<string> {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 4000 })
  try {
    for (let tries = 0; tries < 25; tries++) {
      const mail = await client
        .db(E2E_DB)
        .collection('mail_outbox')
        .findOne({ to: email, [field]: { $exists: true } }, { sort: { sentAt: -1 } })
      const value = mail?.[field]
      if (typeof value === 'string') return value
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error(`No ${field} was mailed to ${email}`)
  } finally {
    await client.close()
  }
}

/** The newest sign-in link mailed to `email`. */
export const lastMagicLink = (email: string) => lastMail(email, 'link')

/** The newest sign-up code mailed to `email`. */
export const lastCode = (email: string) => lastMail(email, 'code')

/** Moves the join date back, so earlier weeks on the Stats calendar become selectable. */
export async function backdateJoin(days: number) {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 4000 })
  try {
    const joinedAt = new Date(Date.now() - days * 86_400_000).toISOString()
    await client.db(E2E_DB).collection('settings').updateMany({}, { $set: { joinedAt } })
  } finally {
    await client.close()
  }
}

/** What the database still holds for an address, plus the deletion log line count. */
export async function traceOf(email: string): Promise<Record<string, number>> {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 4000 })
  try {
    const db = client.db(E2E_DB)
    const user = await db.collection('user').findOne({ email })
    const ids = user ? [user._id, user._id.toHexString()] : []
    const by = (field: string) => (ids.length ? { [field]: { $in: ids } } : { [field]: '__none__' })
    const [users, accounts, sessions, settings, plans, workouts, deletions] = await Promise.all([
      db.collection('user').countDocuments({ email }),
      db.collection('account').countDocuments(by('userId')),
      db.collection('session').countDocuments(by('userId')),
      db
        .collection('settings')
        .countDocuments(ids.length ? { _id: { $in: ids } as never } : { _id: '__none__' as never }),
      db.collection('plans').countDocuments(by('userId')),
      db.collection('workouts').countDocuments(by('userId')),
      db.collection('deletions').countDocuments({}),
    ])
    return { user: users, account: accounts, session: sessions, settings, plans, workouts, deletions }
  } finally {
    await client.close()
  }
}
