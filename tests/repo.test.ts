import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { must } from '#/lib/must'
import { setDbForTests } from '#/server/db'
import * as repo from '#/server/repo'

// Runs against the local MongoDB (Docker: `bun run db:up`) in its own database.
// Skips cleanly when no server is reachable.
const uri = process.env.MONGODB_TEST_URI ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const dbName = 'workout_plan_v3_test'

/** The user every test acts as, unless it is about keeping users apart. */
const U = 'user-a'

async function connect(): Promise<MongoClient | null> {
  try {
    return await MongoClient.connect(uri, { serverSelectionTimeoutMS: 2500 })
  } catch {
    return null
  }
}

const client = await connect()
if (!client) console.warn(`Skipping repo tests: no MongoDB at ${uri}. Start one with: bun run db:up`)
const suite = describe.skipIf(!client)

beforeAll(() => {
  if (client) setDbForTests(client.db(dbName))
})

afterAll(async () => {
  setDbForTests(undefined)
  if (client) {
    await client.db(dbName).dropDatabase()
    await client.close()
  }
})

beforeEach(async () => {
  if (client) await client.db(dbName).dropDatabase()
})

async function finishSession(dayId: string, fill: (w: Awaited<ReturnType<typeof repo.startWorkout>>) => Promise<void>) {
  const w = await repo.startWorkout(U, dayId)
  await fill(w)
  return repo.finishWorkout(U, w.id)
}

suite('settings', () => {
  it('returns defaults before setup', async () => {
    const s = await repo.getSettings(U)
    expect(s).toEqual({ units: 'kg', trainingAge: 'over1', setupDone: false })
  })

  it('merges partial updates', async () => {
    await repo.saveSettings(U, { units: 'lb' })
    await repo.saveSettings(U, { bodyweight: 160, setupDone: true })
    const s = await repo.getSettings(U)
    expect(s.units).toBe('lb')
    expect(s.bodyweight).toBe(160)
    expect(s.setupDone).toBe(true)
  })

  it('stamps the join date once, when setup first completes', async () => {
    expect((await repo.saveSettings(U, { units: 'kg' })).joinedAt).toBeUndefined()
    const first = await repo.saveSettings(U, { setupDone: true })
    expect(first.joinedAt).toBeDefined()
    const again = await repo.saveSettings(U, { setupDone: true, units: 'lb' })
    expect(again.joinedAt).toBe(first.joinedAt)
  })
})

