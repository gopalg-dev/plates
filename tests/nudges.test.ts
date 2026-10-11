import { describe, expect, it } from 'vitest'
import { daysBetween, nudgeFor, snoozeDays } from '#/lib/logic/nudges'

const now = new Date(2026, 9, 10, 18, 0, 0)

function daysAgo(n: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

describe('nudgeFor', () => {
  it('asks for a weigh-in when there is none', () => {
    expect(nudgeFor(null, null, now)?.kind).toBe('weight')
  })

  it('asks for a weigh-in after seven days', () => {
    const n = nudgeFor(daysAgo(7), daysAgo(1), now)
    expect(n?.kind).toBe('weight')
    expect(n?.detail).toBe('Last logged 7 days ago.')
    expect(nudgeFor(daysAgo(6), daysAgo(1), now)).toBeNull()
  })

  it('asks for a baseline tape once the weigh-in is fresh', () => {
    const n = nudgeFor(daysAgo(1), null, now)
    expect(n?.kind).toBe('measure')
    expect(n?.detail).toContain('baseline')
  })

  it('asks for a tape after 28 days', () => {
    expect(nudgeFor(daysAgo(1), daysAgo(28), now)?.kind).toBe('measure')
    expect(nudgeFor(daysAgo(1), daysAgo(27), now)).toBeNull()
  })

  it('stays quiet after "Not now", and the next reminder shows instead', () => {
    const today = { weight: { at: daysAgo(0), times: 1 } }
    expect(nudgeFor(null, null, now, today)?.kind).toBe('measure')
    expect(nudgeFor(daysAgo(10), daysAgo(1), now, today)).toBeNull()
    // The first wait is a day: yesterday's wave-away is over, a second one is not.
    expect(nudgeFor(daysAgo(10), daysAgo(1), now, { weight: { at: daysAgo(1), times: 1 } })?.kind).toBe('weight')
    expect(nudgeFor(daysAgo(10), daysAgo(1), now, { weight: { at: daysAgo(1), times: 2 } })).toBeNull()
    expect(nudgeFor(daysAgo(1), null, now, { measure: { at: daysAgo(6), times: 1 } })).toBeNull()
    expect(nudgeFor(daysAgo(1), null, now, { measure: { at: daysAgo(7), times: 1 } })?.kind).toBe('measure')
  })

  it('forgets a wave-away older than the last log', () => {
    expect(nudgeFor(daysAgo(7), daysAgo(1), now, { weight: { at: daysAgo(8), times: 3 } })?.kind).toBe('weight')
  })

  it('waits longer each time, up to the cadence', () => {
    expect([1, 2, 3, 4, 9].map((n) => snoozeDays('weight', n))).toEqual([1, 2, 4, 7, 7])
    expect([1, 2, 3, 4].map((n) => snoozeDays('measure', n))).toEqual([7, 14, 28, 28])
  })

  it('counts whole days', () => {
    expect(daysBetween(daysAgo(3), now)).toBe(3)
    expect(daysBetween(now.toISOString(), now)).toBe(0)
  })
})
