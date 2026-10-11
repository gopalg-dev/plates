import { describe, expect, it } from 'vitest'
import { bodyweightAlert, stallAlerts, weekAlert } from '#/lib/logic/alerts'
import { paceNote } from '#/lib/logic/goal'
import { suggestNext, type PastEntry } from '#/lib/logic/progression'
import { plannedPerWeek, summarize } from '#/lib/logic/summary'
import type { BodyweightLog, LoggedSet, Plan, Workout, WorkoutEntry } from '#/lib/types'

const now = new Date('2026-10-11T18:00:00') // a Sunday

function iso(daysAgo: number, hour = 18): string {
  const d = new Date(now)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function entry(exerciseId: string, sets: LoggedSet[], loadType: WorkoutEntry['loadType'] = 'weight'): WorkoutEntry {
  return { exerciseId, name: exerciseId, muscle: 'chest', loadType, repMin: 5, repMax: 8, sets }
}

function session(id: string, daysAgo: number, entries: WorkoutEntry[], dayId = 'push-a'): Workout {
  return {
    id,
    dayId,
    dayName: 'Push A',
    dayType: 'push',
    startedAt: iso(daysAgo, 17),
    finishedAt: iso(daysAgo),
    status: 'done',
    entries,
  }
}

const bench = (w: number, r: number) => entry('bench', [{ weight: w, reps: r, done: true }])

describe('finish summary', () => {
  it('names the best set, marks a new best, and shows the weight change against last time', () => {
    const earlier = [
      session('a', 14, [bench(60, 8), entry('pullups', [{ reps: 8, done: true }], 'bodyweight')]),
      session('b', 7, [bench(60, 8)]),
    ]
    const today = session('c', 0, [
      bench(62.5, 8),
      entry('pullups', [{ reps: 7, done: true }], 'bodyweight'),
      entry('curl', [{ weight: 15, reps: 10, done: true }]),
      entry('skipped', [{ done: false }]),
    ])
    const s = summarize(today, earlier, 'kg', { done: 3, planned: 4 })
    expect(s.week).toEqual({ done: 3, planned: 4 })
    expect(s.lines).toEqual([
      { exerciseId: 'bench', name: 'bench', best: '62.5 kg × 8', pr: true, change: '+2.5 kg' },
      { exerciseId: 'pullups', name: 'pullups', best: '7 reps', pr: false },
      { exerciseId: 'curl', name: 'curl', best: '15 kg × 10', pr: false },
    ])
    // A drop reads as a minus; the same weight shows no change.
    const lighter = summarize(session('d', 0, [bench(57.5, 8)]), earlier, 'kg', { done: 1, planned: 4 })
    expect(lighter.lines[0]).toMatchObject({ pr: false, change: '−2.5 kg' })
    const same = summarize(session('e', 0, [bench(60, 7)]), earlier, 'kg', { done: 1, planned: 4 })
    expect(same.lines[0].change).toBeUndefined()
  })

  it('counts the plan week by weekday or by rolling days up to six', () => {
    const days = (n: number, weekdays?: number[]): Plan => ({
      days: Array.from({ length: n }, (_, i) => ({
        id: `d${i}`,
        name: `D${i}`,
        type: 'full',
        exercises: [],
        ...(weekdays ? { weekday: weekdays[i] } : {}),
      })),
      updatedAt: 'x',
    })
    expect(plannedPerWeek(days(3), { schedule: 'rolling' })).toBe(3)
    expect(plannedPerWeek(days(7), { schedule: 'rolling' })).toBe(6)
    expect(plannedPerWeek(days(3, [1, 3, 5]), { schedule: 'weekday' })).toBe(3)
  })
})

describe('alerts', () => {
  it('flags a lift trained three times in four weeks without beating its older best', () => {
    const ws = [
      session('old', 40, [bench(62.5, 8)]),
      session('1', 20, [bench(60, 8)]),
      session('2', 13, [bench(60, 8)]),
      session('3', 6, [bench(62.5, 8)]),
    ]
    expect(stallAlerts(ws, now)).toEqual([
      {
        kind: 'stall',
        title: 'bench has not moved in 4 weeks.',
        detail: 'Swap it for an alternate on Plan, or take a lighter week on it.',
      },
    ])
    // Beating the older best, or too few sessions, is not a stall; a lift with no older history cannot stall.
    expect(stallAlerts([...ws.slice(0, 3), session('3', 6, [bench(65, 8)])], now)).toEqual([])
    expect(stallAlerts(ws.slice(0, 3), now)).toEqual([])
    expect(stallAlerts(ws.slice(1), now)).toEqual([])
  })

  it('warns when the sessions left are as many as the days left in the week', () => {
    // Sunday: one day left.
    expect(weekAlert(3, 4, now)).toEqual({
      kind: 'week',
      title: '1 session left this week.',
      detail: 'Today is the last day.',
    })
    expect(weekAlert(4, 4, now)).toBeNull()
    // Thursday: four days left, three sessions to go is fine, four is not.
    const thursday = new Date('2026-10-08T18:00:00')
    expect(weekAlert(0, 3, thursday)).toBeNull()
    expect(weekAlert(0, 4, thursday)).toMatchObject({ title: '4 sessions left this week.', detail: '4 days to go.' })
  })

  it('says the scale is flat after three weeks against a gain or a cut', () => {
    const flat: BodyweightLog[] = [0, 3, 6, 9, 12, 15, 18].map((d, i) => ({
      id: String(i),
      date: iso(d, 7),
      weight: 72 + (i % 2) * 0.1,
    }))
    expect(bodyweightAlert(flat, 'gain', 'kg', now)).toMatchObject({
      kind: 'weight',
      title: 'Weight flat for 3 weeks.',
    })
    expect(bodyweightAlert(flat, 'gain', 'kg', now)?.detail).toBe('Eat more: aim for +0.25 kg a week.')
    expect(bodyweightAlert(flat, 'cut', 'kg', now)?.detail).toBe('Eat less: aim for −0.25 kg a week.')
    expect(bodyweightAlert(flat, 'hold', 'kg', now)).toBeNull()
    expect(bodyweightAlert(flat, undefined, 'kg', now)).toBeNull()
    // Gaining a third of a kilo a week is on pace; a week of weigh-ins missing says nothing yet.
    const rising = flat.map((l, i) => ({ ...l, weight: 72 + ((18 - [0, 3, 6, 9, 12, 15, 18][i]) / 7) * 0.33 }))
    expect(bodyweightAlert(rising, 'gain', 'kg', now)).toBeNull()
    expect(bodyweightAlert(flat.slice(0, 3), 'gain', 'kg', now)).toBeNull()
  })

  it('reads the week-on-week change against the goal', () => {
    expect(paceNote(0.4, 'gain')).toBe('Right in the lean-gain pace.')
    expect(paceNote(0, 'gain')).toBe('Below the gain pace. Eat more.')
    expect(paceNote(-0.5, 'cut')).toBe('A steady cut.')
    expect(paceNote(0.1, 'cut')).toBe('Not dropping. Eat less.')
    expect(paceNote(0.1)).toBe('Holding steady.')
    expect(paceNote(0.6, 'hold')).toBe('Drifting up.')
  })
})

describe('reps left in the tank', () => {
  const ex = { repMin: 5, repMax: 8, muscle: 'chest', loadType: 'weight' } as const
  const past = (left?: number, effort?: number): PastEntry => ({
    entry: entry('bench', [
      { weight: 60, reps: 6, done: true },
      { weight: 60, reps: 6, done: true },
      { weight: 60, reps: 6, done: true, ...(left !== undefined ? { left } : {}) },
    ]),
    effort,
  })

  it('moves every set up a step when three or more reps were left, whatever the count', () => {
    const s = suggestNext(ex, 3, [past(3)], 'kg')
    expect(s.suggested?.map((x) => x.weight)).toEqual([62.5, 62.5, 62.5])
    expect(s.hint).toBe('Last time 60 kg × 6, 6, 6. Reps to spare; try 62.5 kg.')
    expect(suggestNext(ex, 3, [past(1)], 'kg').suggested?.map((x) => x.weight)).toEqual([60, 60, 60])
    expect(suggestNext(ex, 3, [past(3, 4)], 'kg').suggested?.map((x) => x.weight)).toEqual([60, 60, 60])
    expect(suggestNext(ex, 3, [past(3)], 'kg', 'linear').suggested?.[0].weight).toBe(62.5)
    expect(suggestNext(ex, 3, [past(3)], 'kg', 'topset').suggested?.[0].weight).toBe(62.5)
  })
})
