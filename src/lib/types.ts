export type Units = 'kg' | 'lb'

/** What a session is about. Colour comes from the family: push red, pull blue, legs yellow, the rest neutral. */
export const DAY_TYPES = [
  'push',
  'pull',
  'legs',
  'upper',
  'lower',
  'full',
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
] as const
export type DayType = (typeof DAY_TYPES)[number]

/** The split templates in `src/lib/splits.ts`. */
export const SPLIT_IDS = ['ppl6', 'ppl3', 'pplul5', 'ul4', 'phul4', 'ulf3', 'full3', 'bro5', 'arnold6'] as const
export type SplitId = (typeof SPLIT_IDS)[number]
/** Where the plan came from: a template, or the user's own file. */
export type PlanSource = SplitId | 'custom'
export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'abs'
export type LoadType = 'weight' | 'bodyweight' | 'time'
export type TrainingAge = 'under1' | 'over1'

export interface Exercise {
  id: string
  name: string
  sets: number
  repMin: number
  repMax: number
  muscle: Muscle
  loadType: LoadType
  note?: string
  alternates?: string[]
}

/** A day holds this many exercises at most: enough for a session, short enough for a phone screen. */
export const MAX_EXERCISES_PER_DAY = 6

export interface PlanDay {
  id: string
  name: string
  type: DayType
  exercises: Exercise[]
  /** Calendar weekday for the weekday schedule, 0 = Sunday to 6 = Saturday. */
  weekday?: number
}

/** Rolling: the next day in order after the last finished one. Weekday: the day that matches the calendar. */
export type Schedule = 'rolling' | 'weekday'

export interface Plan {
  days: PlanDay[]
  updatedAt: string
}

export interface Settings {
  units: Units
  bodyweight?: number
  trainingAge: TrainingAge
  setupDone: boolean
  /** When setup was first completed. Days before it are out of reach on the Stats calendar. */
  joinedAt?: string
  /** The template the plan started from, or `custom` after an upload. Push / Pull / Legs, 6 days, when unset. */
  split?: PlanSource
  /** Rolling when unset. */
  schedule?: Schedule
}

export interface LoggedSet {
  weight?: number
  reps?: number
  seconds?: number
  done: boolean
}

export interface WorkoutEntry {
  exerciseId: string
  name: string
  muscle: Muscle
  loadType: LoadType
  repMin: number
  repMax: number
  hint?: string
  sets: LoggedSet[]
}

export type WorkoutStatus = 'in_progress' | 'done'

export interface Workout {
  id: string
  dayId: string
  dayName: string
  dayType: DayType
  startedAt: string
  finishedAt?: string
  status: WorkoutStatus
  entries: WorkoutEntry[]
  /** How it felt, picked at finish: 1 easy, 2 ok, 3 hard, 4 too much. */
  effort?: number
  note?: string
}

export interface BodyweightLog {
  id: string
  date: string
  /** Local calendar day, YYYY-MM-DD. One log per day; a second one replaces the first. */
  day?: string
  weight: number
}

export interface MeasurementLog {
  id: string
  date: string
  day?: string
  arm?: number
  chest?: number
  waist?: number
}
