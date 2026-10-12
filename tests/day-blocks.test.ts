import { describe, expect, it } from 'vitest'
import { buildCustomDays, buildDay, DAY_BLOCKS, DAY_LABEL } from '#/lib/day-blocks'
import { LIBRARY } from '#/lib/library'
import { DAY_TYPES, MAX_EXERCISES_PER_DAY } from '#/lib/types'

describe('day blocks', () => {
  it('has a block for every day type, every lift in the library, within the day cap', () => {
    const names = new Set(LIBRARY.map((e) => e.name))
    for (const t of DAY_TYPES) {
      const block = DAY_BLOCKS[t]()
      expect(block.length, t).toBeGreaterThanOrEqual(4)
      expect(block.length, t).toBeLessThanOrEqual(MAX_EXERCISES_PER_DAY)
      for (const e of block) expect(names.has(e.name), `${t}: ${e.name}`).toBe(true)
      for (const alt of block.flatMap((e) => e.alternates ?? [])) expect(names.has(alt), alt).toBe(true)
      expect(new Set(block.map((e) => e.id)).size).toBe(block.length)
    }
  })

  it('names a new day after its kind and numbers a repeat', () => {
    const first = buildDay('push', [])
    expect(first).toMatchObject({ id: 'push', name: 'Push', type: 'push' })
    expect(first.exercises[0].name).toBe('Barbell Bench Press')
    const second = buildDay('push', [first])
    expect(second).toMatchObject({ id: 'push-2', name: 'Push 2' })
    const third = buildDay('full', [first, second])
    expect(third).toMatchObject({ id: 'full-body', name: DAY_LABEL.full })
  })

  it('builds a plan of your own with lettered names only where a kind repeats', () => {
    const days = buildCustomDays(['upper', 'lower', 'upper', 'lower', 'arms'])
    expect(days.map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Arms'])
    expect(days.map((d) => d.id)).toEqual(['upper-a', 'lower-a', 'upper-b', 'lower-b', 'arms'])
    expect(days.every((d) => d.exercises.length > 0)).toBe(true)
    // Each day gets its own copy of the block.
    days[0].exercises[0].sets = 9
    expect(days[2].exercises[0].sets).toBe(4)
  })
})
