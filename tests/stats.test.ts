import { describe, expect, it } from 'vitest'
import {
  bodyweightTrend,
  epley,
  monthCalendar,
  plannedVolumeByMuscle,
  recentPRs,
  sessionsInWeek,
  startOfWeek,
  strengthSeries,
  volumeByMuscleInWeek,
  weekTotals,
  weeklyStreak,
  weeklyStrength,
} from '#/lib/logic/stats'
import { seedPlan } from '#/lib/seed-plan'
import type { DayType, LoggedSet, Workout, WorkoutEntry } from '#/lib/types'

// Saturday evening.
const now = new Date(2026, 9, 10, 18, 0, 0)

let counter = 0
function workout(
  finishedAt: Date | null,
  dayType: DayType = 'push',
  entries: WorkoutEntry[] = [],
): Workout {
  counter++
  return {
    id: `w${counter}`,
    dayId: `${dayType}-a`,
    dayName: `${dayType} A`,
    dayType,
    startedAt: (finishedAt ?? now).toISOString(),
    finishedAt: finishedAt?.toISOString(),
    status: finishedAt ? 'done' : 'in_progress',
    entries,
  }
}

function benchEntry(sets: LoggedSet[]): WorkoutEntry {
  return {
    exerciseId: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    muscle: 'chest',
    loadType: 'weight',
    repMin: 5,
    repMax: 8,
    sets,
  }
}

function daysAgo(n: number, hour = 12): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

describe('dates', () => {
  it('starts the week on Monday', () => {
    const monday = startOfWeek(now)
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(5)
    expect(monday.getHours()).toBe(0)
  })
})

describe('epley', () => {
  it('estimates a one rep max', () => {
    expect(epley(100, 1)).toBe(100)
    expect(epley(60, 8)).toBe(76)
    expect(epley(0, 8)).toBe(0)
    expect(epley(60, 0)).toBe(0)
  })
})

