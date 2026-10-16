import { describe, expect, it } from 'vitest'
import {
  buildReport,
  daysOf,
  finishedPeriod,
  firstReportOn,
  hasNext,
  history,
  lastFinished,
  periodLabel,
  type ReportData,
  reviewCard,
  shiftPeriod,
} from '#/lib/logic/report'
import type { DayType, LoggedSet, Plan, Workout, WorkoutEntry } from '#/lib/types'

// Tuesday 13 October 2026, evening.
const now = new Date(2026, 9, 13, 18, 0, 0)
const on = (month: number, day: number, hour = 18) => new Date(2026, month, day, hour, 0, 0)

const plan: Plan = {
  updatedAt: 'x',
  days: [
    {
      id: 'push-a',
      name: 'Push A',
      type: 'push',
      exercises: [{ id: 'bench', name: 'Bench', sets: 3, repMin: 5, repMax: 8, muscle: 'chest', loadType: 'weight' }],
    },
    {
      id: 'pull-a',
      name: 'Pull A',
      type: 'pull',
      exercises: [{ id: 'row', name: 'Row', sets: 3, repMin: 6, repMax: 10, muscle: 'back', loadType: 'weight' }],
    },
  ],
}

let counter = 0
function session(at: Date, type: DayType, entries: WorkoutEntry[], effort?: number): Workout {
  counter++
  return {
    id: `w${counter}`,
    dayId: `${type}-a`,
    dayName: `${type} A`,
    dayType: type,
    startedAt: new Date(at.getTime() - 3_600_000).toISOString(),
    finishedAt: at.toISOString(),
    status: 'done',
    entries,
    ...(effort ? { effort } : {}),
  }
}

/** Three sets at one weight; the last one carries the reps left when given. */
function lift(
  id: string,
  muscle: 'chest' | 'back' | 'quads',
  weight: number,
  reps: number,
  left?: number,
): WorkoutEntry {
  const set = (last: boolean): LoggedSet => ({
    weight,
    reps,
    done: true,
    ...(last && left !== undefined ? { left } : {}),
  })
  return {
    exerciseId: id,
    name: id[0].toUpperCase() + id.slice(1),
    muscle,
    loadType: 'weight',
    repMin: 5,
    repMax: 8,
    sets: [set(false), set(false), set(true)],
  }
}

const data: ReportData = {
  settings: { trainingAge: 'over1', schedule: 'rolling' },
  plan,
  workouts: [
    // July: a squat best that August and September stay under.
    session(on(6, 20), 'legs', [lift('squat', 'quads', 100, 5)], 2),
    session(on(7, 10), 'push', [lift('bench', 'chest', 60, 8)], 2),
    session(on(7, 20), 'push', [lift('bench', 'chest', 60, 8), lift('squat', 'quads', 80, 5)], 2),
    session(on(8, 7), 'push', [lift('bench', 'chest', 62.5, 8, 1)], 2),
    session(on(8, 14), 'pull', [lift('row', 'back', 50, 8)], 4),
    session(on(8, 21), 'push', [lift('bench', 'chest', 65, 6, 0), lift('squat', 'quads', 90, 5)], 3),
    // October: a heavier bench that must not show as a September best.
    session(on(9, 1), 'push', [lift('bench', 'chest', 70, 8)], 2),
  ],
  bodyweights: [
    { id: 'b1', date: on(7, 25).toISOString(), weight: 70 },
    { id: 'b2', date: on(7, 28).toISOString(), weight: 70 },
    { id: 'b3', date: on(8, 25).toISOString(), weight: 71 },
    { id: 'b4', date: on(8, 28).toISOString(), weight: 71 },
  ],
}

