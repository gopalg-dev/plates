import { describe, expect, it } from 'vitest'
import { FEEDBACK_AFTER_SESSIONS, FEEDBACK_EVERY_DAYS, feedbackDue } from '#/lib/logic/feedback'

const now = new Date('2026-10-11T18:00:00')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

describe('feedback prompt', () => {
  it('waits for a few sessions, then asks once, then not for a month', () => {
    expect(feedbackDue(FEEDBACK_AFTER_SESSIONS - 1, undefined, now)).toBe(false)
    expect(feedbackDue(FEEDBACK_AFTER_SESSIONS, undefined, now)).toBe(true)
    expect(feedbackDue(40, daysAgo(3), now)).toBe(false)
    expect(feedbackDue(40, daysAgo(FEEDBACK_EVERY_DAYS - 1), now)).toBe(false)
    expect(feedbackDue(40, daysAgo(FEEDBACK_EVERY_DAYS), now)).toBe(true)
  })
})