describe('consistency', () => {
  it('counts only finished sessions in the current week', () => {
    const ws = [
      workout(daysAgo(0)),
      workout(daysAgo(2)),
      workout(daysAgo(8)),
      workout(null),
    ]
    expect(sessionsInWeek(ws, now)).toBe(2)
  })

  it('lays a month out Monday to Sunday with blanks outside the month', () => {
    const ws = [workout(daysAgo(0), 'legs'), workout(daysAgo(3), 'pull')]
    // October 2026 starts on a Thursday and ends on a Saturday.
    const weeks = monthCalendar(ws, now, new Date(2026, 9, 1))
    expect(weeks).toHaveLength(5)
    expect(weeks.every((week) => week.days.length === 7)).toBe(true)
    expect(weeks.map((w) => w.start)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(weeks[0].days.slice(0, 3)).toEqual([null, null, null])
    expect(weeks[0].days[3]).toMatchObject({ date: '2026-10-01', dayOfMonth: 1, future: false })
    expect(new Date(weeks[0].days[3]!.iso).getDate()).toBe(1)
    expect(weeks[1].days[2]).toMatchObject({ date: '2026-10-07', type: 'pull' })
    expect(weeks[1].days[5]).toMatchObject({ date: '2026-10-10', type: 'legs', future: false })
    expect(weeks[1].days[6]).toMatchObject({ date: '2026-10-11', type: null, future: true })
    expect(weeks[4].days[5]).toMatchObject({ dayOfMonth: 31 })
    expect(weeks[4].days[6]).toBeNull()
    // September 2026 starts on a Tuesday, so its first week starts on Monday 31 August.
    const september = monthCalendar([], now, new Date(2026, 8, 1))
    expect(september[0].start).toBe('2026-08-31')
    expect(september[0].days[0]).toBeNull()
    expect(september[0].days[1]).toMatchObject({ date: '2026-09-01' })
    // Days before the join date are marked.
    const joined = monthCalendar(ws, now, new Date(2026, 9, 1), new Date(2026, 9, 3, 9, 30).toISOString())
    expect(joined[0].days[3]).toMatchObject({ date: '2026-10-01', before: true })
    expect(joined[0].days[4]).toMatchObject({ date: '2026-10-02', before: true })
    expect(joined[0].days[5]).toMatchObject({ date: '2026-10-03', before: false })
    expect(weeks[0].days[3]!.before).toBe(false)
  })

  it('counts weeks in a row with a session in each, the current week included once it has one', () => {
    // now is Saturday Oct 10. Two weeks ago and last week each have a session; this week has none yet.
    const ws = [workout(daysAgo(19)), workout(daysAgo(16)), workout(daysAgo(10))]
    expect(weeklyStreak(ws, now)).toBe(2)
    expect(weeklyStreak([...ws, workout(daysAgo(1))], now)).toBe(3)
    // A week without a session breaks it.
    expect(weeklyStreak([workout(daysAgo(19)), workout(daysAgo(1))], now)).toBe(1)
    expect(weeklyStreak([], now)).toBe(0)
  })
})

describe('volume', () => {
  it('counts done sets with reps this week per muscle', () => {
    const ws = [
      workout(daysAgo(1), 'push', [
        benchEntry([
          { weight: 60, reps: 8, done: true },
          { weight: 60, reps: 8, done: true },
          { weight: 60, reps: 0, done: true },
          { weight: 60, reps: 8, done: false },
        ]),
      ]),
      workout(daysAgo(9), 'push', [benchEntry([{ weight: 60, reps: 8, done: true }])]),
    ]
    const v = volumeByMuscleInWeek(ws, now)
    expect(v.chest).toBe(2)
    expect(v.back).toBe(0)
  })

  it('sums the planned sets per muscle, capped at 3 for beginners', () => {
    const plan = seedPlan()
    const over = plannedVolumeByMuscle(plan, 'over1')
    expect(over.chest).toBe(14)
    expect(over.back).toBe(20)
    expect(over.calves).toBe(8)
    const under = plannedVolumeByMuscle(plan, 'under1')
    expect(under.chest).toBe(12)
    expect(under.back).toBe(18)
    expect(under.calves).toBe(6)
  })
})

describe('strength', () => {
  it('returns the best set per session in date order', () => {
    const ws = [
      workout(daysAgo(1), 'push', [
        benchEntry([
          { weight: 62.5, reps: 5, done: true },
          { weight: 62.5, reps: 7, done: true },
        ]),
      ]),
      workout(daysAgo(8), 'push', [benchEntry([{ weight: 60, reps: 8, done: true }])]),
      workout(daysAgo(15), 'push', [benchEntry([{ weight: 60, reps: 8, done: false }])]),
    ]
    const series = strengthSeries(ws, 'barbell-bench-press')
    expect(series).toHaveLength(2)
    expect(series[0].weight).toBe(60)
    expect(series[1].reps).toBe(7)
    expect(series[1].score).toBeCloseTo(62.5 * (1 + 7 / 30))
  })

  it('keeps the best set of each week and numbers the weeks from the first log, gaps included', () => {
    // now is Saturday Oct 10: 1 and 3 days ago sit in the same week, 8 days ago in the one before, 22 days ago two weeks earlier.
    const ws = [
      workout(daysAgo(1), 'push', [benchEntry([{ weight: 62.5, reps: 7, done: true }])]),
      workout(daysAgo(3), 'push', [benchEntry([{ weight: 60, reps: 8, done: true }])]),
      workout(daysAgo(8), 'push', [benchEntry([{ weight: 60, reps: 6, done: true }])]),
      workout(daysAgo(22), 'push', [benchEntry([{ weight: 55, reps: 8, done: true }])]),
    ]
    const weeks = weeklyStrength(ws, 'barbell-bench-press')
    expect(weeks.map((w) => w.weekNo)).toEqual([1, 3, 4])
    expect(weeks.map((w) => w.weight)).toEqual([55, 60, 62.5])
    expect(weeks[2].sessions).toBe(2)
    expect(weeks[2].reps).toBe(7)
    expect(weeks[2].date).toBe(daysAgo(1).toISOString())
    expect(weeklyStrength(ws, 'nothing')).toEqual([])
  })

  it('totals the sets, the weight moved and the minutes of the week', () => {
    const done = workout(daysAgo(1), 'push', [
      benchEntry([
        { weight: 60, reps: 8, done: true },
        { weight: 62.5, reps: 7, done: true },
        { weight: 65, reps: 5, done: false },
      ]),
    ])
    done.startedAt = new Date(new Date(done.finishedAt!).getTime() - 50 * 60_000).toISOString()
    const lastWeek = workout(daysAgo(8), 'push', [benchEntry([{ weight: 100, reps: 10, done: true }])])
    const totals = weekTotals([done, lastWeek], now)
    expect(totals).toEqual({ sets: 2, lifted: 60 * 8 + 62.5 * 7, minutes: 50 })
    expect(weekTotals([], now)).toEqual({ sets: 0, lifted: 0, minutes: 0 })
  })

  it('lists sets that beat every earlier best', () => {
    const ws = [
      workout(daysAgo(20), 'push', [benchEntry([{ weight: 60, reps: 8, done: true }])]),
      workout(daysAgo(6), 'push', [benchEntry([{ weight: 62.5, reps: 8, done: true }])]),
      workout(daysAgo(2), 'push', [benchEntry([{ weight: 62.5, reps: 6, done: true }])]),
    ]
    const prs = recentPRs(ws, now)
    expect(prs).toHaveLength(1)
    expect(prs[0].weight).toBe(62.5)
    expect(prs[0].reps).toBe(8)
  })

  it('does not count a first ever session as a PR', () => {
    const ws = [workout(daysAgo(2), 'push', [benchEntry([{ weight: 60, reps: 8, done: true }])])]
    expect(recentPRs(ws, now)).toHaveLength(0)
  })
})

describe('bodyweight', () => {
  it('compares this week to last week', () => {
    const logs = [
      { id: '1', date: daysAgo(13).toISOString(), weight: 70 },
      { id: '2', date: daysAgo(9).toISOString(), weight: 70.4 },
      { id: '3', date: daysAgo(5).toISOString(), weight: 70.6 },
      { id: '4', date: daysAgo(0).toISOString(), weight: 71 },
    ]
    const t = bodyweightTrend(logs, now)
    expect(t.latest).toBe(71)
    expect(t.weekAvg).toBeCloseTo(70.8)
    expect(t.prevWeekAvg).toBeCloseTo(70.2)
    expect(t.changePct).toBeCloseTo((70.8 - 70.2) / 70.2 * 100)
  })

  it('handles no data', () => {
    const t = bodyweightTrend([], now)
    expect(t.latest).toBeUndefined()
    expect(t.changePct).toBeUndefined()
  })
})
