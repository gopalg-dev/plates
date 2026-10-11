import { describe, expect, it } from 'vitest'
import { assignWeekdays, defaultWeekdays, weekdayView } from '#/lib/logic/schedule'
import { buildSplit } from '#/lib/splits'

// Push / Pull / Legs, six days: Monday to Saturday once weekdays are assigned.
const days = assignWeekdays(buildSplit('ppl6'))

describe('weekday defaults', () => {
  it('spreads sessions over the week, Monday first', () => {
    expect(defaultWeekdays(3)).toEqual([1, 3, 5])
    expect(defaultWeekdays(4)).toEqual([1, 2, 4, 5])
    expect(defaultWeekdays(6)).toEqual([1, 2, 3, 4, 5, 6])
    expect(defaultWeekdays(8)).toEqual([1, 2, 3, 4, 5, 6, 0, 1])
    expect(defaultWeekdays(0)).toEqual([])
  })

  it('fills only the days without a weekday', () => {
    const plan = buildSplit('full3')
    plan[1].weekday = 0
    const out = assignWeekdays(plan)
    expect(out.map((d) => d.weekday)).toEqual([1, 0, 5])
    expect(assignWeekdays(out)).toBe(out)
  })
})

describe('weekday view', () => {
  // Wednesday 7 October 2026, midday.
  const wednesday = new Date(2026, 9, 7, 12)

  it('shows the day that matches the calendar and what was skipped', () => {
    const view = weekdayView(days, wednesday, [{ dayId: 'pull-a', finishedAt: new Date(2026, 9, 5, 19).toISOString() }])
    expect(view.today?.id).toBe('legs-a')
    expect(view.doneToday).toBe(false)
    expect(view.next?.day.id).toBe('pull-b')
    expect(view.next?.inDays).toBe(1)
    // Monday's Pull A was done; Tuesday's Push A was not.
    expect(view.skipped.map((d) => d.id)).toEqual(['push-a'])
  })

  it('knows when today is already done', () => {
    const view = weekdayView(days, wednesday, [{ dayId: 'legs-a', finishedAt: new Date(2026, 9, 7, 9).toISOString() }])
    expect(view.doneToday).toBe(true)
    expect(view.next?.day.id).toBe('pull-b')
  })

  it('shows a rest day with the next session on Sunday', () => {
    const sunday = new Date(2026, 9, 11, 12)
    const view = weekdayView(days, sunday, [])
    expect(view.today).toBeNull()
    expect(view.next?.day.id).toBe('pull-a')
    expect(view.next?.inDays).toBe(1)
    expect(view.skipped).toHaveLength(6)
  })

  it('ignores sessions from last week', () => {
    const view = weekdayView(days, wednesday, [{ dayId: 'push-a', finishedAt: new Date(2026, 8, 29, 19).toISOString() }])
    expect(view.skipped.map((d) => d.id)).toEqual(['pull-a', 'push-a'])
  })
})
