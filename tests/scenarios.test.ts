import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { liftsFrom } from '#/components/app/stats-lifts'
import { buildReport, finishedPeriod } from '#/lib/logic/report'
import { activeMinutes } from '#/lib/logic/session-time'
import { plannedVolumeByMuscle, volumeByMuscleInWeek, weekTotals } from '#/lib/logic/stats'
import { liftTrend } from '#/lib/logic/trend'
import { must } from '#/lib/must'
import { setDbForTests } from '#/server/db'
import * as repo from '#/server/repo'

/*
 * Whole stories played through the server code against the local MongoDB (Docker: `bun run db:up`), the way a
 * lifter would live them over days: a split started empty and filled by hand, then trained, with the next session's
 * targets, Stats and the report read after each step; and a session whose machine is taken, swapped for today or
 * for good, with the history each lift keeps. Skips cleanly when no server is reachable.
 */

const uri = process.env.MONGODB_TEST_URI ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const dbName = 'workout_plan_v3_scenarios'
const U = 'lifter'

async function connect(): Promise<MongoClient | null> {
  try {
    return await MongoClient.connect(uri, { serverSelectionTimeoutMS: 2500 })
  } catch {
    return null
  }
}

const client = await connect()
if (!client) console.warn(`Skipping scenario tests: no MongoDB at ${uri}. Start one with: bun run db:up`)
const suite = describe.skipIf(!client)
const db = () => must(client, 'the test database').db(dbName)

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

const set = (weight: number, reps: number, left?: number) => ({
  weight,
  reps,
  done: true,
  ...(left !== undefined ? { left } : {}),
})
const line = (name: string, sets: number, repMin: number, repMax: number, muscle: 'back' | 'biceps') => ({
  name,
  sets,
  repMin,
  repMax,
  muscle,
  loadType: 'weight' as const,
})

/** Moves every finished session of the user `days` back, as if it had happened that many days ago. */
async function backdate(days: number) {
  const workouts = db().collection<{ _id: unknown; startedAt: string; finishedAt?: string }>('workouts')
  const ms = days * 86_400_000
  for (const w of await workouts.find({ userId: U } as never).toArray()) {
    await workouts.updateOne({ _id: w._id } as never, {
      $set: {
        startedAt: new Date(new Date(w.startedAt).getTime() - ms).toISOString(),
        ...(w.finishedAt ? { finishedAt: new Date(new Date(w.finishedAt).getTime() - ms).toISOString() } : {}),
      },
    })
  }
}