describe('finished periods', () => {
  it('runs a week Monday to Sunday, against the week before', () => {
    const p = finishedPeriod('week', on(9, 7), now)
    expect(p.start).toEqual(new Date(2026, 9, 5))
    expect(p.end).toEqual(new Date(2026, 9, 12))
    expect(p.prevStart).toEqual(new Date(2026, 8, 28))
    expect(p.prevEnd).toEqual(new Date(2026, 9, 5))
    expect(periodLabel(p)).toBe('Oct 5 – 11')
    expect(periodLabel(finishedPeriod('week', on(8, 30), now))).toBe('Sep 28 – Oct 4')
    expect(periodLabel(finishedPeriod('month', on(8, 15), now))).toBe('September 2026')
  })

  it('reports only on finished periods: the one running now gives the last finished one', () => {
    expect(lastFinished('week', now)).toEqual(new Date(2026, 9, 5))
    expect(lastFinished('month', now)).toEqual(new Date(2026, 8, 1))
    // Tuesday 13 Oct is in the running week; its month, October, is still running too.
    expect(finishedPeriod('week', now, now).start).toEqual(new Date(2026, 9, 5))
    expect(finishedPeriod('month', now, now).start).toEqual(new Date(2026, 8, 1))
    expect(finishedPeriod('month', new Date(2027, 0, 1), now).start).toEqual(new Date(2026, 8, 1))
    // The arrows stop at the last finished period.
    expect(hasNext(finishedPeriod('week', on(9, 7), now), now)).toBe(false)
    expect(hasNext(finishedPeriod('week', on(8, 30), now), now)).toBe(true)
    expect(shiftPeriod('month', new Date(2026, 0, 15), -1)).toEqual(new Date(2025, 11, 1))
  })

  it('says when the first report comes for someone with no finished period yet', () => {
    // Sessions before this week and month exist, so a report already has something to show.
    expect(firstReportOn('week', now, data.workouts)).toBeNull()
    // Only sessions in the running week: the report comes when it ends, Monday 19 Oct, or on 1 Nov for a month.
    const thisWeek = [session(on(9, 12), 'push', [lift('bench', 'chest', 60, 8)], 2)]
    expect(firstReportOn('week', now, thisWeek)).toEqual(new Date(2026, 9, 19))
    expect(firstReportOn('month', now, thisWeek)).toEqual(new Date(2026, 10, 1))
    expect(firstReportOn('week', now, [])).toEqual(new Date(2026, 9, 19))
  })
})

describe('report', () => {
  const september = buildReport(data, finishedPeriod('month', on(8, 15), now))

  it('counts sessions against the plan, and hard sets, against the month before', () => {
    // Two plan days a week over September's 30 days.
    expect(september.sessions).toEqual({ done: 3, prev: 2, planned: 9 })
    // Twelve sets in September; nine in August.
    expect(september.sets).toEqual({ now: 12, prev: 9 })
  })

  it("keeps the period's bests inside it, and names the lifts that beat the month before", () => {
    expect(september.bests.map((p) => [p.name, p.weight, p.reps])).toEqual([['Bench', 62.5, 8]])
    // August's two benches were the first and a repeat, and its squat sat under July's: no new best.
    expect(september.prevBestCount).toBe(0)
    // The bench is listed with its best, not again as a mover; the squat beat August without a best of its own.
    expect(september.movers.map((m) => [m.to.name, m.from.weight, m.to.weight])).toEqual([['Squat', 80, 90]])
    expect(september.movers[0].changePct).toBeCloseTo(12.5, 1)
  })

  it('flags muscles clearly under their weekly target and a session rated too much, and counts the effort', () => {
    // Under 90% of the target counts; the week of 7 – 13 has the bench's three sets against three planned.
    expect(buildReport(data, finishedPeriod('week', on(8, 7), now)).attention.under.map((m) => m.muscle)).toEqual([
      'back',
    ])
    expect(september.attention.under.map((m) => [m.muscle, m.perWeek, m.target])).toEqual([
      ['chest', 1.4, 3],
      ['back', 0.7, 3],
    ])
    expect(september.attention.tooMuch).toBe(1)
    expect(september.attention.stuck).toEqual([])
    expect(september.effort.counts).toEqual([0, 1, 1, 1])
    expect(september.effort.prevCounts).toEqual([0, 2, 0, 0])
    expect(september.effort.left).toBe(0.5)
  })

  it('reads bodyweight as the 7-day average going into the period and out of it', () => {
    expect(september.bodyweight).toEqual({ from: 70, to: 71 })
    expect(buildReport({ ...data, bodyweights: [] }, finishedPeriod('month', on(8, 15), now)).bodyweight).toBeNull()
  })

  it('needs three sessions for a month and one for a week', () => {
    expect(september.enough).toBe(true)
    expect(buildReport(data, finishedPeriod('month', on(7, 15), now)).enough).toBe(false)
    expect(buildReport(data, finishedPeriod('week', on(8, 7), now)).enough).toBe(true)
  })

  it('asks for planned sessions from the join date, not from the first of the month', () => {
    const joined = { ...data, settings: { ...data.settings, joinedAt: on(8, 22, 18).toISOString() } }
    // Nine days of September at the plan's rate, instead of thirty.
    expect(buildReport(joined, finishedPeriod('month', on(8, 15), now)).sessions.planned).toBe(3)
    expect(buildReport(data, finishedPeriod('month', on(8, 15), now)).sessions.planned).toBe(9)
  })

  it('counts the periods in a row with a session, this one included', () => {
    // Sessions in the weeks of Oct 5 and Sep 28, a gap, then Sep 14: two in a row.
    const workouts = [session(on(9, 6), 'push', []), session(on(8, 30), 'pull', []), session(on(8, 15), 'push', [])]
    expect(buildReport({ ...data, workouts }, finishedPeriod('week', on(9, 6), now)).streak).toBe(2)
    expect(buildReport({ ...data, workouts }, finishedPeriod('week', on(8, 22), now)).streak).toBe(0)
    expect(buildReport({ ...data, workouts }, finishedPeriod('month', on(8, 15), now)).streak).toBe(1)
    expect(buildReport(data, finishedPeriod('week', on(8, 2), now)).enough).toBe(false)
  })
})

