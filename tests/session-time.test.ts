import { describe, expect, it } from 'vitest'
import { activeMinutes, activeMs, elapsedLabel, setPaused } from '#/lib/logic/session-time'

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 14, 18, minutes)).toISOString()
const now = (minutes: number) => new Date(Date.UTC(2026, 9, 14, 18, minutes))

describe('activeMs', () => {
  it('counts from the start to now, or to the finish', () => {
    expect(activeMs({ startedAt: at(0) }, now(42))).toBe(42 * 60_000)
    expect(activeMs({ startedAt: at(0), finishedAt: at(50) }, now(90))).toBe(50 * 60_000)
  })

  it('takes earlier pauses and a running pause out', () => {
    expect(activeMs({ startedAt: at(0), pausedMs: 5 * 60_000 }, now(42))).toBe(37 * 60_000)
    expect(activeMs({ startedAt: at(0), pausedMs: 5 * 60_000, pausedAt: at(30) }, now(42))).toBe(25 * 60_000)
    // A session finished while paused stops counting at the finish.
    expect(activeMs({ startedAt: at(0), pausedAt: at(30), finishedAt: at(40) }, now(90))).toBe(30 * 60_000)
  })

  it('never goes below zero', () => {
    expect(activeMs({ startedAt: at(10) }, now(5))).toBe(0)
    expect(activeMinutes({ startedAt: at(0), pausedMs: 60 * 60_000 }, now(5))).toBe(0)
  })
})

describe('elapsedLabel', () => {
  it('reads in minutes, then hours and minutes', () => {
    expect(elapsedLabel(0)).toBe('0 min')
    expect(elapsedLabel(42 * 60_000 + 59_000)).toBe('42 min')
    expect(elapsedLabel(60 * 60_000)).toBe('1 h')
    expect(elapsedLabel(65 * 60_000)).toBe('1 h 5 min')
  })
})

describe('setPaused', () => {
  it('starts a pause, and a second pause changes nothing', () => {
    const paused = setPaused({}, true, now(30))
    expect(paused).toEqual({ pausedMs: 0, pausedAt: at(30) })
    expect(setPaused(paused, true, now(35))).toEqual(paused)
  })

  it('ends a pause by adding its length to the total, and a second resume changes nothing', () => {
    const resumed = setPaused({ pausedMs: 60_000, pausedAt: at(30) }, false, now(35))
    expect(resumed).toEqual({ pausedMs: 6 * 60_000 })
    expect(setPaused(resumed, false, now(40))).toEqual(resumed)
  })
})
