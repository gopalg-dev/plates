import { describe, expect, it } from 'vitest'
import { canComplete, completeSet } from '#/components/app/exercise-row'
import { errorMessage } from '#/lib/format'
import type { WorkoutEntry } from '#/lib/types'

const bench: WorkoutEntry = {
  exerciseId: 'barbell-bench-press',
  name: 'Barbell Bench Press',
  muscle: 'chest',
  loadType: 'weight',
  repMin: 5,
  repMax: 8,
  sets: [{ done: false }, { done: false }, { done: false }],
}
const pullups: WorkoutEntry = { ...bench, exerciseId: 'pull-ups', name: 'Pull-ups', loadType: 'bodyweight' }

describe('marking a set done', () => {
  it('refuses a weight set with no weight, or a weight of zero', () => {
    expect(canComplete(bench, bench.sets, 0)).toBe(false)
    // A target from an earlier session counts as a weight.
    expect(canComplete({ ...bench, suggested: [{ weight: 60, reps: 5 }] }, bench.sets, 0)).toBe(true)
    expect(completeSet({ ...bench, suggested: [{ weight: 60, reps: 6 }] }, bench.sets, 0)[0]).toEqual({
      weight: 60,
      reps: 6,
      done: true,
    })
    expect(completeSet(bench, bench.sets, 0)).toBe(bench.sets)
    const zero = [{ weight: 0, done: false }]
    expect(canComplete(bench, zero, 0)).toBe(false)
    expect(completeSet(bench, zero, 0)[0].done).toBe(false)
  })

  it('takes the weight from the set or the nearest earlier set, and the reps from the target', () => {
    const sets = [{ weight: 60, reps: 8, done: true }, { done: false }]
    expect(canComplete(bench, sets, 1)).toBe(true)
    expect(completeSet(bench, sets, 1)[1]).toEqual({ weight: 60, reps: 8, done: true })
    expect(completeSet(bench, [{ weight: 62.5, done: false }], 0)[0]).toEqual({ weight: 62.5, reps: 5, done: true })
  })

  it('needs no weight for bodyweight work and can always undo', () => {
    expect(canComplete(pullups, pullups.sets, 0)).toBe(true)
    expect(completeSet(pullups, pullups.sets, 0)[0]).toEqual({ reps: 5, done: true })
    const done = [{ reps: 5, done: true }]
    expect(completeSet(bench, done, 0)[0].done).toBe(false)
  })
})

describe('errorMessage', () => {
  it('passes a sentence through and hides anything that is not one', () => {
    expect(errorMessage(new Error('Workout not found'), 'Could not save.')).toBe('Workout not found')
    expect(errorMessage(new Error('[{"code":"invalid_type"}]'), 'Could not save.')).toBe('Could not save.')
    expect(errorMessage(new Error(''), 'Could not save.')).toBe('Could not save.')
    expect(errorMessage('nope', 'Could not save.')).toBe('Could not save.')
  })
})
