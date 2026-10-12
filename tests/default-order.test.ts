import { describe, expect, it } from 'vitest'
import { DAY_BLOCKS } from '#/lib/day-blocks'
import { inDefaultOrder, templateExercises } from '#/lib/logic/default-order'
import type { PlanDay } from '#/lib/types'

const push = () => DAY_BLOCKS.push()
const names = (list: { name: string }[]) => list.map((e) => e.name)

describe('default order', () => {
  it('puts a shuffled day back in the template order', () => {
    const template = push()
    const shuffled = [...push()].reverse()
    expect(names(inDefaultOrder(shuffled, template))).toEqual(names(template))
  })

  it('keeps a swapped lift in the slot of the one it replaced, and added lifts last in their order', () => {
    const template = push()
    const [bench, incline, ohp, lateral, pushdown] = push()
    const dips = { ...incline, id: 'weighted-dips', name: 'Weighted Dips', alternates: [incline.name] }
    const chestDips = { ...bench, id: 'chest-dips', name: 'Chest Dips', alternates: [] }
    const facePull = { ...lateral, id: 'face-pull', name: 'Face Pull', alternates: [] }
    const day = [chestDips, pushdown, facePull, dips, ohp, bench, lateral]
    expect(names(inDefaultOrder(day, template))).toEqual([
      'Barbell Bench Press',
      'Weighted Dips',
      'Standing Overhead Press',
      'Lateral Raise',
      'Rope Pushdown',
      'Chest Dips',
      'Face Pull',
    ])
  })

  it("takes the split's own day when it has one of that id and kind, else the kind's block", () => {
    const day: PlanDay = { id: 'push-a', name: 'Push A', type: 'push', exercises: push() }
    const split: PlanDay[] = [{ ...day, exercises: push().slice(0, 2) }]
    expect(templateExercises(split, day)).toHaveLength(2)
    expect(names(templateExercises(split, { ...day, id: 'push-2' }))).toEqual(names(push()))
    expect(names(templateExercises(split, { ...day, type: 'pull' }))).toEqual(names(DAY_BLOCKS.pull()))
    expect(names(templateExercises(null, day))).toEqual(names(push()))
  })
})
