import { describe, expect, it } from 'vitest'
import { EQUIPMENT, findLibrary, imageUrl, LIBRARY, searchLibrary } from '#/lib/library'
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
      // The start and the end of the movement, both in the same source folder.
      expect(ex.images).toHaveLength(2)
      expect(ex.images[0]).toMatch(/^[^/]+\/0\.jpg$/)
      expect(ex.images[1]).toBe(ex.images[0].replace(/0\.jpg$/, '1.jpg'))
      // The usual sets and range: a swap, a pick and a new exercise start from them.
      expect(ex.sets).toBeGreaterThanOrEqual(1)
      expect(ex.sets).toBeLessThanOrEqual(5)
      expect(ex.repMin).toBeGreaterThanOrEqual(1)
      expect(ex.repMax).toBeGreaterThanOrEqual(ex.repMin)
      // Holds count seconds; everything else stays in a rep range a set can be done for.
      if (ex.loadType === 'time') expect(ex.repMin).toBeGreaterThanOrEqual(20)
      else expect(ex.repMax).toBeLessThanOrEqual(20)
    }
    // Heavy barbell lifts low, machines in the middle, small lifts high.
    expect(findLibrary(LIBRARY, 'barbell-squat')).toMatchObject({ sets: 4, repMin: 5, repMax: 8 })
    expect(findLibrary(LIBRARY, 'hack-squat')).toMatchObject({ sets: 3, repMin: 8, repMax: 12 })
    expect(findLibrary(LIBRARY, 'lateral-raise')).toMatchObject({ sets: 3, repMin: 12, repMax: 15 })
    expect(findLibrary(LIBRARY, 'plank')).toMatchObject({ sets: 3, repMin: 30, repMax: 45 })
    const squat = { images: ['Barbell_Squat/0.jpg', 'Barbell_Squat/1.jpg'] }
    expect(imageUrl(squat)).toBe(
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg',
    )
    expect(imageUrl(squat, 'end')).toBe(
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/1.jpg',
    )
  })

  it('covers the names the templates use', () => {
    for (const name of [
      'Barbell Bench Press',
      'Pull-ups',
      'Barbell Squat',
      'Romanian Deadlift',
      'Lateral Raise',
      'Plank',
    ]) {
      expect(
        LIBRARY.some((e) => e.name === name),
        name,
      ).toBe(true)
    }
    expect(findLibrary(LIBRARY, 'plank')?.loadType).toBe('time')
    expect(findLibrary(LIBRARY, 'pull-ups')?.loadType).toBe('bodyweight')
  })

  it('searches by words and narrows by muscle and equipment', () => {
    const rows = searchLibrary({ query: 'row' }, LIBRARY)
    expect(rows.some((e) => e.name === 'Barbell Row')).toBe(true)
    expect(rows.every((e) => /row/i.test(`${e.name} ${e.muscles.join(' ')}`))).toBe(true)
    expect(searchLibrary({ query: 'incline db press' }, LIBRARY).map((e) => e.name)).toContain('Incline DB Press')
    expect(searchLibrary({ muscle: 'calves' }, LIBRARY).every((e) => e.muscle === 'calves')).toBe(true)
    expect(
      searchLibrary({ equipment: 'bodyweight', muscle: 'abs' }, LIBRARY).every((e) => e.equipment === 'bodyweight'),
    ).toBe(true)
    expect(searchLibrary({ query: 'zzzz' }, LIBRARY)).toEqual([])
  })
})
