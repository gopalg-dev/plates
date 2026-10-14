import { describe, expect, it } from 'vitest'
import { LIBRARY } from '#/lib/library'
import { lineOf, removeExerciseFrom, swapExerciseIn, swapLine } from '#/lib/logic/day-edit'
import type { Exercise, PlanDay } from '#/lib/types'

const squat: Exercise = {
  id: 'barbell-squat',
  name: 'Barbell Squat',
  sets: 4,
  repMin: 5,
  repMax: 8,
  muscle: 'quads',
  loadType: 'weight',
  alternates: ['Hack Squat', 'Leg Press'],
  ramp: { base: 3, at: '2026-10-05' },
}

describe('swapLine', () => {
  it('takes the new lift’s own sets and range from the library, and its type and muscle', () => {
    const out = swapLine(squat, 'Hack Squat', LIBRARY, ['leg-curl'])
    expect(out).toMatchObject({ id: 'hack-squat', name: 'Hack Squat', sets: 3, repMin: 8, repMax: 12 })
    expect(out.muscle).toBe('quads')
    expect(out.alternates).toEqual(['Barbell Squat', 'Leg Press'])
    // The set count is the new lift's own: the ramp's memory of the old one goes.
    expect(out.ramp).toBeUndefined()
    // Pull-ups to Lat Pulldown: bodyweight becomes a weight.
    const pull: Exercise = { ...squat, name: 'Pull-ups', loadType: 'bodyweight', muscle: 'back', alternates: [] }
    expect(swapLine(pull, 'Lat Pulldown', LIBRARY, [])).toMatchObject({ loadType: 'weight', repMin: 8, repMax: 12 })
  })

  it('keeps the line’s numbers for a lift the library does not know', () => {
    const out = swapLine(squat, 'Belt Squat', LIBRARY, [])
    expect(out).toMatchObject({ id: 'belt-squat', sets: 4, repMin: 5, repMax: 8, loadType: 'weight' })
    expect(out.ramp).toEqual(squat.ramp)
  })

  it('keeps the id clear of the ones taken', () => {
    expect(swapLine(squat, 'Hack Squat', LIBRARY, ['hack-squat']).id).toBe('hack-squat-2')
  })

  it('refuses the lift it has already, however it is spelt', () => {
    expect(() => swapLine(squat, 'Barbell Squat', LIBRARY, [])).toThrow('Barbell Squat is the lift already')
    expect(() => swapLine(squat, 'barbell squat ', LIBRARY, [])).toThrow('is the lift already')
  })
})

describe('swapExerciseIn', () => {
  it('swaps one line of the day and leaves the others alone', () => {
    const day: PlanDay = {
      id: 'legs',
      name: 'Legs',
      type: 'legs',
      exercises: [squat, { ...squat, id: 'x', name: 'X' }],
    }
    const out = swapExerciseIn(day, 'barbell-squat', 'Hack Squat', LIBRARY)
    expect(out.exercises.map((e) => e.name)).toEqual(['Hack Squat', 'X'])
    expect(day.exercises[0].name).toBe('Barbell Squat')
    expect(() => swapExerciseIn(day, 'nope', 'Hack Squat', LIBRARY)).toThrow('Exercise not found')
  })
})

describe('removeExerciseFrom', () => {
  it('takes the last lift off too, leaving the day empty', () => {
    const day: PlanDay = { id: 'legs', name: 'Legs', type: 'legs', exercises: [squat] }
    expect(removeExerciseFrom(day, 'barbell-squat').exercises).toEqual([])
    expect(() => removeExerciseFrom(day, 'nope')).toThrow('Exercise not found')
  })
})

describe('lineOf', () => {
  it('turns a session lift back into a plan line with the sets given', () => {
    const entry = {
      exerciseId: 'row',
      name: 'Row',
      muscle: 'back' as const,
      loadType: 'weight' as const,
      repMin: 6,
      repMax: 10,
    }
    expect(lineOf(entry, 2)).toEqual({
      id: 'row',
      name: 'Row',
      sets: 2,
      repMin: 6,
      repMax: 10,
      muscle: 'back',
      loadType: 'weight',
    })
  })
})
