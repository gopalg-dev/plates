import { describe, expect, it } from 'vitest'
import {
  defaultProgression,
  incrementFor,
  type PastEntry,
  plateOf,
  progressionOf,
  restSecondsFor,
  suggestNext,
} from '#/lib/logic/progression'
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

/** One past session of a weight lift at one weight, with the reps per set. */
function session(weight: number, reps: number[], effort?: number, partial: Partial<WorkoutEntry> = {}): PastEntry {
  return {
    entry: entry(
      partial,
      reps.map((r) => ({ weight, reps: r, done: true })),
    ),
    effort,
  }
}

describe('incrementFor', () => {
  it('uses 2.5 kg for upper body and 5 kg for lower body', () => {
    expect(incrementFor('chest', 'kg')).toBe(2.5)
    expect(incrementFor('back', 'kg')).toBe(2.5)
    expect(incrementFor('quads', 'kg')).toBe(5)
    expect(incrementFor('hamstrings', 'kg')).toBe(5)
    expect(incrementFor('calves', 'kg')).toBe(5)
  })

  it('uses 5 lb for upper body and 10 lb for lower body', () => {
    expect(incrementFor('shoulders', 'lb')).toBe(5)
    expect(incrementFor('quads', 'lb')).toBe(10)
  })
})

describe('restSecondsFor', () => {
  it('gives big lifts longer rest', () => {
    expect(restSecondsFor({ repMax: 8, loadType: 'weight', muscle: 'chest' })).toBe(150)
    expect(restSecondsFor({ repMax: 15, loadType: 'weight', muscle: 'biceps' })).toBe(90)
    expect(restSecondsFor({ repMax: 45, loadType: 'time', muscle: 'abs' })).toBe(60)
  })
})