suite('a split started empty, filled by hand, and trained', () => {
  it('refuses to start an empty day, then builds targets, stats and a report from the lifts added', async () => {
    await repo.saveSettings(U, { setupDone: true })
    const plan = await repo.applySplit(U, 'ppl3', { empty: true })
    expect(plan.days.map((d) => [d.id, d.exercises.length])).toEqual([
      ['pull-a', 0],
      ['push-a', 0],
      ['legs-a', 0],
    ])

    // Today with nothing in the plan: no session can start, nothing crashes, every target is zero.
    const today = await repo.getTodayData(U)
    expect(today.nextDayId).toBe('pull-a')
    expect(today.active).toBeNull()
    await expect(repo.startWorkout(U, 'pull-a')).rejects.toThrow(/no lifts yet/)
    expect(Object.values(plannedVolumeByMuscle(today.plan, 'over1')).every((n) => n === 0)).toBe(true)

    // The lifter fills Pull A by hand.
    await repo.addExercise(U, 'pull-a', line('Lat Pulldown', 3, 8, 12, 'back'))
    await repo.addExercise(U, 'pull-a', line('Seated Cable Row', 3, 8, 12, 'back'))
    const filled = await repo.addExercise(U, 'pull-a', line('Hammer Curl', 3, 10, 12, 'biceps'))
    expect(filled.days[0].exercises.map((e) => e.id)).toEqual(['lat-pulldown', 'seated-cable-row', 'hammer-curl'])
    expect(plannedVolumeByMuscle(filled, 'over1')).toMatchObject({ back: 6, biceps: 3, chest: 0 })

    // Session 1: blank sets, no targets yet, the library's equipment known for the step.
    const w1 = await repo.startWorkout(U, 'pull-a')
    expect(w1.entries.map((e) => e.name)).toEqual(['Lat Pulldown', 'Seated Cable Row', 'Hammer Curl'])
    for (const e of w1.entries) {
      expect(e.sets).toEqual([{ done: false }, { done: false }, { done: false }])
      expect(e.suggested).toBeUndefined()
      expect(e.hint).toBeUndefined()
    }
    expect(w1.entries[0].equipment).toBe('cable')
    expect(w1.entries[2].equipment).toBe('dumbbell')
    await repo.saveEntrySets(U, w1.id, 'lat-pulldown', [set(50, 12), set(50, 12), set(50, 12, 1)])
    await repo.saveEntrySets(U, w1.id, 'seated-cable-row', [set(45, 10), set(45, 10), set(45, 9, 0)])
    await repo.saveEntrySets(U, w1.id, 'hammer-curl', [set(12, 12), set(12, 12), set(12, 12, 3)])
    const f1 = await repo.finishWorkout(U, w1.id, { effort: 2 })
    expect(f1.finished).toBe(true)
    expect(f1.summary?.week).toEqual({ done: 1, planned: 3 })
    expect(f1.summary?.lines.map((l) => [l.name, l.best, l.pr])).toEqual([
      ['Lat Pulldown', '50 kg × 12', false],
      ['Seated Cable Row', '45 kg × 10', false],
      ['Hammer Curl', '12 kg × 12', false],
    ])

    // Stats after one session: the week's totals, the muscles against the plan, every lift new.
    const now = new Date()
    let stats = await repo.getStatsData(U)
    expect(weekTotals(stats.workouts, now)).toMatchObject({ sets: 9, lifted: 50 * 36 + 45 * 29 + 12 * 36 })
    expect(volumeByMuscleInWeek(stats.workouts, now)).toMatchObject({ back: 6, biceps: 3 })
    const lifts = liftsFrom(stats.plan, stats.workouts)
    expect(lifts.map((l) => l.ex.id)).toEqual(['lat-pulldown', 'seated-cable-row', 'hammer-curl'])
    expect(lifts.map((l) => liftTrend(l.weeks, now))).toEqual(['new', 'new', 'new'])

    // Session 2: reps first, then weight. Every pulldown set hit the top, so each goes up a stack step (2.5 kg)
    // and back to the bottom of the range; the row sets aim one rep higher; the curl had reps to spare.
    const w2 = await repo.startWorkout(U, 'pull-a')
    const by = (w: typeof w2, id: string) =>
      must(
        w.entries.find((e) => e.exerciseId === id),
        id,
      )
    expect(by(w2, 'lat-pulldown').suggested).toEqual([
      { weight: 52.5, reps: 8 },
      { weight: 52.5, reps: 8 },
      { weight: 52.5, reps: 8 },
    ])
    expect(by(w2, 'lat-pulldown').hint).toBe('Last time 50 kg × 12, 12, 12. Try 52.5 kg.')
    expect(by(w2, 'seated-cable-row').suggested).toEqual([
      { weight: 45, reps: 11 },
      { weight: 45, reps: 11 },
      { weight: 45, reps: 10 },
    ])
    expect(by(w2, 'seated-cable-row').hint).toBe('Last time 45 kg × 10, 10, 9. Aim for 11, 11, 10.')
    expect(by(w2, 'hammer-curl').suggested?.map((s) => s.weight)).toEqual([14.5, 14.5, 14.5])
    expect(by(w2, 'hammer-curl').hint).toBe('Last time 12 kg × 12, 12, 12. Reps to spare; try 14.5 kg.')
    await repo.saveEntrySets(U, w2.id, 'lat-pulldown', [set(52.5, 11), set(52.5, 10), set(52.5, 9, 0)])
    await repo.saveEntrySets(U, w2.id, 'seated-cable-row', [set(45, 11), set(45, 11), set(45, 10, 1)])
    await repo.saveEntrySets(U, w2.id, 'hammer-curl', [set(14.5, 10), set(14.5, 10), set(14.5, 10, 1)])
    const f2 = await repo.finishWorkout(U, w2.id, { effort: 3 })
    const pulldown = must(
      f2.summary?.lines.find((l) => l.name === 'Lat Pulldown'),
      'the pulldown line',
    )
    expect(pulldown).toMatchObject({ best: '52.5 kg × 11', pr: true, change: '+2.5 kg' })
    expect(f2.summary?.week).toEqual({ done: 2, planned: 3 })

    // Session 3: the pulldown sets stopped short of the top, so the weight holds and each set aims one more rep.
    const w3 = await repo.startWorkout(U, 'pull-a')
    expect(by(w3, 'lat-pulldown').suggested).toEqual([
      { weight: 52.5, reps: 12 },
      { weight: 52.5, reps: 11 },
      { weight: 52.5, reps: 10 },
    ])
    expect(by(w3, 'lat-pulldown').hint).toBe('Last time 52.5 kg × 11, 10, 9. Aim for 12, 11, 10.')
    // The curl went up and held its reps: a set at 10 of 10-12 aims for 11.
    expect(by(w3, 'hammer-curl').suggested?.[0]).toEqual({ weight: 14.5, reps: 11 })
    await repo.saveEntrySets(U, w3.id, 'lat-pulldown', [set(52.5, 12), set(52.5, 11), set(52.5, 10, 1)])
    await repo.finishWorkout(U, w3.id, { effort: 2 })

    // Stats now: three sessions, the pulldown climbing week on week once the sessions sit in earlier weeks.
    stats = await repo.getStatsData(U)
    expect(weekTotals(stats.workouts, now).sets).toBe(9 + 9 + 3)
    expect(liftsFrom(stats.plan, stats.workouts)[0].weeks[0].weight).toBe(52.5)

    // The report of last week, once these sessions were last week's: all three planned sessions done, every
    // muscle on target, and the pulldown among the bests.
    await backdate(7)
    const joined = new Date(now.getTime() - 14 * 86_400_000).toISOString()
    await db()
      .collection('settings')
      .updateOne({ _id: U } as never, { $set: { joinedAt: joined } })
    stats = await repo.getStatsData(U)
    const report = buildReport(stats, finishedPeriod('week', now, now))
    expect(report.enough).toBe(true)
    expect(report.sessions).toEqual({ done: 3, prev: 0, planned: 3 })
    expect(report.sets.now).toBe(21)
    expect(report.attention.under).toEqual([])
    expect(report.bests.map((b) => b.name)).toContain('Lat Pulldown')
    expect(report.muscles.find((m) => m.muscle === 'back')).toMatchObject({ perWeek: 15, target: 6 })

    // Today again: the next session in the rolling order is Push A, still empty, so it cannot start.
    const again = await repo.getTodayData(U)
    expect(again.nextDayId).toBe('push-a')
    await expect(repo.startWorkout(U, 'push-a')).rejects.toThrow(/Push A has no lifts yet/)
  })
})

