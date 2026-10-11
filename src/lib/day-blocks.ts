import { ex, slug } from './seed-plan'
import type { DayType, Exercise, PlanDay } from './types'

/** What each day type is called on screen. */
export const DAY_LABEL: Record<DayType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  full: 'Full body',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
}

/** A sensible first draft for a day of each type: five lifts, big ones first. Every name is in the library. */
export const DAY_BLOCKS: Record<DayType, () => Exercise[]> = {
  push: () => [
    ex('Barbell Bench Press', 4, 5, 8, 'chest'),
    ex('Incline DB Press', 3, 8, 12, 'chest'),
    ex('Standing Overhead Press', 3, 6, 10, 'shoulders'),
    ex('Lateral Raise', 3, 12, 15, 'shoulders'),
    ex('Rope Pushdown', 3, 10, 15, 'triceps'),
  ],
  pull: () => [
    ex('Pull-ups', 4, 6, 12, 'back', { loadType: 'bodyweight', alternates: ['Lat Pulldown'] }),
    ex('Barbell Row', 4, 6, 10, 'back'),
    ex('Seated Cable Row', 3, 8, 12, 'back'),
    ex('Face Pull', 3, 12, 15, 'shoulders'),
    ex('Barbell Curl', 3, 8, 12, 'biceps'),
  ],
  legs: () => [
    ex('Barbell Squat', 4, 5, 8, 'quads'),
    ex('Romanian Deadlift', 3, 8, 12, 'hamstrings'),
    ex('Leg Press', 3, 10, 15, 'quads'),
    ex('Leg Curl', 3, 10, 15, 'hamstrings'),
    ex('Seated Calf Raise', 4, 12, 15, 'calves'),
  ],
  upper: () => [
    ex('Barbell Bench Press', 4, 5, 8, 'chest'),
    ex('Barbell Row', 4, 6, 10, 'back'),
    ex('Standing Overhead Press', 3, 6, 10, 'shoulders'),
    ex('Lat Pulldown', 3, 8, 12, 'back', { alternates: ['Pull-ups'] }),
    ex('Barbell Curl', 3, 8, 12, 'biceps'),
  ],
  lower: () => [
    ex('Barbell Squat', 4, 5, 8, 'quads'),
    ex('Romanian Deadlift', 3, 8, 12, 'hamstrings'),
    ex('Leg Press', 3, 10, 15, 'quads'),
    ex('Leg Curl', 3, 10, 15, 'hamstrings'),
    ex('Seated Calf Raise', 4, 12, 15, 'calves'),
  ],
  full: () => [
    ex('Barbell Squat', 3, 5, 8, 'quads'),
    ex('Barbell Bench Press', 3, 5, 8, 'chest'),
    ex('Barbell Row', 3, 6, 10, 'back'),
    ex('Standing Overhead Press', 3, 6, 10, 'shoulders'),
    ex('Plank', 3, 30, 45, 'abs', { loadType: 'time' }),
  ],
  chest: () => [
    ex('Barbell Bench Press', 4, 5, 8, 'chest'),
    ex('Incline DB Press', 3, 8, 12, 'chest'),
    ex('Dips', 3, 8, 12, 'triceps', { loadType: 'bodyweight' }),
    ex('Cable Fly', 3, 12, 15, 'chest'),
    ex('Rope Pushdown', 3, 10, 15, 'triceps'),
  ],
  back: () => [
    ex('Pull-ups', 4, 6, 12, 'back', { loadType: 'bodyweight', alternates: ['Lat Pulldown'] }),
    ex('Barbell Row', 4, 6, 10, 'back'),
    ex('Lat Pulldown', 3, 8, 12, 'back'),
    ex('Seated Cable Row', 3, 8, 12, 'back'),
    ex('Face Pull', 3, 12, 15, 'shoulders'),
  ],
  shoulders: () => [
    ex('Standing Overhead Press', 4, 6, 10, 'shoulders'),
    ex('Seated DB Shoulder Press', 3, 8, 12, 'shoulders'),
    ex('Lateral Raise', 4, 12, 15, 'shoulders'),
    ex('Cable Reverse Fly', 3, 12, 15, 'shoulders'),
    ex('Face Pull', 3, 12, 15, 'shoulders'),
  ],
  arms: () => [
    ex('Barbell Curl', 3, 8, 12, 'biceps'),
    ex('Skull Crusher', 3, 8, 12, 'triceps'),
    ex('Hammer Curl', 3, 10, 12, 'biceps'),
    ex('Rope Pushdown', 3, 10, 15, 'triceps'),
    ex('Incline DB Curl', 3, 10, 12, 'biceps'),
  ],
  core: () => [
    ex('Plank', 3, 30, 45, 'abs', { loadType: 'time' }),
    ex('Hanging Leg Raise', 3, 10, 15, 'abs', { loadType: 'bodyweight' }),
    ex('Cable Crunch', 3, 12, 15, 'abs'),
    ex('Side Plank', 3, 30, 45, 'abs', { loadType: 'time' }),
  ],
}

function uniqueId(base: string, taken: string[]): string {
  let id = base
  let n = 2
  while (taken.includes(id)) id = `${base}-${n++}`
  return id
}

/** A new day of one type, named after it ("Push", then "Push 2"), with the block's exercises. */
export function buildDay(type: DayType, existing: PlanDay[]): PlanDay {
  const id = uniqueId(
    slug(DAY_LABEL[type]),
    existing.map((d) => d.id),
  )
  const names = existing.map((d) => d.name)
  let name = DAY_LABEL[type]
  for (let n = 2; names.includes(name); n++) name = `${DAY_LABEL[type]} ${n}`
  return { id, name, type, exercises: DAY_BLOCKS[type]() }
}

/** The days of a plan built from a list of types: repeated types read "Push A", "Push B". */
export function buildCustomDays(types: DayType[]): PlanDay[] {
  const days: PlanDay[] = []
  const counts = new Map<DayType, number>()
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1)
  const seen = new Map<DayType, number>()
  for (const t of types) {
    const nth = (seen.get(t) ?? 0) + 1
    seen.set(t, nth)
    const repeated = (counts.get(t) ?? 0) > 1
    const letter = String.fromCharCode(64 + nth)
    const name = repeated ? `${DAY_LABEL[t]} ${letter}` : DAY_LABEL[t]
    const id = repeated ? `${slug(DAY_LABEL[t])}-${letter.toLowerCase()}` : slug(DAY_LABEL[t])
    days.push({ id, name, type: t, exercises: DAY_BLOCKS[t]() })
  }
  return days
}