suite('plan', () => {
  it('seeds the plan once and keeps edits', async () => {
    const plan = await repo.getPlan(U)
    expect(plan.days.map((d) => d.id)).toEqual(['pull-a', 'push-a', 'legs-a', 'pull-b', 'push-b', 'legs-b'])
    await repo.updateExercise(U, 'push-a', 'barbell-bench-press', { sets: 5, note: 'Pause on the chest.' })
    const again = await repo.getPlan(U)
    const bench = again.days[1].exercises[0]
    expect(bench.sets).toBe(5)
    expect(bench.note).toBe('Pause on the chest.')
  })

  it('swaps an exercise for an alternate and keeps the old one as an alternate', async () => {
    await repo.getPlan(U)
    const plan = await repo.swapExercise(U, 'push-a', 'decline-db-press', 'Weighted Dips')
    const ex = plan.days[1].exercises[2]
    expect(ex.name).toBe('Weighted Dips')
    expect(ex.id).toBe('weighted-dips')
    expect(ex.alternates).toEqual(['Decline DB Press', 'Close-Grip Bench Press', 'Weighted Push-ups'])
  })

  it('a swapped-in alternate brings its own load type and muscle', async () => {
    const plan = await repo.getPlan(U)
    const day = must(
      plan.days.find((d) => d.exercises.some((e) => e.name === 'Pull-ups')),
      'a day with Pull-ups',
    )
    const pullUps = must(
      day.exercises.find((e) => e.name === 'Pull-ups'),
      'Pull-ups',
    )
    expect(pullUps.loadType).toBe('bodyweight')
    const swapped = await repo.swapExercise(U, day.id, pullUps.id, 'Lat Pulldown')
    const pulldown = must(
      must(
        swapped.days.find((d) => d.id === day.id),
        'the day',
      ).exercises.find((e) => e.name === 'Lat Pulldown'),
      'Lat Pulldown',
    )
    expect(pulldown.loadType).toBe('weight')
    expect(pulldown.muscle).toBe('back')
    const back = await repo.swapExercise(U, day.id, pulldown.id, 'Pull-ups')
    expect(
      must(
        must(
          back.days.find((d) => d.id === day.id),
          'the day',
        ).exercises.find((e) => e.name === 'Pull-ups'),
        'Pull-ups',
      ).loadType,
    ).toBe('bodyweight')
    // A name the library does not know is guessed from the words in it.
    const guessed = await repo.swapExercise(U, day.id, 'pull-ups', 'Deficit Push-ups')
    expect(
      must(
        guessed.days.find((d) => d.id === day.id),
        'the day',
      ).exercises[0].loadType,
    ).toBe('bodyweight')
  })

  it('rejects unknown exercises', async () => {
    await expect(repo.updateExercise(U, 'push-a', 'nope', { sets: 3 })).rejects.toThrow()
  })

  it('resets to the seed', async () => {
    await repo.updateExercise(U, 'push-a', 'barbell-bench-press', { sets: 9 })
    const plan = await repo.resetPlan(U)
    expect(plan.days[1].exercises[0].sets).toBe(4)
  })

  it('adds an exercise to a day up to the cap and removes one down to the last', async () => {
    await repo.getPlan(U)
    await repo.removeExercise(U, 'pull-a', 'hammer-curl')
    const added = await repo.addExercise(U, 'pull-a', {
      name: 'Barbell Shrug',
      sets: 3,
      repMin: 10,
      repMax: 15,
      muscle: 'back',
      loadType: 'weight',
    })
    const pull = added.days[0]
    expect(pull.exercises.map((e) => e.id)).toContain('barbell-shrug')
    expect(pull.exercises.at(-1)?.name).toBe('Barbell Shrug')
    expect(pull.exercises).toHaveLength(6)
    await expect(
      repo.addExercise(U, 'pull-a', {
        name: 'One Too Many',
        sets: 3,
        repMin: 8,
        repMax: 12,
        muscle: 'back',
        loadType: 'weight',
      }),
    ).rejects.toThrow(/up to 6/)
    await expect(repo.removeExercise(U, 'pull-a', 'nope')).rejects.toThrow()
    for (const id of ['pull-ups', 'barbell-row', 'seated-cable-row', 'face-pull', 'barbell-curl']) {
      await repo.removeExercise(U, 'pull-a', id)
    }
    await expect(repo.removeExercise(U, 'pull-a', 'barbell-shrug')).rejects.toThrow(/at least one/)
  })

  it('switches to another split and resets to that one from then on', async () => {
    const plan = await repo.applySplit(U, 'ul4')
    expect(plan.days.map((d) => d.id)).toEqual(['upper-a', 'lower-a', 'upper-b', 'lower-b'])
    expect((await repo.getSettings(U)).split).toBe('ul4')
    await repo.updateExercise(U, 'upper-a', 'barbell-bench-press', { sets: 9 })
    const reset = await repo.resetPlan(U)
    expect(reset.days).toHaveLength(4)
    expect(reset.days[0].exercises[0].sets).toBe(4)
    // A fresh user with a split in settings seeds from it.
    await repo.saveSettings('user-c', { split: 'full3' })
    expect((await repo.getPlan('user-c')).days.map((d) => d.type)).toEqual(['full', 'full', 'full'])
  })

  it("keeps each split's plan: coming back finds the edits, every other split is untouched", async () => {
    await repo.saveSettings(U, { split: 'arnold6' })
    await repo.updateExercise(U, 'chest-back-a', 'barbell-bench-press', { sets: 9 })
    await repo.applySplit(U, 'ul4')
    expect((await repo.getPlan(U)).days[0].exercises[0].sets).toBe(4)
    await repo.updateExercise(U, 'upper-a', 'barbell-bench-press', { sets: 7 })
    const back = await repo.applySplit(U, 'arnold6')
    expect(back.days[0].exercises[0].sets).toBe(9)
    expect((await repo.applySplit(U, 'ul4')).days[0].exercises[0].sets).toBe(7)
    // Reset only touches the split the user is on.
    await repo.resetPlan(U)
    expect((await repo.getPlan(U)).days[0].exercises[0].sets).toBe(4)
    expect((await repo.applySplit(U, 'arnold6')).days[0].exercises[0].sets).toBe(9)
    // Picking the same split again changes nothing.
    expect((await repo.applySplit(U, 'arnold6')).days[0].exercises[0].sets).toBe(9)
  })

  it('adds, renames, moves and removes days, and keeps the last one', async () => {
    await repo.applySplit(U, 'ppl3')
    let plan = await repo.addDay(U, 'arms')
    expect(plan.days.map((d) => d.name)).toEqual(['Pull A', 'Push A', 'Legs A', 'Arms'])
    expect(plan.days[3].exercises.map((e) => e.name)).toContain('Barbell Curl')
    plan = await repo.updateDay(U, 'arms', { name: 'Arm day', type: 'upper' })
    expect(plan.days[3]).toMatchObject({ name: 'Arm day', type: 'upper' })
    plan = await repo.moveDay(U, 'arms', 'up')
    expect(plan.days.map((d) => d.id)).toEqual(['pull-a', 'push-a', 'arms', 'legs-a'])
    plan = await repo.moveDay(U, 'pull-a', 'up')
    expect(plan.days[0].id).toBe('pull-a')
    plan = await repo.removeDay(U, 'arms')
    expect(plan.days).toHaveLength(3)
    await repo.removeDay(U, 'push-a')
    await repo.removeDay(U, 'legs-a')
    await expect(repo.removeDay(U, 'pull-a')).rejects.toThrow(/at least one/)
    await expect(repo.updateDay(U, 'nope', { name: 'x' })).rejects.toThrow()
    // On a weekday schedule a new day gets a weekday of its own.
    await repo.setSchedule(U, 'weekday')
    plan = await repo.addDay(U, 'legs')
    expect(plan.days.every((d) => d.weekday !== undefined)).toBe(true)
  })

  it('builds a plan of your own in the custom slot', async () => {
    await expect(repo.applySplit(U, 'custom')).rejects.toThrow(/No plan of your own/)
    const plan = await repo.createCustomPlan(U, ['upper', 'lower', 'upper', 'lower'])
    expect(plan.days.map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect((await repo.getSettings(U)).split).toBe('custom')
    expect(await repo.planSlots(U)).toEqual([{ split: 'custom', days: 4 }])
    // Away to a template and back by name, with the plan as it was.
    await repo.applySplit(U, 'ul4')
    expect((await repo.applySplit(U, 'custom')).days.map((d) => d.name)).toEqual([
      'Upper A',
      'Lower A',
      'Upper B',
      'Lower B',
    ])
    expect((await repo.planSlots(U)).map((s) => s.split).sort()).toEqual(['custom', 'ul4'])
    // A template keeps its own plan beside it.
    expect((await repo.applySplit(U, 'ppl6')).days).toHaveLength(6)
    await repo.saveSettings(U, { split: 'custom' })
    expect((await repo.getPlan(U)).days).toHaveLength(4)
  })

  it('gives an uploaded plan its own slot and has no template to reset it to', async () => {
    const days = (await repo.getPlan(U)).days.slice(0, 2)
    await repo.replacePlan(U, days)
    expect((await repo.getSettings(U)).split).toBe('custom')
    expect((await repo.getPlan(U)).days).toHaveLength(2)
    await expect(repo.resetPlan(U)).rejects.toThrow(/no template/)
    // Away and back: the uploaded days are still there, and the default split kept its plan.
    expect((await repo.applySplit(U, 'ppl6')).days).toHaveLength(6)
    await repo.saveSettings(U, { split: 'custom' })
    expect((await repo.getPlan(U)).days).toHaveLength(2)
  })

  it('moves a plan stored the old way into the slot for the current split, once', async () => {
    const db = must(client, 'the test database').db(dbName)
    await repo.saveSettings(U, { split: 'ul4' })
    const days = [{ id: 'd', name: 'D', type: 'full', exercises: [] }]
    await db.collection('plan').insertOne({ _id: U as never, days, updatedAt: 'x' })
    expect((await repo.getPlan(U)).days).toEqual(days)
    expect(await db.collection('plan').findOne({ _id: U as never })).toBeNull()
    expect(await db.collection('plans').countDocuments({ userId: U, split: 'ul4' })).toBe(1)
  })
})

suite('workouts', () => {
  it('starts a workout with planned sets and no history', async () => {
    const w = await repo.startWorkout(U, 'pull-a')
    expect(w.status).toBe('in_progress')
    expect(w.entries).toHaveLength(6)
    expect(w.entries[0].sets).toHaveLength(4)
    expect(w.entries[0].hint).toBeUndefined()
    expect(await repo.getActiveWorkout(U)).not.toBeNull()
  })

  it('caps sets at three for beginners', async () => {
    await repo.saveSettings(U, { trainingAge: 'under1' })
    const w = await repo.startWorkout(U, 'pull-a')
    expect(w.entries[0].sets).toHaveLength(3)
    expect(w.entries[2].sets).toHaveLength(3)
  })

  it('replaces an unfinished workout when a new one starts', async () => {
    const first = await repo.startWorkout(U, 'pull-a')
    const second = await repo.startWorkout(U, 'push-a')
    const active = await repo.getActiveWorkout(U)
    expect(active?.id).toBe(second.id)
    expect(active?.id).not.toBe(first.id)
  })

  it('deletes a workout finished with nothing checked', async () => {
    const w = await repo.startWorkout(U, 'pull-a')
    const res = await repo.finishWorkout(U, w.id)
    expect(res.finished).toBe(false)
    expect(await repo.getActiveWorkout(U)).toBeNull()
    expect(await repo.listWorkouts(U)).toHaveLength(0)
  })

  it('saves sets, finishes, and advances to the next day', async () => {
    await finishSession('pull-a', async (w) => {
      await repo.saveEntrySets(U, w.id, 'barbell-row', [
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 10, done: true },
      ])
    })
    const today = await repo.getTodayData(U)
    expect(today.active).toBeNull()
    expect(today.nextDayId).toBe('push-a')
    expect(today.lastFinished?.dayName).toBe('Pull A')
    const done = await repo.listWorkouts(U)
    expect(done).toHaveLength(1)
    expect(done[0].status).toBe('done')
  })

  it('prefills the next session from the last one and suggests the bump', async () => {
    await finishSession('pull-a', async (w) => {
      await repo.saveEntrySets(U, w.id, 'barbell-row', [
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 10, done: true },
      ])
      await repo.saveEntrySets(U, w.id, 'pull-ups', [
        { reps: 8, done: true },
        { reps: 7, done: true },
        { reps: 6, done: true },
        { reps: 6, done: true },
      ])
    })
    const next = await repo.startWorkout(U, 'pull-a')
    const row = must(
      next.entries.find((e) => e.exerciseId === 'barbell-row'),
      'the Barbell Row entry',
    )
    // Targets sit beside blank sets: nothing is logged until a set is marked done.
    expect(row.sets).toEqual([{ done: false }, { done: false }, { done: false }, { done: false }])
    // A barbell row steps by two plates: 5 kg with the common 2.5 kg plate.
    expect(row.suggested?.map((s) => s.weight)).toEqual([65, 65, 65, 65])
    expect(row.hint).toContain('Try 65 kg')
    const pullups = must(
      next.entries.find((e) => e.exerciseId === 'pull-ups'),
      'the Pull-ups entry',
    )
    expect(pullups.suggested?.map((s) => s.reps)).toEqual([8, 7, 6, 6])
    expect(pullups.hint).toContain('Add a rep')
  })

  it('learns from the same plan day first, and from any day when that day has no history', async () => {
    // Pull A and Push A both hold a barbell exercise under the same id only in a custom plan; make one.
    const plan = await repo.getPlan(U)
    const row = must(
      plan.days[0].exercises.find((e) => e.id === 'barbell-row'),
      'Barbell Row',
    )
    const days = [
      { ...plan.days[0], id: 'heavy', name: 'Heavy', exercises: [{ ...row, repMin: 4, repMax: 6 }] },
      { ...plan.days[0], id: 'light', name: 'Light', exercises: [{ ...row, repMin: 10, repMax: 15 }] },
    ]
    await repo.replacePlan(U, days)
    await finishSession('heavy', async (w) => {
      await repo.saveEntrySets(U, w.id, 'barbell-row', [{ weight: 80, reps: 5, done: true }])
    })
    // Light has no history yet: it borrows Heavy's last session.
    const light = await repo.startWorkout(U, 'light')
    expect(light.entries[0].suggested?.[0].weight).toBe(80)
    await repo.saveEntrySets(U, light.id, 'barbell-row', [{ weight: 50, reps: 15, done: true }])
    await repo.finishWorkout(U, light.id)
    // Now each day follows its own line: Heavy stays at 80, Light moves up from 50.
    expect((await repo.startWorkout(U, 'heavy')).entries[0].suggested?.[0].weight).toBe(80)
    expect((await repo.startWorkout(U, 'light')).entries[0].suggested?.[0].weight).toBe(55)
  })

  it('discards an in-progress workout', async () => {
    const w = await repo.startWorkout(U, 'legs-a')
    await repo.discardWorkout(U, w.id)
    expect(await repo.getActiveWorkout(U)).toBeNull()
  })

  it('stores the finish check-in', async () => {
    const w = await repo.startWorkout(U, 'pull-a')
    await repo.saveEntrySets(U, w.id, 'pull-ups', [{ reps: 8, done: true }])
    await repo.finishWorkout(U, w.id, { effort: 3, note: 'Grip gave out' })
    const [done] = await repo.listWorkouts(U)
    expect(done.effort).toBe(3)
    expect(done.note).toBe('Grip gave out')
  })

  it('edits sets of a finished session and ignores unknown exercises', async () => {
    const w = await repo.startWorkout(U, 'pull-a')
    await repo.saveEntrySets(U, w.id, 'pull-ups', [{ reps: 8, done: true }])
    await repo.finishWorkout(U, w.id)
    const updated = await repo.updateWorkoutSets(U, w.id, [
      { exerciseId: 'pull-ups', sets: [{ reps: 9, done: true }] },
      { exerciseId: 'not-in-plan', sets: [{ reps: 99, done: true }] },
    ])
    expect(updated.entries.find((e) => e.exerciseId === 'pull-ups')?.sets).toEqual([{ reps: 9, done: true }])
    expect(updated.entries.some((e) => e.exerciseId === 'not-in-plan')).toBe(false)
    const [stored] = await repo.listWorkouts(U)
    expect(stored.entries.find((e) => e.exerciseId === 'pull-ups')?.sets[0].reps).toBe(9)
  })

  it('deletes a finished session', async () => {
    const w = await repo.startWorkout(U, 'pull-a')
    await repo.saveEntrySets(U, w.id, 'pull-ups', [{ reps: 8, done: true }])
    await repo.finishWorkout(U, w.id)
    await repo.deleteWorkout(U, w.id)
    expect(await repo.listWorkouts(U)).toHaveLength(0)
    const history = await repo.getHistoryData(U)
    expect(history.workouts).toEqual([])
  })

  it('tells today when the last weigh-in and tape were', async () => {
    const before = await repo.getTodayData(U)
    expect(before.lastBodyweightAt).toBeNull()
    expect(before.lastMeasurementAt).toBeNull()
    await repo.logBodyweight(U, 72)
    await repo.logMeasurement(U, { waist: 80 })
    const after = await repo.getTodayData(U)
    expect(after.lastBodyweightAt).not.toBeNull()
    expect(after.lastMeasurementAt).not.toBeNull()
  })
})