describe('suggestNext for weight lifts', () => {
  it('gives blank sets and no targets when there is no history', () => {
    const s = suggestNext(bench, 4, [], 'kg')
    expect(s.sets).toHaveLength(4)
    expect(s.sets.every((x) => x.weight === undefined && x.reps === undefined && !x.done)).toBe(true)
    expect(s.suggested).toBeUndefined()
    expect(s.hint).toBeUndefined()
  })

  it('never logs anything itself: the sets stay blank and the targets sit beside them', () => {
    const s = suggestNext(bench, 2, [session(60, [8, 8])], 'kg')
    expect(s.sets).toEqual([{ done: false }, { done: false }])
    expect(s.suggested).toEqual([
      { weight: 62.5, reps: 5 },
      { weight: 62.5, reps: 5 },
    ])
  })

  it('adds the increment when every set hit the top of the range', () => {
    const s = suggestNext(bench, 4, [session(60, [8, 8, 8, 9])], 'kg')
    expect(s.suggested?.map((x) => x.weight)).toEqual([62.5, 62.5, 62.5, 62.5])
    expect(s.suggested?.map((x) => x.reps)).toEqual([5, 5, 5, 5])
    expect(s.hint).toBe('Last time 60 kg × 8, 8, 8, 9. Try 62.5 kg.')
  })

  it('moves each set on its own: the ones at the top go up, the rest repeat', () => {
    const s = suggestNext(bench, 4, [session(60, [8, 8, 7, 6])], 'kg')
    expect(s.suggested).toEqual([
      { weight: 62.5, reps: 5 },
      { weight: 62.5, reps: 5 },
      { weight: 60, reps: 8 },
      { weight: 60, reps: 7 },
    ])
    expect(s.hint).toBe('Last time 60 kg × 8, 8, 7, 6. Sets 1 and 2 up to 62.5 kg.')
  })

  it('keeps a pyramid as a pyramid: each rung carries its own weight and climbs on its own', () => {
    const pyramid: PastEntry = {
      entry: entry({ repMin: 8, repMax: 12 }, [
        { weight: 10, reps: 12, done: true },
        { weight: 12.5, reps: 10, done: true },
        { weight: 15, reps: 8, done: true },
      ]),
    }
    const s = suggestNext({ ...bench, repMin: 8, repMax: 12 }, 3, [pyramid], 'kg')
    expect(s.suggested).toEqual([
      { weight: 12.5, reps: 8 },
      { weight: 12.5, reps: 11 },
      { weight: 15, reps: 9 },
    ])
    expect(s.hint).toBe('Last time 10 × 12, 12.5 × 10, 15 kg × 8. Set 1 up to 12.5 kg.')
    const twoUp: PastEntry = {
      entry: entry({ repMin: 8, repMax: 12 }, [
        { weight: 10, reps: 12, done: true },
        { weight: 12.5, reps: 10, done: true },
        { weight: 15, reps: 12, done: true },
      ]),
    }
    expect(suggestNext({ ...bench, repMin: 8, repMax: 12 }, 3, [twoUp], 'kg').hint).toBe(
      'Last time 10 × 12, 12.5 × 10, 15 kg × 12. Set 1 up to 12.5 kg, Set 3 up to 17.5 kg.',
    )
  })

  it('uses the lower body step for legs', () => {
    const s = suggestNext(squat, 4, [session(100, [8, 8, 8, 8], undefined, { muscle: 'quads' })], 'kg')
    expect(s.suggested?.[0].weight).toBe(105)
  })

  it('repeats the weights and aims a rep higher when no set reached the top', () => {
    const s = suggestNext(bench, 4, [session(60, [7, 7, 6, 6])], 'kg')
    expect(s.suggested?.map((x) => x.weight)).toEqual([60, 60, 60, 60])
    expect(s.suggested?.map((x) => x.reps)).toEqual([8, 8, 7, 7])
    expect(s.hint).toBe('Last time 60 kg × 7, 7, 6, 6. Aim for 8, 8, 7, 7.')
    const even = suggestNext(bench, 3, [session(60, [6, 6, 6])], 'kg')
    expect(even.hint).toBe('Last time 60 kg × 6, 6, 6. Aim for 7.')
  })

  it('fills sets that were not done last time from the last done set, without a bump', () => {
    const past: PastEntry = {
      entry: entry({}, [
        { weight: 60, reps: 8, done: true },
        { weight: 60, reps: 8, done: true },
        { weight: 60, reps: 8, done: false },
        { weight: 60, reps: 8, done: false },
      ]),
    }
    const s = suggestNext(bench, 4, [past], 'kg')
    expect(s.suggested).toHaveLength(4)
    expect(s.suggested?.[1]).toEqual({ weight: 62.5, reps: 5 })
    expect(s.suggested?.[3]).toEqual({ weight: 60, reps: 8 })
  })

  it('holds a lift after a session that was too much, unless every set of it hit the top', () => {
    const s = suggestNext(bench, 2, [session(60, [8, 7], 4)], 'kg')
    expect(s.suggested?.map((x) => x.weight)).toEqual([60, 60])
    expect(s.hint).toBe('Last time 60 kg × 8, 7. That was too much; hold the weight.')
    // Every set at the top: this lift was fine whatever the rest of the session felt like.
    const fine = suggestNext(bench, 2, [session(60, [8, 8], 4)], 'kg')
    expect(fine.suggested?.map((x) => x.weight)).toEqual([62.5, 62.5])
  })

  it('lets a set one rep short go up after an easy session', () => {
    const s = suggestNext(bench, 2, [session(60, [7, 6], 1)], 'kg')
    expect(s.suggested).toEqual([
      { weight: 62.5, reps: 5 },
      { weight: 60, reps: 7 },
    ])
  })

  it('brings the weight down a tenth after three sessions stuck at the same weight', () => {
    const stuck = [session(60, [7, 6, 6]), session(60, [7, 7, 6]), session(60, [6, 6, 6])]
    const s = suggestNext(bench, 3, stuck, 'kg')
    expect(s.suggested?.map((x) => x.weight)).toEqual([55, 55, 55])
    expect(s.suggested?.map((x) => x.reps)).toEqual([5, 5, 5])
    expect(s.hint).toBe('3 sessions at 60 kg. Try 55 kg and build back up.')
    // Two stuck sessions are not a stall yet, and a session that reached the top on any set breaks it.
    expect(suggestNext(bench, 3, stuck.slice(0, 2), 'kg').suggested?.[0].weight).toBe(60)
    const broke = [session(60, [7, 6, 6]), session(60, [8, 7, 6]), session(60, [6, 6, 6])]
    expect(suggestNext(bench, 3, broke, 'kg').suggested?.[0].weight).toBe(60)
  })

  it('treats a session with nothing checked like no history', () => {
    const past: PastEntry = { entry: entry({}, [{ weight: 60, reps: 8, done: false }]) }
    const s = suggestNext(bench, 4, [past], 'kg')
    expect(s.hint).toBeUndefined()
    expect(s.suggested).toBeUndefined()
    expect(s.sets).toHaveLength(4)
  })
})

