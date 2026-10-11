import { describe, expect, it } from 'vitest'
import {
  guessLoad,
  guessMuscle,
  parseReps,
  parseRows,
  planToRows,
  splitFromMarker,
  templateMarker,
  templateTitle,
} from '#/lib/logic/plan-sheet'
import { seedPlan } from '#/lib/seed-plan'

describe('parseReps', () => {
  it('reads ranges, single numbers, and seconds', () => {
    expect(parseReps('6-10').range).toEqual({ min: 6, max: 10 })
    expect(parseReps('6–10').range).toEqual({ min: 6, max: 10 })
    expect(parseReps('12').range).toEqual({ min: 12, max: 12 })
    expect(parseReps(12).range).toEqual({ min: 12, max: 12 })
    expect(parseReps('45-60 s').range).toEqual({ min: 45, max: 60 })
    expect(parseReps('10 each leg').range).toEqual({ min: 10, max: 10 })
    expect(parseReps('').range).toBeUndefined()
  })

  it('recovers a range Excel turned into a date', () => {
    const r = parseReps(new Date(2026, 5, 10))
    expect(r.range).toEqual({ min: 6, max: 10 })
    expect(r.fromDate).toBe(true)
  })
})

describe('guessing', () => {
  it('guesses muscles from names', () => {
    expect(guessMuscle('Leg Curl', 'legs')).toBe('hamstrings')
    expect(guessMuscle('Leg Extension', 'legs')).toBe('quads')
    expect(guessMuscle('Overhead Triceps Extension', 'push')).toBe('triceps')
    expect(guessMuscle('Standing Overhead Press', 'push')).toBe('shoulders')
    expect(guessMuscle('Cable Reverse Fly', 'pull')).toBe('shoulders')
    expect(guessMuscle('Low-to-High Cable Fly', 'push')).toBe('chest')
    expect(guessMuscle('Hanging Leg Raise', 'legs')).toBe('abs')
    expect(guessMuscle('Lateral Raise', 'push')).toBe('shoulders')
    expect(guessMuscle('Leg Press Calf Raise', 'legs')).toBe('calves')
    expect(guessMuscle('Mystery Machine', 'pull')).toBe('back')
  })

  it('guesses load types', () => {
    expect(guessLoad('Pull-ups', '6-12')).toBe('bodyweight')
    expect(guessLoad('Weighted Dips', '6-10')).toBe('weight')
    expect(guessLoad('Barbell Rollout', '8-12')).toBe('bodyweight')
    expect(guessLoad('Plank', '45-60')).toBe('time')
    expect(guessLoad('Hanging L-sit hold', '20-30 s')).toBe('time')
    expect(guessLoad('Barbell Row', '6-10')).toBe('weight')
  })
})

describe('template marker', () => {
  it('reads the split id from the Template sheet or the Guide title, and nothing from a plain file', () => {
    const ul4 = { id: 'ul4' as const, name: 'Upper / Lower', days: 4 }
    expect(splitFromMarker(templateMarker(ul4))).toBe('ul4')
    expect(splitFromMarker([[templateTitle(ul4)]])).toBe('ul4')
    expect(templateTitle(ul4)).toBe('Template: Upper / Lower, 4 days (ul4)')
    expect(splitFromMarker([['Split', 'nope'], ['How to fill the Plan sheet']])).toBeUndefined()
    expect(splitFromMarker([])).toBeUndefined()
  })
})

