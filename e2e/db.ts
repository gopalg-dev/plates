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
