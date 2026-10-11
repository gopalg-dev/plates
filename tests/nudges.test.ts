import { describe, expect, it } from 'vitest'
import { daysBetween, nudgeFor } from '#/lib/logic/nudges'

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

  it('counts whole days', () => {
    expect(daysBetween(daysAgo(3), now)).toBe(3)
    expect(daysBetween(now.toISOString(), now)).toBe(0)
  })
})
