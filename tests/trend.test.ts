import { describe, expect, it } from 'vitest'
import type { WeeklyPoint } from '#/lib/logic/stats'
import { liftTrend } from '#/lib/logic/trend'

const now = new Date(2026, 9, 12, 18, 0, 0)

/** One week per score, the last one `lastDaysAgo` days back, a week apart before that. */
function weeks(scores: number[], lastDaysAgo = 1): WeeklyPoint[] {
  return scores.map((score, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - lastDaysAgo - (scores.length - 1 - i) * 7)
    return { week: '', weekNo: i + 1, date: d.toISOString(), weight: score, reps: 8, seconds: 0, score, sessions: 1 }
  })
}

describe('liftTrend', () => {
  it('is new under three weeks of history', () => {
    expect(liftTrend([], now)).toBe('new')
    expect(liftTrend(weeks([60, 62.5]), now)).toBe('new')
  })

  it('is idle after two weeks without a session, whatever the history', () => {
    expect(liftTrend(weeks([60, 62.5, 65, 67.5], 15), now)).toBe('idle')
    expect(liftTrend(weeks([60, 62.5, 65, 67.5], 14), now)).not.toBe('idle')
  })

  it('climbs when the last four weeks beat what came before', () => {
    expect(liftTrend(weeks([60, 60, 60, 60, 60, 62.5, 62.5, 65]), now)).toBe('climbing')
  })

  it('is stuck when four weeks of training never beat the earlier best', () => {
    expect(liftTrend(weeks([60, 65, 65, 65, 65, 65, 65, 65]), now)).toBe('stuck')
  })

  it('slips when the recent best is clearly under the earlier one', () => {
    expect(liftTrend(weeks([70, 70, 70, 70, 65, 65, 65, 65]), now)).toBe('slipping')
  })

  it('reads the latest week against the earlier ones when everything is inside the window', () => {
    expect(liftTrend(weeks([60, 62.5, 65]), now)).toBe('climbing')
    expect(liftTrend(weeks([65, 65, 65]), now)).toBe('stuck')
    expect(liftTrend(weeks([70, 70, 60]), now)).toBe('slipping')
  })
})
