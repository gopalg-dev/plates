import { describe, expect, it } from 'vitest'
import { incrementFor, restSecondsFor, suggestNext } from '#/lib/logic/progression'
import type { LoggedSet, WorkoutEntry } from '#/lib/types'

const bench = { repMin: 5, repMax: 8, muscle: 'chest', loadType: 'weight' } as const
const squat = { repMin: 5, repMax: 8, muscle: 'quads', loadType: 'weight' } as const
const pullups = { repMin: 6, repMax: 12, muscle: 'back', loadType: 'bodyweight' } as const
const hold = { repMin: 30, repMax: 45, muscle: 'abs', loadType: 'time' } as const

function entry(partial: Partial<WorkoutEntry>, sets: LoggedSet[]): WorkoutEntry {
  return {
    exerciseId: 'x',
    name: 'x',
    muscle: 'chest',
    loadType: 'weight',
    repMin: 5,
    repMax: 8,
    ...partial,
    sets,
  }
}

describe('incrementFor', () => {
  it('uses 2.5 kg for upper body and 5 kg for lower body', () => {
    expect(incrementFor('chest', 'kg')).toBe(2.5)
    expect(incrementFor('biceps', 'kg')).toBe(2.5)
    expect(incrementFor('quads', 'kg')).toBe(5)
    expect(incrementFor('calves', 'kg')).toBe(5)
  })

  it('uses 5 lb for upper body and 10 lb for lower body', () => {
    expect(incrementFor('shoulders', 'lb')).toBe(5)
    expect(incrementFor('hamstrings', 'lb')).toBe(10)
  })
})

describe('restSecondsFor', () => {
  it('gives big lifts longer rest', () => {
    expect(restSecondsFor(bench)).toBe(150)
    expect(restSecondsFor({ repMax: 15, muscle: 'shoulders', loadType: 'weight' })).toBe(90)
    expect(restSecondsFor(hold)).toBe(60)
  })
})

describe('suggestNext for weight lifts', () => {
  it('gives blank sets when there is no history', () => {
    const s = suggestNext(bench, 4, undefined, 'kg')
    expect(s.sets).toHaveLength(4)
    expect(s.sets.every((x) => x.weight === undefined && x.reps === undefined && !x.done)).toBe(true)
    expect(s.hint).toBeUndefined()
    expect(s.bumped).toBe(false)
  })

  it('adds the increment when every set hit the top of the range', () => {
    const last = entry({}, [
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 9, done: true },
    ])
    const s = suggestNext(bench, 4, last, 'kg')
    expect(s.bumped).toBe(true)
    expect(s.sets.map((x) => x.weight)).toEqual([62.5, 62.5, 62.5, 62.5])
    expect(s.sets.map((x) => x.reps)).toEqual([5, 5, 5, 5])
    expect(s.hint).toContain('Try 62.5 kg')
  })

  it('uses the lower body step for legs', () => {
    const last = entry({ muscle: 'quads' }, [
      { weight: 100, reps: 8, done: true },
      { weight: 100, reps: 8, done: true },
      { weight: 100, reps: 8, done: true },
      { weight: 100, reps: 8, done: true },
    ])
    const s = suggestNext(squat, 4, last, 'kg')
    expect(s.sets[0].weight).toBe(105)
  })

  it('carries the same weights when a set fell short', () => {
    const last = entry({}, [
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 6, done: true },
    ])
    const s = suggestNext(bench, 4, last, 'kg')
    expect(s.bumped).toBe(false)
    expect(s.sets.map((x) => x.weight)).toEqual([60, 60, 60, 60])
    expect(s.sets.map((x) => x.reps)).toEqual([8, 8, 8, 6])
    expect(s.hint).toBe('Last time 60 kg × 8, 8, 8, 6.')
  })

  it('does not bump when fewer sets were done than planned', () => {
    const last = entry({}, [
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 8, done: true },
      { weight: 60, reps: 8, done: false },
      { weight: 60, reps: 8, done: false },
    ])
    const s = suggestNext(bench, 4, last, 'kg')
    expect(s.bumped).toBe(false)
    expect(s.sets).toHaveLength(4)
    expect(s.sets[3].weight).toBe(60)
  })

  it('treats a session with nothing checked like no history', () => {
    const last = entry({}, [{ weight: 60, reps: 8, done: false }])
    const s = suggestNext(bench, 4, last, 'kg')
    expect(s.hint).toBeUndefined()
    expect(s.sets).toHaveLength(4)
  })
})

describe('suggestNext for bodyweight and timed work', () => {
  it('asks for slower tempo once every set is at the top', () => {
    const last = entry({ loadType: 'bodyweight', repMin: 6, repMax: 12 }, [
      { reps: 12, done: true },
      { reps: 12, done: true },
      { reps: 12, done: true },
      { reps: 12, done: true },
    ])
    const s = suggestNext(pullups, 4, last, 'kg')
    expect(s.bumped).toBe(true)
    expect(s.hint).toContain('3 seconds')
    expect(s.sets.map((x) => x.reps)).toEqual([12, 12, 12, 12])
  })

  it('asks for a rep when below the top', () => {
    const last = entry({ loadType: 'bodyweight', repMin: 6, repMax: 12 }, [
      { reps: 9, done: true },
      { reps: 8, done: true },
      { reps: 7, done: true },
      { reps: 7, done: true },
    ])
    const s = suggestNext(pullups, 4, last, 'kg')
    expect(s.bumped).toBe(false)
    expect(s.hint).toBe('Last time 9, 8, 7, 7. Add a rep where you can.')
  })

  it('adds five seconds to a hold at the top of its range', () => {
    const last = entry({ loadType: 'time', repMin: 30, repMax: 45 }, [
      { seconds: 45, done: true },
      { seconds: 45, done: true },
      { seconds: 45, done: true },
    ])
    const s = suggestNext(hold, 3, last, 'kg')
    expect(s.bumped).toBe(true)
    expect(s.sets.map((x) => x.seconds)).toEqual([50, 50, 50])
  })
})
