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
/** The split templates that ship with the app. The database can hold more; see `src/lib/content.ts`. */
export const SPLIT_IDS = ['ppl6', 'ppl3', 'pplul5', 'ul4', 'phul4', 'ulf3', 'full3', 'bro5', 'arnold6'] as const
/** A template's id: one of `SPLIT_IDS`, or any id added to the `splits` collection. */
export type SplitId = string
/** Where the plan came from: a template id, or `custom` for the user's own file. */
export type PlanSource = string
export type Muscle = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'calves' | 'abs'
export type LoadType = 'weight' | 'bodyweight' | 'time'
export type TrainingAge = 'under1' | 'over1'

/**
 * How the next load is chosen. `double`: work up the rep range, then add a plate step, set by set.
 * `linear`: a plate step every session the sets were completed. `topset`: the last set goes to as
 * many reps as possible and the whole next session's load follows that count.
 */
/** Where the bodyweight should go. The Body tab and Today read the scale against it. */
export const GOALS = ['gain', 'hold', 'cut'] as const
export type Goal = (typeof GOALS)[number]

export const PROGRESSIONS = ['double', 'linear', 'topset'] as const
export type Progression = (typeof PROGRESSIONS)[number]

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
/** A plan holds this many days at most: two weeks of rolling sessions. */
export const MAX_DAYS = 14

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
  /** How the next load is chosen. When unset: `linear` under a year of training, `double` otherwise. */
  progression?: Progression
  /** Gain, hold or cut. Unset reads as hold. */
  goal?: Goal
  /** When feedback was last sent or the prompt last dismissed. Gates the prompt after a session. */
  feedbackAt?: string
  /** Keep the screen on during a session. Unset reads as on. */
  keepAwake?: boolean
}

export interface LoggedSet {
  weight?: number
  reps?: number
  seconds?: number
  /** Reps left in the tank, asked on the last set only: 0, 1 (meaning 1 to 2) or 3 (3 or more). */
  left?: number
  done: boolean
}

/** What a set should aim for, worked out from earlier sessions. Never logged on its own. */
export interface SetTarget {
  weight?: number
  reps?: number
  seconds?: number
}

export interface WorkoutEntry {
  exerciseId: string
  name: string
  muscle: Muscle
  loadType: LoadType
  repMin: number
  repMax: number
  hint?: string
  /** One target per set, by index. Shown as placeholders and adopted when a set is marked done. */
  suggested?: SetTarget[]
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
  /**
   * The weigh-in in force when the session was done, filled in when sessions are read for stats
   * (`attachBodyweight`); never stored. Scores bodyweight work and counts it in the weight lifted.
   */
  bodyweight?: number
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
