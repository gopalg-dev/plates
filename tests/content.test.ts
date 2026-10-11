import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LIBRARY } from '#/lib/library'
import { BUNDLED_SPLITS } from '#/lib/splits'
import { useDbForTests } from '#/server/db'
import { forgetContent, readContent, seedContent, splitTemplate } from '#/server/content'

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
// Its own database: the repo tests seed content too, and the two files run at the same time.
const dbName = `${process.env.MONGODB_DB ?? 'workout_plan_v3'}_content_test`

let client: MongoClient | undefined
try {
  client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 1500 })
} catch {
  client = undefined
}

const suite = describe.skipIf(!client)

beforeAll(() => {
  if (client) useDbForTests(client.db(dbName))
})
afterAll(async () => {
  useDbForTests(undefined)
  await client?.close()
})
beforeEach(async () => {
  if (client) await client.db(dbName).dropDatabase()
  forgetContent()
})

suite('content', () => {
  it('seeds an empty database from the bundle and reads it back', async () => {
    const report = await seedContent(client!.db(dbName))
    expect(report).toEqual({ library: LIBRARY.length, splits: BUNDLED_SPLITS.length })
    const content = await readContent()
    expect(content.library).toHaveLength(LIBRARY.length)
    expect(content.splits.map((s) => s.id)).toEqual(BUNDLED_SPLITS.map((s) => s.id))
    expect(content.splits[0].days[0].exercises.length).toBeGreaterThan(0)
  })

  it('reads a fresh database by seeding it first', async () => {
    const content = await readContent()
    expect(content.splits).toHaveLength(BUNDLED_SPLITS.length)
    expect((await splitTemplate('ul4')).length).toBe(4)
    await expect(splitTemplate('nope')).rejects.toThrow('Unknown split')
  })

  it('keeps edits made in the database and only adds what is missing', async () => {
    const db = client!.db(dbName)
    await seedContent(db)
    await db.collection('library').updateOne({ _id: 'pull-ups' as never }, { $set: { name: 'Chin-ups, wide' } })
    await db.collection('library').deleteOne({ _id: 'plank' as never })
    const again = await seedContent(db)
    expect(again).toEqual({ library: 1, splits: 0 })
    forgetContent()
    const { library } = await readContent()
    expect(library.find((e) => e.id === 'pull-ups')?.name).toBe('Chin-ups, wide')
    expect(library.find((e) => e.id === 'plank')?.name).toBe('Plank')
  })

  it('resets to the bundle on request', async () => {
    const db = client!.db(dbName)
    await seedContent(db)
    await db.collection('library').updateOne({ _id: 'pull-ups' as never }, { $set: { name: 'Edited' } })
    const report = await seedContent(db, { reset: true })
    expect(report.library).toBe(LIBRARY.length)
    forgetContent()
    expect((await readContent()).library.find((e) => e.id === 'pull-ups')?.name).toBe('Pull-ups')
  })
})