suite('a machine is taken mid-session', () => {
  it('swaps for good with the ticked sets kept, then for today only, and each lift keeps its own history', async () => {
    await repo.saveSettings(U, { setupDone: true })
    await repo.getPlan(U)

    // Session 1, Legs A: two leg press sets done, then the machine is taken. Hack Squat takes the set that was
    // left, with the library's range, and goes on the plan too.
    const w1 = await repo.startWorkout(U, 'legs-a')
    await repo.saveEntrySets(U, w1.id, 'leg-press', [set(100, 15), set(100, 15), { done: false }])
    const swapped = await repo.swapSessionExercise(U, w1.id, 'leg-press', 'Hack Squat', true)
    expect(swapped.entries.map((e) => e.name).slice(2, 4)).toEqual(['Leg Press', 'Hack Squat'])
    const hack = must(
      swapped.entries.find((e) => e.exerciseId === 'hack-squat'),
      'the hack squat entry',
    )
    expect(hack).toMatchObject({ repMin: 8, repMax: 12, plateLoaded: true, equipment: 'machine' })
    expect(hack.sets).toEqual([{ done: false }])
    expect(hack.suggested).toBeUndefined()
    await repo.saveEntrySets(U, w1.id, 'hack-squat', [set(80, 10, 1)])
    const f1 = await repo.finishWorkout(U, w1.id, { effort: 2 })
    expect(f1.summary?.lines.map((l) => [l.name, l.best])).toEqual(
      expect.arrayContaining([
        ['Leg Press', '100 kg × 15'],
        ['Hack Squat', '80 kg × 10'],
      ]),
    )
    const legs = (await repo.getPlan(U)).days[2].exercises
    expect(legs.map((e) => e.id)).not.toContain('leg-press')
    expect(legs.find((e) => e.id === 'hack-squat')).toMatchObject({ sets: 3, repMin: 8, repMax: 12 })
    expect(legs.find((e) => e.id === 'hack-squat')?.alternates).toContain('Leg Press')

    // Session 2: the hack squat has its own history now. One set at 80 × 10, short of the top: aim for 11.
    const w2 = await repo.startWorkout(U, 'legs-a')
    const hack2 = must(
      w2.entries.find((e) => e.exerciseId === 'hack-squat'),
      'the hack squat entry',
    )
    expect(hack2.sets).toHaveLength(3)
    expect(hack2.suggested).toEqual([
      { weight: 80, reps: 11 },
      { weight: 80, reps: 11 },
      { weight: 80, reps: 11 },
    ])
    expect(hack2.hint).toBe('Last time 80 kg × 10. Aim for 11.')
    expect(w2.entries.map((e) => e.exerciseId)).not.toContain('leg-press')

    // Stats keep the leg press as a lift that left the plan, beside the hack squat.
    const stats = await repo.getStatsData(U)
    const liftIds = liftsFrom(stats.plan, stats.workouts).map((l) => l.ex.id)
    expect(liftIds).toContain('leg-press')
    expect(liftIds).toContain('hack-squat')

    // The hack squat is taken this time: back to the leg press for today only. It comes in with the library's
    // 10-15 range and its own history: both sets hit 15 last time, so each goes up a plate pair (5 kg) and back
    // to the bottom of the range; the third set, not done last time, repeats the last one's numbers.
    const today = await repo.swapSessionExercise(U, w2.id, 'hack-squat', 'Leg Press', false)
    const press = must(
      today.entries.find((e) => e.exerciseId === 'leg-press'),
      'the leg press entry',
    )
    expect(press).toMatchObject({ repMin: 10, repMax: 15, plateLoaded: true })
    expect(press.sets).toHaveLength(3)
    expect(press.suggested).toEqual([
      { weight: 105, reps: 10 },
      { weight: 105, reps: 10 },
      { weight: 100, reps: 15 },
    ])
    expect(press.hint).toBe('Last time 100 kg × 15, 15. Sets 1 and 2 up to 105 kg.')
    expect(today.entries.map((e) => e.exerciseId)).not.toContain('hack-squat')
    expect((await repo.getPlan(U)).days[2].exercises.map((e) => e.id)).toContain('hack-squat')
    await repo.saveEntrySets(U, w2.id, 'leg-press', [set(105, 8), set(105, 8), set(105, 8, 1)])
    await repo.finishWorkout(U, w2.id, { effort: 3 })

    // Session 3: the plan still says hack squat, and its targets still come from session 1, untouched by the
    // leg press day in between.
    const w3 = await repo.startWorkout(U, 'legs-a')
    const hack3 = must(
      w3.entries.find((e) => e.exerciseId === 'hack-squat'),
      'the hack squat entry',
    )
    expect(hack3.suggested?.[0]).toEqual({ weight: 80, reps: 11 })
    expect(hack3.hint).toBe('Last time 80 kg × 10. Aim for 11.')

    // A lift the library does not know keeps the line's range and has no history to aim from.
    const belt = await repo.swapSessionExercise(U, w3.id, 'hack-squat', 'Belt Squat', false)
    const beltEntry = must(
      belt.entries.find((e) => e.name === 'Belt Squat'),
      'the belt squat entry',
    )
    expect(beltEntry).toMatchObject({ exerciseId: 'belt-squat', repMin: 8, repMax: 12, loadType: 'weight' })
    expect(beltEntry.suggested).toBeUndefined()
    expect(beltEntry.equipment).toBeUndefined()

    // A pause mid-session stays out of the minutes: started 30 minutes ago, paused for the last 5.
    await repo.pauseWorkout(U, w3.id, true)
    const now = new Date()
    await db()
      .collection('workouts')
      .updateOne({ userId: U, status: 'in_progress' } as never, {
        $set: {
          startedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
          pausedAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
        },
      })
    await repo.saveEntrySets(U, w3.id, 'belt-squat', [set(60, 10)])
    await repo.finishWorkout(U, w3.id, { effort: 2 })
    const [done] = await repo.listWorkouts(U, { limit: 1 })
    expect(done.pausedAt).toBeUndefined()
    expect(Math.round((done.pausedMs ?? 0) / 60_000)).toBe(5)
    expect(activeMinutes(done, new Date(must(done.finishedAt, 'the finish')))).toBe(25)
    const totals = weekTotals((await repo.getStatsData(U)).workouts, new Date())
    expect(totals.minutes).toBeGreaterThanOrEqual(25)
    expect(totals.minutes).toBeLessThanOrEqual(27)
  })
})
