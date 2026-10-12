import { DEFAULT_SPLIT, type SplitInfo, type SplitTemplate } from './content'
import { ex, SEED_DAYS } from './seed-plan'
import type { DayType, Exercise, PlanDay, SplitId } from './types'

// The templates that ship with the app. They seed the `splits` collection; the app reads from there.

export { DEFAULT_SPLIT, type SplitInfo }

/** The picker order: the default first, then by sessions per week. */
export const SPLITS: SplitInfo[] = [
  { id: 'ppl6', name: 'Push / Pull / Legs', days: 6, fit: 'Six sessions a week, every muscle twice. The default.' },
  {
    id: 'ppl3',
    name: 'Push / Pull / Legs, 3 days',
    days: 3,
    fit: 'Three sessions, each muscle once, the big lifts first.',
  },
  {
    id: 'pplul5',
    name: 'Push / Pull / Legs + Upper / Lower',
    days: 5,
    fit: 'Five sessions, every muscle twice, with a lighter upper and lower day.',
  },
  { id: 'ul4', name: 'Upper / Lower', days: 4, fit: 'Four sessions, every muscle twice, each session a bit longer.' },
  { id: 'phul4', name: 'PHUL', days: 4, fit: 'Four sessions: two heavy for strength, two for size.' },
  { id: 'ulf3', name: 'Upper / Lower / Full body', days: 3, fit: 'Three sessions with a full-body day to catch up.' },
  {
    id: 'full3',
    name: 'Full body',
    days: 3,
    fit: 'Three short sessions, everything every time. Good for a first year.',
  },
  { id: 'bro5', name: 'One muscle a day', days: 5, fit: 'Five sessions, one muscle each, lots of sets per muscle.' },
  {
    id: 'arnold6',
    name: 'Arnold split',
    days: 6,
    fit: 'Six sessions: chest with back, shoulders with arms, legs alone.',
  },
]

export function splitInfo(id: SplitId): SplitInfo {
  return SPLITS.find((s) => s.id === id) ?? SPLITS[0]
}

function day(id: string, name: string, type: DayType, exercises: Exercise[]): PlanDay {
  return { id, name, type, exercises }
}

function seedDay(id: string): PlanDay {
  const found = SEED_DAYS.find((d) => d.id === id)
  if (!found) throw new Error(`No seed day ${id}`)
  return found
}

// ---- building blocks shared by several templates ----

const upperA = () =>
  day('upper-a', 'Upper A', 'upper', [
    ex('Barbell Bench Press', 4, 5, 8, 'chest'),
    ex('Barbell Row', 4, 6, 10, 'back', { alternates: ['Incline Bench DB Row', 'T-Bar Row'] }),
    ex('Standing Overhead Press', 3, 6, 10, 'shoulders'),
    ex('Lat Pulldown', 3, 8, 12, 'back', { alternates: ['Pull-ups'] }),
    ex('Lateral Raise', 3, 12, 15, 'shoulders'),
    ex('Barbell Curl', 3, 8, 12, 'biceps', { alternates: ['Rope Pushdown'] }),
  ])

const lowerA = () =>
  day('lower-a', 'Lower A', 'lower', [
    ex('Barbell Squat', 4, 5, 8, 'quads'),
    ex('Romanian Deadlift', 3, 8, 12, 'hamstrings'),
    ex('Leg Press', 3, 10, 15, 'quads'),
    ex('Leg Curl', 3, 10, 15, 'hamstrings'),
    ex('Seated Calf Raise', 4, 12, 15, 'calves', { note: 'Pause 2 seconds at the bottom.' }),
    ex('Hanging Leg Raise', 3, 10, 15, 'abs', { loadType: 'bodyweight' }),
  ])