suite('body logs', () => {
  it('stores bodyweight by day and keeps settings in sync', async () => {
    await repo.logBodyweight(U, 72.4, '2026-10-09')
    const second = await repo.logBodyweight(U, 72.8, '2026-10-10')
    expect(second.replaced).toBe(false)
    const logs = await repo.listBodyweights(U)
    expect(logs.map((l) => l.weight)).toEqual([72.4, 72.8])
    expect((await repo.getSettings(U)).bodyweight).toBe(72.8)
  })

  it('keeps a backfilled weigh-in on its own day and leaves the current weight alone', async () => {
    await repo.logBodyweight(U, 72, '2026-10-10', new Date(2026, 9, 10, 8))
    const missed = new Date(2026, 9, 3, 12)
    const log = await repo.logBodyweight(U, 70, '2026-10-03', missed)
    expect(log.date).toBe(missed.toISOString())
    expect(log.replaced).toBe(false)
    expect((await repo.listBodyweights(U)).map((l) => l.weight)).toEqual([70, 72])
    expect((await repo.getSettings(U)).bodyweight).toBe(72)
  })

  it('replaces a weigh-in logged twice on the same day', async () => {
    await repo.logBodyweight(U, 72.4, '2026-10-10')
    const again = await repo.logBodyweight(U, 73, '2026-10-10')
    expect(again.replaced).toBe(true)
    const logs = await repo.listBodyweights(U)
    expect(logs).toHaveLength(1)
    expect(logs[0].weight).toBe(73)
  })

  it('edits and deletes a weigh-in', async () => {
    const log = await repo.logBodyweight(U, 72.4, '2026-10-10')
    await repo.updateBodyweight(U, log.id, 71.9)
    expect((await repo.listBodyweights(U))[0].weight).toBe(71.9)
    expect((await repo.getSettings(U)).bodyweight).toBe(71.9)
    await repo.deleteBodyweight(U, log.id)
    expect(await repo.listBodyweights(U)).toEqual([])
    await expect(repo.updateBodyweight(U, log.id, 70)).rejects.toThrow()
  })

  it('stores measurements and merges a second entry on the same day', async () => {
    await repo.logMeasurement(U, { arm: 36, chest: 98 }, '2026-10-10')
    const again = await repo.logMeasurement(U, { waist: 80 }, '2026-10-10')
    expect(again.replaced).toBe(true)
    const logs = await repo.listMeasurements(U)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ arm: 36, chest: 98, waist: 80 })
  })

  it('edits and deletes a tape entry', async () => {
    const log = await repo.logMeasurement(U, { arm: 36, chest: 98, waist: 80 }, '2026-10-10')
    await repo.updateMeasurement(U, log.id, { waist: 79 })
    expect((await repo.listMeasurements(U))[0]).toMatchObject({ arm: 36, waist: 79 })
    await repo.deleteMeasurement(U, log.id)
    expect(await repo.listMeasurements(U)).toEqual([])
  })

  it('bundles everything the stats screen needs', async () => {
    const data = await repo.getStatsData(U)
    expect(data.plan.days).toHaveLength(6)
    expect(data.workouts).toEqual([])
    expect(data.bodyweights).toEqual([])
  })
})

