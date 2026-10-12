import { describe, expect, it } from 'vitest'
import { MUSCLES } from '#/lib/logic/stats'
import { buildSplit, DEFAULT_SPLIT, SPLITS, splitInfo } from '#/lib/splits'
import { DAY_TYPES, MAX_EXERCISES_PER_DAY, SPLIT_IDS } from '#/lib/types'

describe('split templates', () => {
  it('lists every template once, the default first', () => {
    expect(SPLITS.map((s) => s.id)).toEqual([...SPLIT_IDS])
    expect(SPLITS[0].id).toBe(DEFAULT_SPLIT)
    expect(splitInfo('ul4').days).toBe(4)
  })

  it.each(SPLITS)('$name builds $days valid days', ({ id, days }) => {
    const plan = buildSplit(id)
    expect(plan).toHaveLength(days)
    expect(new Set(plan.map((d) => d.id)).size).toBe(days)
    for (const day of plan) {
      expect(day.name.length).toBeGreaterThan(0)
      expect(DAY_TYPES).toContain(day.type)
      expect(day.exercises.length).toBeGreaterThanOrEqual(5)
      expect(day.exercises.length).toBeLessThanOrEqual(MAX_EXERCISES_PER_DAY)
      expect(new Set(day.exercises.map((e) => e.id)).size).toBe(day.exercises.length)
      for (const e of day.exercises) {
        expect(e.id).toMatch(/^[a-z0-9-]+$/)
        expect(MUSCLES).toContain(e.muscle)
        expect(e.sets).toBeGreaterThanOrEqual(1)
        expect(e.repMin).toBeGreaterThanOrEqual(1)
        expect(e.repMax).toBeGreaterThanOrEqual(e.repMin)
      }
    }
  })

  it('hands out fresh copies', () => {
    const a = buildSplit('full3')
    a[0].exercises[0].sets = 99
    expect(buildSplit('full3')[0].exercises[0].sets).not.toBe(99)
    expect(buildSplit('ppl6')[0].exercises[0].name).toBe('Pull-ups')
  })
})