const upperB = () =>
  day('upper-b', 'Upper B', 'upper', [
    ex('Incline DB Press', 4, 8, 12, 'chest'),
    ex('Pull-ups', 4, 6, 12, 'back', { loadType: 'bodyweight', alternates: ['Lat Pulldown'] }),
    ex('Seated DB Shoulder Press', 3, 8, 12, 'shoulders'),
    ex('Seated Cable Row', 3, 8, 12, 'back'),
    ex('Cable Reverse Fly', 3, 12, 15, 'shoulders', { alternates: ['Face Pull'] }),
    ex('Skull Crusher', 3, 8, 12, 'triceps', { alternates: ['Close-Grip Bench Press', 'Incline DB Curl'] }),
  ])

const lowerB = () =>
  day('lower-b', 'Lower B', 'lower', [
    ex('Conventional Deadlift', 3, 4, 6, 'hamstrings', { note: 'Use straps.', alternates: ['Trap-Bar Deadlift'] }),
    ex('Hack Squat', 3, 8, 12, 'quads', { alternates: ['Bulgarian Split Squat'] }),
    ex('Walking Lunges', 3, 10, 12, 'quads', { note: 'Reps per leg.' }),
    ex('Leg Extension', 3, 12, 15, 'quads'),
    ex('Leg Press Calf Raise', 4, 12, 15, 'calves', { note: 'Straight knees, upper calf.' }),
    ex('Cable Crunch', 3, 12, 15, 'abs'),
  ])

const fullA = () =>
  day('full-a', 'Full body A', 'full', [
    ex('Barbell Squat', 3, 5, 8, 'quads'),
    ex('Barbell Bench Press', 3, 5, 8, 'chest'),
    ex('Barbell Row', 3, 6, 10, 'back'),
    ex('Lateral Raise', 3, 12, 15, 'shoulders'),
    ex('Barbell Curl', 2, 8, 12, 'biceps'),
    ex('Plank', 3, 30, 45, 'abs', { loadType: 'time' }),
  ])

const fullB = () =>
  day('full-b', 'Full body B', 'full', [
    ex('Romanian Deadlift', 3, 8, 12, 'hamstrings'),
    ex('Standing Overhead Press', 3, 6, 10, 'shoulders'),
    ex('Pull-ups', 3, 6, 12, 'back', { loadType: 'bodyweight', alternates: ['Lat Pulldown'] }),
    ex('Leg Press', 3, 10, 15, 'quads'),
    ex('Rope Pushdown', 2, 10, 12, 'triceps'),
    ex('Hanging Leg Raise', 3, 10, 15, 'abs', { loadType: 'bodyweight' }),
  ])

const fullC = () =>
  day('full-c', 'Full body C', 'full', [
    ex('Conventional Deadlift', 3, 4, 6, 'hamstrings', { note: 'Use straps.' }),
    ex('Incline DB Press', 3, 8, 12, 'chest'),
    ex('Seated Cable Row', 3, 8, 12, 'back'),
    ex('Walking Lunges', 3, 10, 12, 'quads', { note: 'Reps per leg.' }),
    ex('Seated Calf Raise', 3, 12, 15, 'calves'),
    ex('Cable Crunch', 3, 12, 15, 'abs'),
  ])

// ---- templates ----

