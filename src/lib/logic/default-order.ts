import { DAY_BLOCKS } from '#/lib/day-blocks'
import type { Exercise, PlanDay } from '#/lib/types'

/**
 * The exercises a day started with: the split's own day when the plan came from a split that still has
 * a day of that id and kind, else the block for the day's kind (days added later, plans of your own).
 */
export function templateExercises(templateDays: PlanDay[] | null, day: PlanDay): Exercise[] {
  return templateDays?.find((d) => d.id === day.id && d.type === day.type)?.exercises ?? DAY_BLOCKS[day.type]()
}

/**
 * The day's exercises in the template's order. A lift swapped for an alternate keeps the slot of the
 * one it replaced; lifts the template never had go last, in the order they are in now.
 */
export function inDefaultOrder(exercises: Exercise[], template: Exercise[]): Exercise[] {
  const slotOf = (ex: Exercise) => {
    const i = template.findIndex((t) => t.id === ex.id || t.name === ex.name || ex.alternates?.includes(t.name))
    return i < 0 ? template.length : i
  }
  return exercises
    .map((ex, at) => ({ ex, at, slot: slotOf(ex) }))
    .sort((a, b) => a.slot - b.slot || a.at - b.at)
    .map(({ ex }) => ex)
}
