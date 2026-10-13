import { describe, expect, it } from 'vitest'
import { missingFrom, syncEntries } from '#/lib/logic/session-sync'
import type { Exercise, LoggedSet, WorkoutEntry } from '#/lib/types'

const ex = (id: string, sets = 3, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  sets,
  repMin: 8,
  repMax: 12,
  muscle: 'back',
  loadType: 'weight',
  ...extra,
})

const entry = (id: string, sets: LoggedSet[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  exerciseId: id,
  name: id,
  muscle: 'back',
  loadType: 'weight',
  repMin: 8,
  repMax: 12,
  sets,
  ...extra,
})

const blank = (n: number): LoggedSet[] => Array.from({ length: n }, () => ({ done: false }))
const ticked: LoggedSet = { weight: 60, reps: 10, done: true }

describe('syncEntries', () => {
  it('follows the day: its order, new lifts from fresh, untouched lifts that left are gone', () => {
    const session = [entry('row', blank(3)), entry('curl', blank(3))]
    const day = [ex('pull-ups'), ex('row')]
    const fresh = [entry('pull-ups', blank(3), { hint: 'new' })]
    const { entries, kept } = syncEntries(session, day, fresh, 'over1')
    expect(entries.map((e) => e.exerciseId)).toEqual(['pull-ups', 'row'])
    expect(entries[0].hint).toBe('new')
    expect(kept).toEqual([])
  })

  it('keeps a lift that left the plan when a set of it is ticked, at the end, and names it', () => {
    const session = [entry('curl', [ticked, ...blank(2)]), entry('row', blank(3))]
    const { entries, kept } = syncEntries(session, [ex('row')], [], 'over1')
    expect(entries.map((e) => e.exerciseId)).toEqual(['row', 'curl'])
    expect(kept).toEqual(['curl'])
  })

  it('takes the plan version of a lift it already had, and grows its sets', () => {
    const session = [entry('row', [ticked, ...blank(2)], { suggested: [{ weight: 60, reps: 10 }] })]
    const day = [ex('row', 5, { name: 'Barbell Row', repMin: 6, repMax: 10 })]
    const [row] = syncEntries(session, day, [], 'over1').entries
    expect(row.name).toBe('Barbell Row')
    expect([row.repMin, row.repMax]).toEqual([6, 10])
    expect(row.sets).toHaveLength(5)
    expect(row.sets[0]).toEqual(ticked)
    expect(row.suggested).toHaveLength(5)
  })

  it('shrinks unticked sets to the plan, but never below the last ticked one', () => {
    const session = [entry('row', [...blank(2), ticked, ...blank(2)])]
    const [row] = syncEntries(session, [ex('row', 2)], [], 'over1').entries
    expect(row.sets).toHaveLength(3)
    expect(row.sets[2]).toEqual(ticked)
  })
})

describe('missingFrom', () => {
  it('lists the day lifts the session does not have', () => {
    expect(missingFrom([entry('row', [])], [ex('row'), ex('curl')]).map((e) => e.id)).toEqual(['curl'])
  })
})