const TEMPLATES: Record<(typeof SPLITS)[number]['id'], () => PlanDay[]> = {
  ppl6: () => SEED_DAYS,

  ppl3: () => [seedDay('pull-a'), seedDay('push-a'), seedDay('legs-a')],

  pplul5: () => [seedDay('pull-a'), seedDay('push-a'), seedDay('legs-a'), upperA(), lowerA()],

  ul4: () => [upperA(), lowerA(), upperB(), lowerB()],

  phul4: () => [
    day('power-upper', 'Power upper', 'upper', [
      ex('Barbell Bench Press', 3, 3, 5, 'chest'),
      ex('Barbell Row', 3, 3, 5, 'back'),
      ex('Standing Overhead Press', 3, 5, 8, 'shoulders'),
      ex('Lat Pulldown', 3, 6, 10, 'back', { alternates: ['Pull-ups'] }),
      ex('Barbell Curl', 2, 6, 10, 'biceps'),
      ex('Skull Crusher', 2, 6, 10, 'triceps'),
    ]),
    day('power-lower', 'Power lower', 'lower', [
      ex('Barbell Squat', 3, 3, 5, 'quads'),
      ex('Conventional Deadlift', 3, 3, 5, 'hamstrings', { note: 'Use straps.' }),
      ex('Leg Press', 3, 6, 10, 'quads'),
      ex('Leg Curl', 3, 6, 10, 'hamstrings'),
      ex('Seated Calf Raise', 4, 6, 10, 'calves'),
    ]),
    day('hypertrophy-upper', 'Hypertrophy upper', 'upper', [
      ex('Incline DB Press', 3, 8, 12, 'chest'),
      ex('Seated Cable Row', 3, 8, 12, 'back'),
      ex('Low-to-High Cable Fly', 3, 12, 15, 'chest', { alternates: ['Dumbbell Fly'] }),
      ex('Lateral Raise', 3, 12, 15, 'shoulders'),
      ex('Incline DB Curl', 3, 10, 12, 'biceps'),
      ex('Rope Pushdown', 3, 10, 12, 'triceps'),
    ]),
    day('hypertrophy-lower', 'Hypertrophy lower', 'lower', [
      ex('Hack Squat', 3, 8, 12, 'quads', { alternates: ['Front Squat'] }),
      ex('Romanian Deadlift', 3, 8, 12, 'hamstrings'),
      ex('Leg Extension', 3, 12, 15, 'quads'),
      ex('Leg Curl', 3, 12, 15, 'hamstrings'),
      ex('Leg Press Calf Raise', 4, 12, 15, 'calves'),
      ex('Hanging Leg Raise', 3, 10, 15, 'abs', { loadType: 'bodyweight' }),
    ]),
  ],

  ulf3: () => [upperA(), lowerA(), fullA()],

  full3: () => [fullA(), fullB(), fullC()],

  bro5: () => [
    day('chest', 'Chest', 'chest', [
      ex('Barbell Bench Press', 4, 5, 8, 'chest'),
      ex('Incline DB Press', 3, 8, 12, 'chest'),
      ex('Weighted Dips', 3, 8, 12, 'chest', { alternates: ['Decline DB Press'] }),
      ex('Low-to-High Cable Fly', 3, 12, 15, 'chest', { alternates: ['Dumbbell Fly'] }),
      ex('Weighted Push-ups', 3, 8, 12, 'chest', { alternates: ['Deficit Push-ups'] }),
    ]),
    day('back', 'Back', 'back', [
      ex('Conventional Deadlift', 3, 4, 6, 'hamstrings', { note: 'Use straps.' }),
      ex('Pull-ups', 4, 6, 12, 'back', { loadType: 'bodyweight', alternates: ['Lat Pulldown'] }),
      ex('Barbell Row', 4, 6, 10, 'back', { alternates: ['T-Bar Row'] }),
      ex('Seated Cable Row', 3, 8, 12, 'back'),
      ex('Straight-Arm Pulldown', 3, 12, 15, 'back'),
      ex('Face Pull', 3, 12, 15, 'shoulders'),
    ]),
    day('shoulders', 'Shoulders', 'shoulders', [
      ex('Standing Overhead Press', 4, 6, 10, 'shoulders'),
      ex('Seated DB Shoulder Press', 3, 8, 12, 'shoulders'),
      ex('Lateral Raise', 4, 12, 15, 'shoulders'),
      ex('Cable Reverse Fly', 3, 12, 15, 'shoulders', { alternates: ['Face Pull'] }),
      ex('Upright Row', 3, 10, 12, 'shoulders'),
    ]),
    day('legs', 'Legs', 'legs', [
      ex('Barbell Squat', 4, 5, 8, 'quads'),
      ex('Romanian Deadlift', 3, 8, 12, 'hamstrings'),
      ex('Leg Press', 3, 10, 15, 'quads'),
      ex('Leg Curl', 3, 10, 15, 'hamstrings'),
      ex('Leg Extension', 3, 12, 15, 'quads'),
      ex('Seated Calf Raise', 4, 12, 15, 'calves', { note: 'Pause 2 seconds at the bottom.' }),
    ]),
    day('arms', 'Arms and abs', 'arms', [
      ex('Barbell Curl', 3, 8, 12, 'biceps'),
      ex('Skull Crusher', 3, 8, 12, 'triceps', { alternates: ['Close-Grip Bench Press'] }),
      ex('Incline DB Curl', 3, 10, 12, 'biceps', { alternates: ['Hammer Curl'] }),
      ex('Rope Pushdown', 3, 10, 12, 'triceps'),
      ex('Cable Crunch', 3, 12, 15, 'abs'),
      ex('Hanging Leg Raise', 3, 10, 15, 'abs', { loadType: 'bodyweight' }),
    ]),
  ],

  arnold6: () => [
    day('chest-back-a', 'Chest and back A', 'upper', [
      ex('Barbell Bench Press', 4, 5, 8, 'chest'),
      ex('Barbell Row', 4, 6, 10, 'back'),
      ex('Incline DB Press', 3, 8, 12, 'chest'),
      ex('Pull-ups', 3, 6, 12, 'back', { loadType: 'bodyweight', alternates: ['Lat Pulldown'] }),
      ex('Low-to-High Cable Fly', 3, 12, 15, 'chest', { alternates: ['Dumbbell Fly'] }),
      ex('Straight-Arm Pulldown', 3, 12, 15, 'back'),
    ]),
    day('shoulders-arms-a', 'Shoulders and arms A', 'arms', [
      ex('Standing Overhead Press', 4, 6, 10, 'shoulders'),
      ex('Lateral Raise', 4, 12, 15, 'shoulders'),
      ex('Cable Reverse Fly', 3, 12, 15, 'shoulders', { alternates: ['Face Pull'] }),
      ex('Barbell Curl', 3, 8, 12, 'biceps'),
      ex('Skull Crusher', 3, 8, 12, 'triceps', { alternates: ['Close-Grip Bench Press'] }),
      ex('Hammer Curl', 3, 10, 12, 'biceps'),
    ]),
    seedDay('legs-a'),
    day('chest-back-b', 'Chest and back B', 'upper', [
      ex('Incline DB Press', 4, 8, 12, 'chest'),
      ex('Neutral-Grip Lat Pulldown', 4, 6, 10, 'back', { alternates: ['Chin-ups'] }),
      ex('Weighted Dips', 3, 8, 12, 'chest', { alternates: ['Decline DB Press'] }),
      ex('Seated Cable Row', 3, 8, 12, 'back'),
      ex('Dumbbell Fly', 3, 12, 15, 'chest'),
      ex('Face Pull', 3, 12, 15, 'shoulders'),
    ]),
    day('shoulders-arms-b', 'Shoulders and arms B', 'arms', [
      ex('Seated DB Shoulder Press', 4, 8, 12, 'shoulders', { alternates: ['Pike Push-ups'] }),
      ex('Lateral Raise', 4, 15, 20, 'shoulders'),
      ex('Upright Row', 3, 10, 12, 'shoulders'),
      ex('Incline DB Curl', 3, 10, 12, 'biceps'),
      ex('Rope Pushdown', 3, 10, 12, 'triceps'),
      ex('Preacher Curl', 3, 10, 12, 'biceps', { alternates: ['Concentration Curl'] }),
    ]),
    seedDay('legs-b'),
  ],
}

/** A fresh copy of a bundled template's days, safe to edit. The app itself reads templates from the database. */
export function buildSplit(id: SplitId): PlanDay[] {
  const make = TEMPLATES[id as keyof typeof TEMPLATES]
  if (!make) throw new Error(`Unknown bundled split "${id}"`)
  return structuredClone(make())
}

/** The bundled templates in the shape the database holds them: what `bun run db:seed` writes. */
export const BUNDLED_SPLITS: SplitTemplate[] = SPLITS.map((s, order) => ({
  id: s.id,
  name: s.name,
  fit: s.fit,
  order,
  days: buildSplit(s.id),
}))
