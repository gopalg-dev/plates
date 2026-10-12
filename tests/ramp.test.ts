import { describe, expect, it } from 'vitest'
import { completedInRange, RAMP_MAX_SETS, RAMP_MAX_WEEKLY, rampOffer } from '#/lib/logic/ramp'
import { emptyByMuscle } from '#/lib/logic/stats'
import type { Exercise, Workout, WorkoutEntry } from '#/lib/types'

const now = new Date(2026, 9, 14, 18, 0, 0) // a Wednesday

const pulldown: Exercise = {
  id: 'lat-pulldown',
  name: 'Lat Pulldown',
  sets: 3,
  repMin: 8,
  repMax: 12,
  muscle: 'back',
  loadType: 'weight',
}

function entry(reps: number[], weight = 50, done = true): WorkoutEntry {
  return {
    exerciseId: pulldown.id,
    name: pulldown.name,
    muscle: 'back',
    loadType: 'weight',
    repMin: 8,
    repMax: 12,
    sets: reps.map((r) => ({ weight, reps: r, done })),
  }
}

function session(daysAgo: number, e: WorkoutEntry, effort?: number): Workout {
  const at = new Date(now)
  at.setDate(at.getDate() - daysAgo)
  return {
    id: `w${daysAgo}`,
    dayId: 'pull',
    dayName: 'Pull',
    dayType: 'pull',
    startedAt: at.toISOString(),
    finishedAt: at.toISOString(),
    status: 'done',
    effort,
    entries: [e],
  }
}

const weekly = { ...emptyByMuscle(), back: 12 }
/** Two fine sessions in the last two weeks, with a little history before so the trend can be read. */
const fine = [
  session(23, entry([10, 10, 9]), 2),
  session(16, entry([11, 10, 10]), 2),
  session(9, entry([12, 11, 10]), 2),
  // The top set moved up a plate at the same reps: clearly climbing (50 × 12 and 52.5 × 10 score the same).
  session(2, entry([12, 11, 10], 52.5), 2),
]

describe('completedInRange', () => {
  it('needs every set done and at the bottom of the range', () => {
    expect(completedInRange(entry([8, 8, 8]))).toBe(true)
    expect(completedInRange(entry([8, 8, 7]))).toBe(false)
    expect(completedInRange(entry([8, 8, 8], 50, false))).toBe(false)
  })
})

describe('rampOffer', () => {
  it('offers a set to a frequent, completed, fine, climbing lift', () => {
    expect(rampOffer(pulldown, weekly, fine, now, 'over1')).toBe(true)
  })

  it('never under a year of training', () => {
    expect(rampOffer(pulldown, weekly, fine, now, 'under1')).toBe(false)
  })

  it('holds at the caps', () => {
    expect(rampOffer({ ...pulldown, sets: RAMP_MAX_SETS }, weekly, fine, now, 'over1')).toBe(false)
    expect(rampOffer(pulldown, { ...weekly, back: RAMP_MAX_WEEKLY }, fine, now, 'over1')).toBe(false)
  })

  it('offers once a week', () => {
    expect(rampOffer({ ...pulldown, ramp: { base: 3, at: '2026-10-12' } }, weekly, fine, now, 'over1')).toBe(false)
    expect(rampOffer({ ...pulldown, ramp: { base: 3, at: '2026-10-05' } }, weekly, fine, now, 'over1')).toBe(true)
  })

  it('needs two sessions in the last two weeks', () => {
    const sparse = [
      session(23, entry([10, 10, 9]), 2),
      session(16, entry([11, 10, 10]), 2),
      session(2, entry([12, 12, 11]), 2),
    ]
    expect(rampOffer(pulldown, weekly, sparse, now, 'over1')).toBe(false)
  })

  it('lets a hard session through, and holds on too much, unrated, or not completed', () => {
    // Each one is the climbing session from `fine` with one thing wrong, so only that gate is on trial.
    const hard = [...fine.slice(0, 3), session(2, entry([12, 11, 10], 52.5), 3)]
    expect(rampOffer(pulldown, weekly, hard, now, 'over1')).toBe(true)
    const tooMuch = [...fine.slice(0, 3), session(2, entry([12, 11, 10], 52.5), 4)]
    expect(rampOffer(pulldown, weekly, tooMuch, now, 'over1')).toBe(false)
    const unrated = [...fine.slice(0, 3), session(2, entry([12, 11, 10], 52.5))]
    expect(rampOffer(pulldown, weekly, unrated, now, 'over1')).toBe(false)
    const short = [...fine.slice(0, 3), session(2, entry([12, 11, 7], 52.5), 2)]
    expect(rampOffer(pulldown, weekly, short, now, 'over1')).toBe(false)
  })

  it('holds on a stuck lift', () => {
    const stuck = [
      session(30, entry([12, 12, 12], 55), 2),
      session(23, entry([10, 10, 10]), 2),
      session(16, entry([10, 10, 10]), 2),
      session(9, entry([10, 10, 10]), 2),
      session(2, entry([10, 10, 10]), 2),
    ]
    expect(rampOffer(pulldown, weekly, stuck, now, 'over1')).toBe(false)
  })
})
