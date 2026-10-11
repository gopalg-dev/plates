import { describe, expect, it } from 'vitest'
import { EQUIPMENT, LIBRARY, findLibrary, imageUrl, searchLibrary } from '#/lib/library'
import { MUSCLES } from '#/lib/logic/stats'

describe('exercise library', () => {
  it('holds a curated set with valid fields', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(130)
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length)
    for (const ex of LIBRARY) {
      expect(ex.id).toMatch(/^[a-z0-9-]+$/)
      expect(MUSCLES).toContain(ex.muscle)
      expect(EQUIPMENT).toContain(ex.equipment)
      expect(['weight', 'bodyweight', 'time']).toContain(ex.loadType)
      expect(ex.cues.length).toBeGreaterThanOrEqual(1)
      expect(ex.image).toMatch(/\.jpg$/)
    }
    expect(imageUrl({ image: 'Barbell_Squat/0.jpg' })).toBe(
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg',
    )
  })

  it('covers the names the templates use', () => {
    for (const name of ['Barbell Bench Press', 'Pull-ups', 'Barbell Squat', 'Romanian Deadlift', 'Lateral Raise', 'Plank']) {
      expect(LIBRARY.some((e) => e.name === name), name).toBe(true)
    }
    expect(findLibrary('plank')?.loadType).toBe('time')
    expect(findLibrary('pull-ups')?.loadType).toBe('bodyweight')
  })

  it('searches by words and narrows by muscle and equipment', () => {
    const rows = searchLibrary({ query: 'row' })
    expect(rows.some((e) => e.name === 'Barbell Row')).toBe(true)
    expect(rows.every((e) => /row/i.test(`${e.name} ${e.muscles.join(' ')}`))).toBe(true)
    expect(searchLibrary({ query: 'incline db press' }).map((e) => e.name)).toContain('Incline DB Press')
    expect(searchLibrary({ muscle: 'calves' }).every((e) => e.muscle === 'calves')).toBe(true)
    expect(searchLibrary({ equipment: 'bodyweight', muscle: 'abs' }).every((e) => e.equipment === 'bodyweight')).toBe(true)
    expect(searchLibrary({ query: 'zzzz' })).toEqual([])
  })
})
