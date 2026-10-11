import type { PlanDay } from '../types'

/** Rolling order: the day after the last finished one, wrapping around. */
export function nextDayId(days: PlanDay[], lastFinishedDayId?: string | null): string {
  if (days.length === 0) throw new Error('Plan has no days')
  if (!lastFinishedDayId) return days[0].id
  const i = days.findIndex((d) => d.id === lastFinishedDayId)
  if (i === -1) return days[0].id
  return days[(i + 1) % days.length].id
}