describe('the progression methods', () => {
  it('defaults to reps first whatever the training age, and reads the setting when there is one', () => {
    expect(defaultProgression('under1')).toBe('double')
    expect(defaultProgression('over1')).toBe('double')
    expect(progressionOf({ trainingAge: 'under1' })).toBe('double')
    expect(progressionOf({ trainingAge: 'under1', progression: 'topset' })).toBe('topset')
  })

  it('linear: a plate step once every planned set was done inside the range', () => {
    const s = suggestNext(bench, 3, [session(60, [6, 5, 5])], 'kg', 'linear')
    expect(s.suggested).toEqual([
      { weight: 62.5, reps: 5 },
      { weight: 62.5, reps: 5 },
      { weight: 62.5, reps: 5 },
    ])
    expect(s.hint).toBe('Last time 60 kg × 6, 5, 5. Try 62.5 kg.')
    // A set below the bottom of the range, or a set left undone, repeats the weight.
    expect(suggestNext(bench, 3, [session(60, [5, 5, 4])], 'kg', 'linear').suggested?.map((x) => x.weight)).toEqual([
      60, 60, 60,
    ])
    expect(suggestNext(bench, 3, [session(60, [5, 5])], 'kg', 'linear').suggested?.map((x) => x.weight)).toEqual([
      60, 60, 60,
    ])
    // Too much holds; three stuck sessions come down a tenth.
    expect(suggestNext(bench, 3, [session(60, [5, 5, 5], 4)], 'kg', 'linear').suggested?.[0].weight).toBe(60)
    const stuck = [session(60, [5, 5, 4]), session(60, [5, 4, 4]), session(60, [5, 5, 4])]
    expect(suggestNext(bench, 3, stuck, 'kg', 'linear').suggested?.[0].weight).toBe(55)
  })

  it('top set: the last set as many as possible, and the next load follows that count', () => {
    const at = (reps: number) => suggestNext(bench, 3, [session(60, [5, 5, reps])], 'kg', 'topset')
    expect(at(4).suggested?.map((x) => x.weight)).toEqual([57.5, 57.5, 57.5])
    expect(at(4).hint).toBe('Last set 60 kg × 4. Back to 57.5 kg; last set as many as you can.')
    expect(at(6).suggested?.map((x) => x.weight)).toEqual([60, 60, 60])
    expect(at(6).hint).toBe('Last set 60 kg × 6. Same weight; last set as many as you can.')
    expect(at(8).suggested?.map((x) => x.weight)).toEqual([62.5, 62.5, 62.5])
    expect(at(8).hint).toBe('Last set 60 kg × 8. Try 62.5 kg; last set as many as you can.')
    expect(at(11).suggested?.map((x) => x.weight)).toEqual([65, 65, 65])
    // On a barbell the step is 5 kg: one step at most, whatever the count.
    const bar = (reps: number) =>
      suggestNext(bench, 3, [session(60, [5, 5, reps])], 'kg', 'topset', { equipment: 'barbell', plate: 2.5 })
    expect(bar(11).suggested?.[0].weight).toBe(65)
    expect(bar(8).suggested?.[0].weight).toBe(65)
    // The last set aims for the top of the range, the others for the bottom.
    expect(at(8).suggested?.map((x) => x.reps)).toEqual([5, 5, 8])
    // Too much holds the weight whatever the count.
    expect(suggestNext(bench, 3, [session(60, [5, 5, 11], 4)], 'kg', 'topset').suggested?.[0].weight).toBe(60)
    // Stuck sessions do not trigger the tenth-off rule here: the method steps down on its own.
    const stuck = [session(60, [5, 5, 6]), session(60, [5, 5, 6]), session(60, [5, 5, 6])]
    expect(suggestNext(bench, 3, stuck, 'kg', 'topset').suggested?.[0].weight).toBe(60)
  })
})

