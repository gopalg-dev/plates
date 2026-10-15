import type { PlanDay, RollMark } from '../types'

/** Rolling order: the day after the last finished one, wrapping around. */
export function nextDayId(days: PlanDay[], lastFinishedDayId?: string | null): string {
  if (days.length === 0) throw new Error('Plan has no days')
  if (!lastFinishedDayId) return days[0].id
  const i = days.findIndex((d) => d.id === lastFinishedDayId)
  if (i === -1) return days[0].id
  return days[(i + 1) % days.length].id
}

/**
 * The day the rolling order counts from: the last finished session, or a day skipped on Today after it. A session
 * logged for an earlier day never outranks a later skip, and a skip is forgotten once a later session is finished.
 */
export function rollingCursor(lastFinished: RollMark | null | undefined, skipped?: RollMark): string | undefined {
  if (!skipped) return lastFinished?.dayId
  if (!lastFinished || skipped.at > lastFinished.at) return skipped.dayId
  return lastFinished.dayId
}
