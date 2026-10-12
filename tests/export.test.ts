import { describe, expect, it } from 'vitest'
import {
  bodyweightsToRows,
  countedSets,
  exportFileName,
  measurementsToRows,
  setHeaders,
  setsToRows,
} from '#/lib/logic/export'
import type { Workout } from '#/lib/types'

const started = new Date(2026, 9, 10, 18, 5)
const finishedAt = new Date(2026, 9, 10, 19, 0)

const session: Workout = {
  id: 'w1',
  dayId: 'pull-a',
  dayName: 'Pull A',
  dayType: 'pull',
  startedAt: started.toISOString(),
  finishedAt: finishedAt.toISOString(),
  status: 'done',
  effort: 3,
  note: 'Grip gave out',
  entries: [
    {
      exerciseId: 'pull-ups',
      name: 'Pull-ups',
      muscle: 'back',
      loadType: 'bodyweight',
      repMin: 6,
      repMax: 12,
      sets: [{ reps: 8, done: true }, { reps: 7, done: true }, { done: false }],
    },
    {
      exerciseId: 'barbell-row',
      name: 'Barbell Row',
      muscle: 'back',
      loadType: 'weight',
      repMin: 6,
      repMax: 10,
      sets: [{ weight: 60, reps: 8, done: true }],
    },
  ],
}

const unfinished: Workout = { ...session, id: 'w2', status: 'in_progress', finishedAt: undefined }

describe('export rows', () => {
  it('writes one row per done set, oldest session first, with the session fields repeated', () => {
    const earlier: Workout = {
      ...session,
      id: 'w0',
      finishedAt: new Date(2026, 9, 8, 19, 0).toISOString(),
      effort: undefined,
      note: undefined,
      entries: [session.entries[1]],
    }
    const rows = setsToRows([session, unfinished, earlier])
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      Date: '2026-10-08',
      Exercise: 'Barbell Row',
      Weight: 60,
      Reps: 8,
      Effort: '',
      Note: '',
    })
    expect(rows[1]).toMatchObject({
      Date: '2026-10-10',
      Time: '18:05',
      Day: 'Pull A',
      Type: 'pull',
      Exercise: 'Pull-ups',
      Muscle: 'back',
      Set: 1,
      Weight: '',
      Reps: 8,
      Seconds: '',
      Effort: 'Hard',
      Note: 'Grip gave out',
    })
    expect(rows[2].Set).toBe(2)
    expect(rows[3].Exercise).toBe('Barbell Row')
    expect(countedSets([session, unfinished])).toBe(3)
  })

  it('names the weight column with the units', () => {
    expect(setHeaders('kg')[7]).toBe('Weight (kg)')
    expect(setHeaders('lb')).toHaveLength(12)
  })

  it('exports body logs by day, oldest first', () => {
    const bw = bodyweightsToRows([
      { id: 'b', date: new Date(2026, 9, 10).toISOString(), day: '2026-10-10', weight: 72.5 },
      { id: 'a', date: new Date(2026, 9, 3).toISOString(), weight: 72 },
    ])
    expect(bw).toEqual([
      { Date: '2026-10-03', Weight: 72 },
      { Date: '2026-10-10', Weight: 72.5 },
    ])
    const tape = measurementsToRows([
      { id: 'm', date: new Date(2026, 9, 10).toISOString(), day: '2026-10-10', arm: 36, waist: 80 },
    ])
    expect(tape).toEqual([{ Date: '2026-10-10', Arm: 36, Chest: '', Waist: 80 }])
  })

  it('names the file by the day', () => {
    expect(exportFileName('xlsx', new Date(2026, 9, 10))).toBe('plates-logs-2026-10-10.xlsx')
    expect(exportFileName('csv', new Date(2026, 0, 2))).toBe('plates-logs-2026-01-02.csv')
  })
})