describe('suggestNext for bodyweight and timed work', () => {
  const body = (reps: number[]): PastEntry => ({
    entry: entry(
      { loadType: 'bodyweight', repMin: 6, repMax: 12 },
      reps.map((r) => ({ reps: r, done: true })),
    ),
  })

  it('asks for slower tempo once every set is at the top', () => {
    const s = suggestNext(pullups, 4, [body([12, 12, 12, 12])], 'kg')
    expect(s.hint).toContain('3 seconds')
    expect(s.suggested?.map((x) => x.reps)).toEqual([12, 12, 12, 12])
    expect(s.sets.every((x) => !x.done && x.reps === undefined)).toBe(true)
  })

  it('names the alternate after three sessions under the range', () => {
    const under = [body([4, 4, 3]), body([4, 3, 3]), body([4, 4, 4])]
    const s = suggestNext({ ...pullups, alternates: ['Lat Pulldown'] }, 3, under, 'kg')
    expect(s.hint).toBe('Under 6 for 3 sessions. Switch to Lat Pulldown on Plan.')
    expect(suggestNext(pullups, 3, under, 'kg').hint).toBe('Under 6 for 3 sessions.')
    // Two sessions under, or one set in range, is not yet that.
    expect(suggestNext({ ...pullups, alternates: ['Lat Pulldown'] }, 3, under.slice(0, 2), 'kg').hint).toBe(
      'Last time 4, 4, 3. Add a rep where you can.',
    )
    expect(suggestNext({ ...pullups, alternates: ['Lat Pulldown'] }, 3, [body([6, 4, 3]), ...under], 'kg').hint).toBe(
      'Last time 6, 4, 3. Add a rep where you can.',
    )
  })

  it('asks for a rep when below the top', () => {
    const s = suggestNext(pullups, 4, [body([9, 8, 7, 7])], 'kg')
    expect(s.hint).toBe('Last time 9, 8, 7, 7. Add a rep where you can.')
  })

  it('adds five seconds to a hold at the top of its range', () => {
    const past: PastEntry = {
      entry: entry(
        { loadType: 'time', repMin: 30, repMax: 45 },
        [45, 45, 45].map((s) => ({ seconds: s, done: true })),
      ),
    }
    const s = suggestNext(hold, 3, [past], 'kg')
    expect(s.suggested?.map((x) => x.seconds)).toEqual([50, 50, 50])
    expect(s.hint).toBe('Last time 45, 45, 45 s. Try 50 s.')
  })
})

describe('incrementFor by equipment', () => {
  it('steps a barbell by two of the smallest plate', () => {
    expect(incrementFor('chest', 'kg', 'barbell')).toBe(5)
    expect(incrementFor('chest', 'kg', 'barbell', 1.25)).toBe(2.5)
    expect(incrementFor('quads', 'kg', 'barbell', 5)).toBe(10)
    expect(incrementFor('chest', 'lb', 'barbell')).toBe(5)
    expect(incrementFor('chest', 'lb', 'barbell', 5)).toBe(10)
  })

  it('steps a dumbbell by one rack step, whatever the plate', () => {
    expect(incrementFor('shoulders', 'kg', 'dumbbell', 1.25)).toBe(2.5)
    expect(incrementFor('shoulders', 'lb', 'dumbbell', 10)).toBe(5)
  })

  it('keeps the stack rule for machines, cables and unknown lifts', () => {
    expect(incrementFor('back', 'kg', 'cable', 1.25)).toBe(2.5)
    expect(incrementFor('quads', 'kg', 'machine', 1.25)).toBe(5)
    expect(incrementFor('back', 'kg', undefined, 1.25)).toBe(2.5)
  })
})

describe('plateOf', () => {
  it('reads an unset or foreign plate as the common one', () => {
    expect(plateOf({ units: 'kg' })).toBe(2.5)
    expect(plateOf({ units: 'kg', plate: 1.25 })).toBe(1.25)
    expect(plateOf({ units: 'lb', plate: 1.25 })).toBe(2.5)
    expect(plateOf({ units: 'lb', plate: 10 })).toBe(10)
  })
})
