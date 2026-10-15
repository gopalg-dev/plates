import { describe, expect, it } from 'vitest'
import { nextDayId, rollingCursor } from '#/lib/logic/next-day'
import { SEED_DAYS } from '#/lib/seed-plan'

describe('nextDayId', () => {
  it('starts at the first day when nothing is finished yet', () => {
    expect(nextDayId(SEED_DAYS)).toBe('pull-a')
    expect(nextDayId(SEED_DAYS, null)).toBe('pull-a')
  })

  it('moves to the following day', () => {
    expect(nextDayId(SEED_DAYS, 'pull-a')).toBe('push-a')
    expect(nextDayId(SEED_DAYS, 'legs-a')).toBe('pull-b')
  })

  it('wraps around after the last day', () => {
    expect(nextDayId(SEED_DAYS, 'legs-b')).toBe('pull-a')
  })

  it('falls back to the first day for an unknown id', () => {
    expect(nextDayId(SEED_DAYS, 'not-a-day')).toBe('pull-a')
  })

  it('throws on an empty plan', () => {
    expect(() => nextDayId([])).toThrow()
  })
})

describe('rollingCursor', () => {
  const finished = { dayId: 'pull-a', at: '2026-10-13T18:00:00.000Z' }
  const skipped = { dayId: 'push-a', at: '2026-10-15T07:00:00.000Z' }

  it('counts from the last finished session when nothing was skipped', () => {
    expect(rollingCursor(finished)).toBe('pull-a')
    expect(rollingCursor(null)).toBeUndefined()
  })

  it('a skip after the last session moves the order past the skipped day', () => {
    expect(rollingCursor(finished, skipped)).toBe('push-a')
    expect(rollingCursor(null, skipped)).toBe('push-a')
    expect(nextDayId(SEED_DAYS, rollingCursor(finished, skipped))).toBe('legs-a')
  })

  it('a session finished after the skip takes over again', () => {
    const later = { dayId: 'legs-a', at: '2026-10-16T18:00:00.000Z' }
    expect(rollingCursor(later, skipped)).toBe('legs-a')
  })

  it('a session logged for a day before the skip does not undo it', () => {
    const backfilled = { dayId: 'push-a', at: '2026-10-14T12:00:00.000Z' }
    expect(rollingCursor(backfilled, skipped)).toBe('push-a')
    expect(rollingCursor(backfilled, { ...skipped, dayId: 'legs-a' })).toBe('legs-a')
  })
})
