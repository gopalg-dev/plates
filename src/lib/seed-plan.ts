import type { Exercise, LoadType, Muscle, Plan, PlanDay } from './types'

type Extra = { note?: string; alternates?: string[]; loadType?: LoadType }

/** One exercise line of a template. The id is the slug of the name. */
export function ex(
  name: string,
  sets: number,
  repMin: number,
  repMax: number,
  muscle: Muscle,
  extra: Extra = {},
): Exercise {
  return {
    id: slug(name),
    name,
    sets,
    repMin,
    repMax,
    muscle,
    loadType: extra.loadType ?? 'weight',
    ...(extra.note ? { note: extra.note } : {}),
    ...(extra.alternates ? { alternates: extra.alternates } : {}),
  }
}

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const SEED_DAYS: PlanDay[] = [
  {
    id: 'pull-a',
    name: 'Pull A',
    type: 'pull',
    exercises: [
      ex('Pull-ups', 4, 6, 12, 'back', {
        loadType: 'bodyweight',
        note: 'Stop 1 to 2 reps short. Under 6 reps? Do 3 sets, then Lat Pulldown 2 × 8-12.',
        alternates: ['Lat Pulldown'],
      }),
      ex('Barbell Row', 4, 6, 10, 'back', {
        note: 'Low back sore on squat day? Switch to Incline Bench DB Row.',
        alternates: ['Incline Bench DB Row', 'T-Bar Row'],
      }),
      ex('Seated Cable Row', 3, 8, 12, 'back'),
      ex('Face Pull', 3, 12, 15, 'shoulders'),
      ex('Barbell Curl', 3, 8, 12, 'biceps'),
      ex('Hammer Curl', 3, 10, 12, 'biceps'),
    ],
  },
  {
    id: 'push-a',
    name: 'Push A',
    type: 'push',
    exercises: [
      ex('Barbell Bench Press', 4, 5, 8, 'chest'),
      ex('Standing Overhead Press', 3, 6, 10, 'shoulders'),
      ex('Decline DB Press', 3, 8, 12, 'chest', {
        alternates: ['Weighted Dips', 'Close-Grip Bench Press', 'Weighted Push-ups'],
      }),
      ex('Lateral Raise', 4, 12, 15, 'shoulders'),
      ex('Overhead Triceps Extension', 3, 10, 12, 'triceps'),
      ex('Cable Crunch', 3, 12, 15, 'abs'),
    ],
  },
  {
    id: 'legs-a',
    name: 'Legs A',
    type: 'legs',
    exercises: [
      ex('Barbell Squat', 4, 5, 8, 'quads'),
      ex('Romanian Deadlift', 3, 8, 12, 'hamstrings'),
      ex('Leg Press', 3, 10, 15, 'quads'),
      ex('Leg Curl', 3, 10, 15, 'hamstrings'),
      ex('Seated Calf Raise', 4, 12, 15, 'calves', { note: 'Pause 2 seconds at the bottom.' }),
      ex('Hanging Leg Raise', 3, 10, 15, 'abs', {
        loadType: 'bodyweight',
        note: 'Twist version every other week.',
      }),
    ],
  },
  {
    id: 'pull-b',
    name: 'Pull B',
    type: 'pull',
    exercises: [
      ex('Neutral-Grip Lat Pulldown', 3, 6, 10, 'back', { alternates: ['Chin-ups'] }),
      ex('Single-Arm DB Row', 3, 8, 12, 'back'),
      ex('Straight-Arm Pulldown', 3, 12, 15, 'back'),
      ex('Cable Reverse Fly', 3, 12, 15, 'shoulders', {
        alternates: ['Face Pull', 'Incline Bench DB Rear Delt Fly'],
      }),
      ex('Incline DB Curl', 3, 10, 12, 'biceps'),
      ex('Preacher Curl', 3, 10, 12, 'biceps', { alternates: ['Concentration Curl'] }),
    ],
  },
  {
    id: 'push-b',
    name: 'Push B',
    type: 'push',
    exercises: [
      ex('Seated DB Shoulder Press', 3, 8, 12, 'shoulders', { alternates: ['Pike Push-ups'] }),
      ex('Incline DB Press', 4, 8, 12, 'chest'),
      ex('Low-to-High Cable Fly', 3, 12, 15, 'chest', {
        alternates: ['Dumbbell Fly', 'Deficit Push-ups'],
      }),
      ex('Lateral Raise', 4, 15, 20, 'shoulders'),
      ex('Skull Crusher', 3, 8, 12, 'triceps', { alternates: ['Close-Grip Bench Press'] }),
      ex('Rope Pushdown', 3, 10, 12, 'triceps'),
    ],
  },
  {
    id: 'legs-b',
    name: 'Legs B',
    type: 'legs',
    exercises: [
      ex('Conventional Deadlift', 3, 4, 6, 'hamstrings', {
        note: 'Use straps.',
        alternates: ['Trap-Bar Deadlift', 'Romanian Deadlift'],
      }),
      ex('Hack Squat', 3, 8, 12, 'quads', { alternates: ['Walking Lunges', 'Bulgarian Split Squat'] }),
      ex('Leg Curl', 3, 12, 15, 'hamstrings'),
      ex('Leg Extension', 2, 12, 15, 'quads'),
      ex('Leg Press Calf Raise', 4, 12, 15, 'calves', { note: 'Straight knees, upper calf.' }),
      ex('Barbell Rollout', 3, 8, 12, 'abs', {
        loadType: 'bodyweight',
        alternates: ['Hanging L-sit hold'],
      }),
    ],
  },
]

export function seedPlan(now = new Date()): Plan {
  return { days: structuredClone(SEED_DAYS), updatedAt: now.toISOString() }
}