describe('parseRows', () => {
  it('round-trips the seed plan through the template', () => {
    const plan = seedPlan()
    const rows = planToRows(plan)
    expect(rows).toHaveLength(36)
    const parsed = parseRows(rows)
    expect(parsed.warnings).toEqual([])
    expect(parsed.days.map((d) => d.id)).toEqual(plan.days.map((d) => d.id))
    for (let i = 0; i < plan.days.length; i++) {
      const a = plan.days[i]
      const b = parsed.days[i]
      expect(b.name).toBe(a.name)
      expect(b.type).toBe(a.type)
      expect(b.exercises.map((e) => [e.id, e.name, e.sets, e.repMin, e.repMax, e.muscle, e.loadType])).toEqual(
        a.exercises.map((e) => [e.id, e.name, e.sets, e.repMin, e.repMax, e.muscle, e.loadType]),
      )
      expect(b.exercises.map((e) => e.alternates ?? [])).toEqual(a.exercises.map((e) => e.alternates ?? []))
      expect(b.exercises.map((e) => e.note ?? '')).toEqual(a.exercises.map((e) => e.note ?? ''))
    }
  })

  it('carries the day name down blank cells and guesses what is blank', () => {
    const parsed = parseRows([
      { Day: 'Upper', Exercise: 'Bench Press', Sets: 4, Reps: '5-8' },
      { Day: '', Exercise: 'Chin-ups', Sets: 3, Reps: '6-10' },
      { Day: '', Exercise: 'Plank', Sets: 3, Reps: '45 s' },
      { Day: 'Lower', Exercise: 'Back Squat', Sets: 4, Reps: 6 },
    ])
    expect(parsed.warnings).toEqual([])
    expect(parsed.days).toHaveLength(2)
    const [upper, lower] = parsed.days
    expect(upper.type).toBe('upper')
    expect(upper.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Chin-ups', 'Plank'])
    expect(upper.exercises[1].loadType).toBe('bodyweight')
    expect(upper.exercises[1].muscle).toBe('back')
    expect(upper.exercises[2].loadType).toBe('time')
    expect(upper.exercises[2].repMin).toBe(45)
    expect(lower.type).toBe('lower')
    expect(lower.exercises[0].muscle).toBe('quads')
    expect(lower.exercises[0].repMax).toBe(6)
  })

  it('accepts other header names and separate low and high columns', () => {
    const parsed = parseRows([
      { Workout: 'Push', Movement: 'Incline Press', Set: '3', 'Reps low': 8, 'Reps high': 12, 'Muscle group': 'Pecs', Kind: 'Weighted' },
    ])
    expect(parsed.warnings).toEqual([])
    const ex = parsed.days[0].exercises[0]
    expect(ex.name).toBe('Incline Press')
    expect(ex.sets).toBe(3)
    expect(ex.repMin).toBe(8)
    expect(ex.repMax).toBe(12)
    expect(ex.muscle).toBe('chest')
    expect(ex.loadType).toBe('weight')
  })

  it('reports rows it cannot use and fills gaps with defaults', () => {
    const parsed = parseRows([
      { Day: '', Exercise: 'Orphan', Sets: 3, Reps: '8-12' },
      { Day: 'Pull', Exercise: '', Sets: 3, Reps: '8-12' },
      { Day: '', Exercise: 'Row', Sets: '', Reps: '' },
      { Day: '', Exercise: 'Curl', Sets: 3, Reps: new Date(2026, 7, 12) },
      { Day: '', Exercise: '', Sets: '', Reps: '' },
      { Day: '', Exercise: '', Sets: 3, Reps: '8-12' },
    ])
    expect(parsed.days).toHaveLength(1)
    expect(parsed.days[0].exercises.map((e) => [e.name, e.sets, e.repMin, e.repMax])).toEqual([
      ['Row', 3, 8, 12],
      ['Curl', 3, 8, 12],
    ])
    const messages = parsed.warnings.map((w) => `${w.row}: ${w.message}`)
    expect(messages).toEqual([
      '2: No day name above this row, row skipped.',
      '3: No exercise name, row skipped.',
      '4: Sets missing for Row, used 3.',
      '4: Reps missing for Row, used 8-12.',
      '5: Reps for Curl looked like a date. Read it as 8-12. Check it.',
      '7: No exercise name, row skipped.',
    ])
  })

  it('keeps ids unique inside a day and across days', () => {
    const parsed = parseRows([
      { Day: 'Push', Exercise: 'Lateral Raise', Sets: 3, Reps: '12-15' },
      { Day: '', Exercise: 'Lateral Raise', Sets: 3, Reps: '15-20' },
      { Day: 'Push', Exercise: 'Bench', Sets: 3, Reps: '5-8' },
      { Day: 'push', Exercise: 'Fly', Sets: 3, Reps: '12-15' },
    ])
    expect(parsed.days).toHaveLength(1)
    expect(parsed.days[0].exercises.map((e) => e.id)).toEqual(['lateral-raise', 'lateral-raise-2', 'bench', 'fly'])
  })

  it('warns when nothing usable is found', () => {
    const parsed = parseRows([{ Foo: 'bar' }])
    expect(parsed.days).toEqual([])
    expect(parsed.warnings[0].message).toContain('No exercises found')
  })
})