describe('charts and calendar', () => {
  it('runs eight weeks or six months up to the period, the period last', () => {
    const weeks = history(data, finishedPeriod('week', on(8, 7), now))
    expect(weeks).toHaveLength(8)
    expect(weeks.at(-1)).toMatchObject({ label: 'Sep 7', sessions: 1, sets: 3, current: true })
    expect(weeks[0]).toMatchObject({ label: 'Jul 20', sessions: 1, current: false })
    const months = history(data, finishedPeriod('month', on(8, 15), now))
    expect(months.map((m) => [m.label, m.sessions])).toEqual([
      ['Apr', 0],
      ['May', 0],
      ['Jun', 0],
      ['Jul', 1],
      ['Aug', 2],
      ['Sep', 3],
    ])
    expect(months.at(-1)?.weight).toBe(71)
  })

  it("lists the period's days with what was trained on each", () => {
    const week = daysOf(finishedPeriod('week', on(8, 7), now), data.workouts)
    expect(week).toHaveLength(7)
    expect(week[0]).toMatchObject({ key: '2026-09-07', dayType: 'push', dayTypes: ['push'], dayName: 'push A' })
    expect(week[1]).toMatchObject({ key: '2026-09-08', dayType: null, dayTypes: [] })
    expect(daysOf(finishedPeriod('month', on(8, 15), now), data.workouts).filter((d) => d.dayType)).toHaveLength(3)
    // A second session the same day, done later: the first keeps the cell, both are listed in order.
    const later = session(new Date(2026, 8, 7, 19), 'pull', [])
    const doubled = daysOf(finishedPeriod('week', on(8, 7), now), [...data.workouts, later])
    expect(doubled[0]).toMatchObject({
      key: '2026-09-07',
      dayType: 'push',
      dayTypes: ['push', 'pull'],
      dayName: 'push A',
    })
  })
})

describe('review card', () => {
  it('announces the week just finished on its first two days, when it had a session', () => {
    // Monday 14 September: the week of 7 – 13 had the 62.5 kg bench.
    const monday = new Date(2026, 8, 14, 9)
    expect(reviewCard('week', monday, data)).toEqual({
      kind: 'week',
      title: 'Week of Sep 7 – 13',
      detail: '1 of 2 sessions, 1 new best',
      at: '2026-09-07',
    })
    expect(reviewCard('week', new Date(2026, 8, 15, 9), data)?.at).toBe('2026-09-07')
    expect(reviewCard('week', new Date(2026, 8, 16, 9), data)).toBeNull()
    // Monday 12 October: the week before had no session, so nothing to announce.
    expect(reviewCard('week', new Date(2026, 9, 12, 9), data)).toBeNull()
  })

  it('announces the month just finished on its first two days', () => {
    expect(reviewCard('month', on(9, 1, 9), data)).toEqual({
      kind: 'month',
      title: 'September 2026',
      detail: '3 of 9 sessions, 1 new best',
      at: '2026-09-01',
    })
    expect(reviewCard('month', on(9, 3, 9), data)).toBeNull()
  })
})
