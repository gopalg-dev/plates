import { describe, expect, it } from 'vitest'
import { nextDayId } from '#/lib/logic/next-day'
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
