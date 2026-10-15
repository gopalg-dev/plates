import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LIBRARY } from '#/lib/library-data'
import { must } from '#/lib/must'
import { BUNDLED_SPLITS } from '#/lib/splits'
import { cuesOf, forgetContent, readContent, rowsOf, seedContent, splitTemplate } from '#/server/content'
import { setDbForTests } from '#/server/db'

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
  if (client) setDbForTests(client.db(dbName))
})
afterAll(async () => {
  setDbForTests(undefined)
  await client?.close()
})
beforeEach(async () => {
  if (client) await client.db(dbName).dropDatabase()
  forgetContent()
})

suite('content', () => {
  it('seeds an empty database from the bundle and reads it back', async () => {
    const report = await seedContent(must(client, 'the test database').db(dbName))
    expect(report).toEqual({ library: LIBRARY.length, splits: BUNDLED_SPLITS.length, filled: 0 })
    const content = await readContent()
    expect(content.library).toHaveLength(LIBRARY.length)
    expect(content.splits.map((s) => s.id)).toEqual(BUNDLED_SPLITS.map((s) => s.id))
    expect(content.splits[0].days[0].exercises.length).toBeGreaterThan(0)
  })

  it('hands the app rows without the cues, and one entry’s cues on request', async () => {
    await seedContent(must(client, 'the test database').db(dbName))
    const rows = rowsOf(await readContent())
    expect(rows.library).toHaveLength(LIBRARY.length)
    expect(rows.library.some((e) => 'cues' in e)).toBe(false)
    expect(rows.library.find((e) => e.id === 'barbell-squat')?.images).toHaveLength(2)
    expect(await cuesOf('barbell-squat')).toEqual(
      must(
        LIBRARY.find((e) => e.id === 'barbell-squat'),
        'the squat',
      ).cues,
    )
    expect(await cuesOf('nope')).toBeNull()
  })

  it('reads a fresh database by seeding it first', async () => {
    const content = await readContent()
    expect(content.splits).toHaveLength(BUNDLED_SPLITS.length)
    expect((await splitTemplate('ul4')).length).toBe(4)
    await expect(splitTemplate('nope')).rejects.toThrow('Unknown split')
  })

  it('keeps edits made in the database and only adds what is missing', async () => {
    const db = must(client, 'the test database').db(dbName)
    await seedContent(db)
    await db.collection('library').updateOne({ _id: 'pull-ups' as never }, { $set: { name: 'Chin-ups, wide' } })
    await db.collection('library').deleteOne({ _id: 'plank' as never })
    const again = await seedContent(db)
    expect(again).toEqual({ library: 1, splits: 0, filled: 0 })
    forgetContent()
    const { library } = await readContent()
    expect(library.find((e) => e.id === 'pull-ups')?.name).toBe('Chin-ups, wide')
    expect(library.find((e) => e.id === 'plank')?.name).toBe('Plank')
  })

  it('fills in the sets and range on entries seeded before the bundle had them, and keeps the rest', async () => {
    const db = must(client, 'the test database').db(dbName)
    await seedContent(db)
    const library = db.collection('library')
    await library.updateOne(
      { _id: 'hack-squat' as never },
      { $set: { name: 'Hack squat, narrow' }, $unset: { sets: '', repMin: '', repMax: '' } },
    )
    await library.updateOne({ _id: 'leg-press' as never }, { $set: { repMax: 20 } })
    // A read fills the gap on its own, as the first request after a deploy would.
    forgetContent()
    const { library: read } = await readContent()
    expect(read.find((e) => e.id === 'hack-squat')).toMatchObject({
      name: 'Hack squat, narrow',
      sets: 3,
      repMin: 8,
      repMax: 12,
    })
    // An entry that has the fields keeps its own numbers.
    expect(read.find((e) => e.id === 'leg-press')?.repMax).toBe(20)
    expect((await seedContent(db)).filled).toBe(0)
  })

  it('restores the full cues on entries whose cues the first import cut short, and keeps edited ones', async () => {
    const db = must(client, 'the test database').db(dbName)
    await seedContent(db)
    const library = db.collection('library')
    const bundled = must(
      LIBRARY.find((e) => e.id === 'barbell-squat'),
      'the bundled squat',
    )
    const cut = bundled.cues.slice(0, 3).map((c, i) => (i === 0 ? `${c.slice(0, 40)}…` : c))
    await library.updateOne({ _id: 'barbell-squat' as never }, { $set: { cues: cut, name: 'Back squat' } })
    await library.updateOne({ _id: 'plank' as never }, { $set: { cues: ['Hold it.'] } })
    forgetContent()
    const { library: read } = await readContent()
    expect(read.find((e) => e.id === 'barbell-squat')).toMatchObject({ name: 'Back squat', cues: bundled.cues })
    // A full cue list edited in the database is its editor's, cut short or not in the bundle's eyes.
    expect(read.find((e) => e.id === 'plank')?.cues).toEqual(['Hold it.'])
    expect((await seedContent(db)).filled).toBe(0)
  })

  it('gives an entry seeded with the single start picture the pair, and takes the old field off', async () => {
    const db = must(client, 'the test database').db(dbName)
    await seedContent(db)
    const library = db.collection('library')
    await library.updateOne(
      { _id: 'pull-ups' as never },
      { $set: { image: 'Pullups/0.jpg', name: 'Wide pull-ups' }, $unset: { images: '' } },
    )
    forgetContent()
    const { library: read } = await readContent()
    expect(read.find((e) => e.id === 'pull-ups')).toMatchObject({
      name: 'Wide pull-ups',
      images: ['Pullups/0.jpg', 'Pullups/1.jpg'],
    })
    expect(await library.findOne({ _id: 'pull-ups' as never, image: { $exists: true } })).toBeNull()
    expect((await seedContent(db)).filled).toBe(0)
  })

  it('adds entries a newer bundle brings on a read, and leaves the rest as they are', async () => {
    const db = must(client, 'the test database').db(dbName)
    await seedContent(db)
    await db.collection('library').deleteOne({ _id: 'goblet-squat' as never })
    await db.collection('library').updateOne({ _id: 'pull-ups' as never }, { $set: { name: 'Wide pull-ups' } })
    forgetContent()
    const { library } = await readContent()
    expect(library.find((e) => e.id === 'goblet-squat')?.name).toBe('Goblet Squat')
    expect(library.find((e) => e.id === 'pull-ups')?.name).toBe('Wide pull-ups')
  })

  it('leaves an entry added in the database alone, and does not keep trying to fill it', async () => {
    const db = must(client, 'the test database').db(dbName)
    await seedContent(db)
    const plank = must(await db.collection('library').findOne({ _id: 'plank' as never }), 'the plank')
    const { _id: _p, sets: _s, repMin: _min, repMax: _max, ...rest } = plank
    await db.collection('library').insertOne({ ...rest, _id: 'my-hold' as never, name: 'My hold' })
    forgetContent()
    const first = await readContent()
    expect(first.library.find((e) => e.id === 'my-hold')?.sets).toBeUndefined()
    // A second read within the cache window, and a fresh one after it, both come from the database as it is.
    forgetContent()
    const seeded = await seedContent(db)
    expect(seeded).toEqual({ library: 0, splits: 0, filled: 0 })
    expect((await readContent()).library.find((e) => e.id === 'my-hold')?.name).toBe('My hold')
  })

  it('resets to the bundle on request', async () => {
    const db = must(client, 'the test database').db(dbName)
    await seedContent(db)
    await db.collection('library').updateOne({ _id: 'pull-ups' as never }, { $set: { name: 'Edited' } })
    const report = await seedContent(db, { reset: true })
    expect(report.library).toBe(LIBRARY.length)
    forgetContent()
    expect((await readContent()).library.find((e) => e.id === 'pull-ups')?.name).toBe('Pull-ups')
  })
})