suite('users', () => {
  it('keeps every user to their own data', async () => {
    await repo.saveSettings(U, { units: 'lb', setupDone: true })
    await repo.updateExercise(U, 'push-a', 'barbell-bench-press', { sets: 9 })
    const weight = await repo.logBodyweight(U, 180, '2026-10-10')
    const tape = await repo.logMeasurement(U, { waist: 80 }, '2026-10-10')
    const w = await repo.startWorkout(U, 'pull-a')
    await repo.saveEntrySets(U, w.id, 'pull-ups', [{ reps: 8, done: true }])
    await repo.finishWorkout(U, w.id)

    const other = 'user-b'
    expect(await repo.getSettings(other)).toEqual({ units: 'kg', trainingAge: 'over1', setupDone: false })
    expect((await repo.getPlan(other)).days[1].exercises[0].sets).toBe(4)
    expect(await repo.listBodyweights(other)).toEqual([])
    expect(await repo.listMeasurements(other)).toEqual([])
    expect(await repo.listWorkouts(other)).toEqual([])
    expect(await repo.getActiveWorkout(other)).toBeNull()
    expect((await repo.getStatsData(other)).workouts).toEqual([])

    // Another user's ids are not reachable, even when guessed.
    await expect(repo.updateBodyweight(other, weight.id, 1)).rejects.toThrow()
    await expect(repo.updateMeasurement(other, tape.id, { waist: 1 })).rejects.toThrow()
    await expect(repo.saveEntrySets(other, w.id, 'pull-ups', [{ reps: 1, done: true }])).rejects.toThrow()
    await expect(repo.updateWorkoutSets(other, w.id, [])).rejects.toThrow()
    await repo.deleteWorkout(other, w.id)
    expect(await repo.listWorkouts(U)).toHaveLength(1)
    await expect(repo.updateBodyweight(other, 'not-an-id', 1)).rejects.toThrow()
  })

  it('start fresh wipes this user only and leaves the account usable', async () => {
    await repo.saveSettings(U, { setupDone: true, units: 'lb' })
    const w = await repo.startWorkout(U, 'pull-a')
    await repo.saveEntrySets(U, w.id, 'pull-ups', [{ reps: 8, done: true }])
    await repo.finishWorkout(U, w.id)
    await repo.logBodyweight(U, 72, '2026-10-10')
    await repo.logMeasurement(U, { waist: 80 }, '2026-10-10')
    await repo.saveSettings('user-b', { units: 'lb' })

    await repo.startFresh(U)
    expect(await repo.getSettings(U)).toEqual({ units: 'kg', trainingAge: 'over1', setupDone: false })
    expect(await repo.listWorkouts(U)).toEqual([])
    expect(await repo.listBodyweights(U)).toEqual([])
    expect(await repo.listMeasurements(U)).toEqual([])
    expect((await repo.getPlan(U)).days).toHaveLength(6)
    expect((await repo.getSettings('user-b')).units).toBe('lb')
  })

  it('hands the pre-account data to the first user only', async () => {
    const db = must(client, 'the test database').db(dbName)
    await db
      .collection('settings')
      .insertOne({ _id: 'settings' as never, units: 'lb', trainingAge: 'over1', setupDone: true })
    await db.collection('plan').insertOne({ _id: 'plan' as never, days: [], updatedAt: 'x' })
    await db.collection('workouts').insertOne({ dayId: 'pull-a', status: 'done', entries: [] })
    await db.collection('bodyweights').insertOne({ date: 'x', weight: 70 })
    await db.collection('measurements').insertOne({ date: 'x', waist: 80 })
    await db.collection('user').insertOne({ email: 'first@example.com' })

    await repo.claimLegacyData('first')
    expect((await repo.getSettings('first')).units).toBe('lb')
    expect(await db.collection('settings').findOne({ _id: 'settings' as never })).toBeNull()
    expect(await db.collection('plan').findOne({ _id: 'plan' as never })).toBeNull()
    expect(await db.collection('plans').countDocuments({ userId: 'first' })).toBe(1)
    expect(await db.collection('workouts').countDocuments({ userId: 'first' })).toBe(1)
    expect(await db.collection('bodyweights').countDocuments({ userId: 'first' })).toBe(1)
    expect(await db.collection('measurements').countDocuments({ userId: 'first' })).toBe(1)

    // A second account finds nothing to claim.
    await db.collection('workouts').insertOne({ dayId: 'push-a', status: 'done', entries: [] })
    await db.collection('user').insertOne({ email: 'second@example.com' })
    await repo.claimLegacyData('second')
    expect(await db.collection('workouts').countDocuments({ userId: 'second' })).toBe(0)
  })
})
