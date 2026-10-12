import { describe, expect, it } from 'vitest'
import { averageEffort, deloadHint, effortLabel, effortThisWeek, strengthMoved } from '#/lib/logic/effort'
import { addDays, startOfWeek } from '#/lib/logic/stats'
import type { Workout, WorkoutEntry } from '#/lib/types'

// Saturday evening.
const now = new Date(2026, 9, 10, 18, 0, 0)

function daysAgo(n: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0)
  return d
}

let counter = 0
function session(finishedAt: Date, effort?: number, benchWeight?: number): Workout {
  counter++
  const entries: WorkoutEntry[] = benchWeight
    ? [
        {
          exerciseId: 'bench',
          name: 'Bench',
          muscle: 'chest',
          loadType: 'weight',
          repMin: 5,
          repMax: 8,
          sets: [{ weight: benchWeight, reps: 8, done: true }],
        },
      ]
    : []
  return {
    id: `w${counter}`,
    dayId: 'push-a',
    dayName: 'Push A',
    dayType: 'push',
    startedAt: finishedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status: 'done',
    entries,
    ...(effort ? { effort } : {}),
  }
}

describe('effort averages', () => {
  it('averages rated sessions in a window and ignores unrated ones', () => {
    const ws = [session(daysAgo(1), 3), session(daysAgo(2), 1), session(daysAgo(3))]
    expect(effortThisWeek(ws, now)).toBe(2)
    const start = startOfWeek(now)
    expect(averageEffort(ws, addDays(start, -7), start)).toBeUndefined()
  })

  it('turns an average into a label', () => {
    expect(effortLabel(1)).toBe('Easy')
    expect(effortLabel(2.4)).toBe('OK')
    expect(effortLabel(2.6)).toBe('Hard')
    expect(effortLabel(9)).toBe('Too much')
  })
})

describe('strengthMoved', () => {
  it('is undefined without data on both sides', () => {
    expect(strengthMoved([session(daysAgo(2), 2, 60)], now)).toBeUndefined()
  })

  it('is true when a lift beat its earlier best', () => {
    const ws = [session(daysAgo(20), 2, 60), session(daysAgo(3), 2, 62.5)]
    expect(strengthMoved(ws, now)).toBe(true)
  })

  it('is false when nothing moved', () => {
    const ws = [session(daysAgo(20), 2, 60), session(daysAgo(3), 2, 60)]
    expect(strengthMoved(ws, now)).toBe(false)
  })
})

describe('deloadHint', () => {
  // Week before last: 19 and 17 days ago. Last week: 12, 10 and 6 days ago. This week: 4 and 1.
  it('fires after two hard weeks with flat strength', () => {
    const ws = [
      session(daysAgo(19), 3, 60),
      session(daysAgo(17), 4, 60),
      session(daysAgo(12), 3, 60),
      session(daysAgo(10), 4, 60),
      session(daysAgo(6), 3, 60),
      session(daysAgo(4), 3, 60),
      session(daysAgo(1), 2, 60),
    ]
    expect(deloadHint(ws, now)).toBe(true)
  })

  it('stays quiet when strength moved', () => {
    const ws = [session(daysAgo(19), 3, 60), session(daysAgo(6), 4, 62.5)]
    expect(deloadHint(ws, now)).toBe(false)
  })

  it('fires when three lifts in four are stuck, not only when none moved', () => {
    const lift = (id: string, weight: number): WorkoutEntry => ({
      exerciseId: id,
      name: id,
      muscle: 'chest',
      loadType: 'weight',
      repMin: 5,
      repMax: 8,
      sets: [{ weight, reps: 8, done: true }],
    })
    const week = (daysBack: number, effort: number, weights: number[]): Workout => ({
      ...session(daysAgo(daysBack), effort),
      entries: weights.map((w, i) => lift(`l${i}`, w)),
    })
    // Four lifts; one moved: three in four stuck, two hard weeks.
    const oneMoved = [week(19, 3, [60, 60, 60, 60]), week(6, 4, [60, 60, 60, 62.5])]
    expect(deloadHint(oneMoved, now)).toBe(true)
    // Two moved: half stuck is not a plateau.
    const twoMoved = [week(19, 3, [60, 60, 60, 60]), week(6, 4, [60, 60, 62.5, 62.5])]
    expect(deloadHint(twoMoved, now)).toBe(false)
  })

  it('stays quiet when a week was easy or unrated', () => {
    expect(deloadHint([session(daysAgo(19), 1, 60), session(daysAgo(6), 4, 60)], now)).toBe(false)
    expect(deloadHint([session(daysAgo(19), undefined, 60), session(daysAgo(6), 4, 60)], now)).toBe(false)
  })
})
