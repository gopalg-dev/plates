import { addDays, dayKey, startOfWeek } from '#/lib/logic/stats'
import { buildSplit } from '#/lib/splits'
import type {
  BodyweightLog,
  LoggedSet,
  MeasurementLog,
  Muscle,
  PlanDay,
  Settings,
  SplitId,
  Workout,
  WorkoutEntry,
} from '#/lib/types'

/**
 * The made-up numbers the phones on How it works run on, through the app's own pieces (`guide-demos.tsx`). The plan
 * is the real default split; the history, and the session built from it, are invented. Only data lives here.
 */

/** The split the demos show: the one a new account starts on. */
export const DEMO_SPLIT: SplitId = 'ppl6'

export const DEMO_SETTINGS: Settings = { units: 'kg', trainingAge: 'over1', setupDone: true, goal: 'gain' }

/**
 * The session the phone opens on: the plan's Pull A, each lift aiming a rep past its last logged session with a
 * hint saying what that was, as the coach would put it. Built from the history, so finishing it adds to the same
 * numbers Stats shows.
 */
export function demoSession(days: PlanDay[], workouts: Workout[], now: Date): Workout {
  const day = days.find((d) => d.type === 'pull') ?? days[0]
  const lastOf = (exerciseId: string) => {
    for (let i = workouts.length - 1; i >= 0; i--) {
      const entry = workouts[i].entries.find((e) => e.exerciseId === exerciseId)
      if (entry) return entry
    }
    return undefined
  }
  const entries: WorkoutEntry[] = day.exercises.map((ex) => {
    const prev = lastOf(ex.id)?.sets ?? []
    const said = prev.map((s) => s.reps ?? s.seconds).join(', ')
    const weight = prev[0]?.weight
    return {
      exerciseId: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      loadType: ex.loadType,
      repMin: ex.repMin,
      repMax: ex.repMax,
      hint:
        prev.length > 0
          ? `Last time ${weight !== undefined ? `${weight} kg × ` : ''}${said}. Add a rep where you can.`
          : undefined,
      suggested: prev.map((s) => ({
        weight: s.weight,
        reps: s.reps === undefined ? undefined : s.reps + 1,
        seconds: s.seconds,
      })),
      sets: Array.from({ length: ex.sets }, () => ({ done: false })),
    }
  })
  return {
    id: 'demo',
    dayId: day.id,
    dayName: day.name,
    dayType: day.type,
    startedAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
    status: 'in_progress',
    entries,
  }
}

/** Where each muscle's lifts start, in kg, half a year back. */
const START: Record<Muscle, number> = {
  chest: 50,
  back: 50,
  shoulders: 25,
  biceps: 10,
  triceps: 15,
  quads: 70,
  hamstrings: 50,
  calves: 40,
  abs: 10,
}
const WEEKS = 26
/** Tape days in the history, four weeks apart: fifteen months. */
const TAPE_DAYS = 16

/** A fixed wobble between 0 and 1 for a number: the same every time, so the history never reshuffles. */
const wobble = (n: number) => Math.sin(n * 12.9898) * 0.5 + 0.5

/**
 * One exercise of one session, `weeksIn` weeks into the history: the weight climbs a plate step every three weeks
 * while the reps work through the range; a bodyweight lift gains a rep every other week, a hold five seconds a
 * month. The lifts `stuck` have not moved for the last two months, and the one `slipping` has dropped back.
 */
function loggedEntry(
  ex: PlanDay['exercises'][number],
  weeksIn: number,
  stuck: boolean,
  slipping: boolean,
): WorkoutEntry {
  const progress = stuck ? Math.min(weeksIn, WEEKS - 9) : weeksIn
  const span = ex.repMax - ex.repMin + 1
  // Slipping: about 15% lighter, at the bottom of the range, rounded to a plate step.
  const reps = slipping ? ex.repMin : ex.repMin + (progress % span)
  const climbed = START[ex.muscle] + 2.5 * Math.floor(progress / 3)
  const weight = slipping ? Math.round((climbed * 0.85) / 2.5) * 2.5 : climbed
  const logged: LoggedSet[] = Array.from({ length: ex.sets }, (_, i) => {
    const r = Math.max(ex.repMin, reps - i)
    if (ex.loadType === 'weight') return { weight, reps: r, done: true }
    if (ex.loadType === 'bodyweight') return { reps: ex.repMin + Math.floor(progress / 2) - i, done: true }
    return { seconds: ex.repMin + 5 * Math.floor(progress / 4), done: true }
  })
  return {
    exerciseId: ex.id,
    name: ex.name,
    muscle: ex.muscle,
    loadType: ex.loadType,
    repMin: ex.repMin,
    repMax: ex.repMax,
    sets: logged,
  }
}

/**
 * Half a year of the default split, every day done, up to yesterday; weigh-ins every three days, and fifteen months
 * of tape every four weeks. Worked out from `now`, so the weeks on the charts are always the latest ones.
 */
export function demoHistory(now: Date): {
  days: PlanDay[]
  workouts: Workout[]
  bodyweights: BodyweightLog[]
  measurements: MeasurementLog[]
} {
  const days = buildSplit(DEMO_SPLIT)
  const monday = startOfWeek(now)
  const today = dayKey(now)
  const workouts: Workout[] = []
  for (let ago = WEEKS - 1; ago >= 0; ago--) {
    const weeksIn = WEEKS - 1 - ago
    days.forEach((day, d) => {
      const start = addDays(monday, d - 7 * ago)
      start.setHours(18, 0, 0, 0)
      if (dayKey(start) >= today) return
      workouts.push({
        id: `demo-${ago}-${d}`,
        dayId: day.id,
        dayName: day.name,
        dayType: day.type,
        startedAt: start.toISOString(),
        finishedAt: new Date(start.getTime() + 55 * 60_000).toISOString(),
        status: 'done',
        effort: 2,
        // Each day's first lift climbs (it is the one Stats shows first); a few of the others are stuck lately.
        entries: day.exercises.map((ex, e) =>
          loggedEntry(ex, weeksIn, e > 0 && (d + e) % 4 === 0 && ago < 8, d === 2 && e === 1 && ago < 5),
        ),
      })
    })
  }
  const bodyweights: BodyweightLog[] = Array.from({ length: 60 }, (_, i) => {
    const date = addDays(now, -1 - 3 * (59 - i))
    date.setHours(8, 0, 0, 0)
    const weight = Math.round((70 + i * 0.05 + (wobble(i) - 0.5) * 0.8) * 10) / 10
    return { id: `demo-bw-${i}`, date: date.toISOString(), day: dayKey(date), weight }
  })
  // Longer than the training: over a year, so each of the tape chart's ranges shows a different stretch.
  const measurements: MeasurementLog[] = Array.from({ length: TAPE_DAYS }, (_, i) => {
    const date = addDays(now, -2 - 28 * (TAPE_DAYS - 1 - i))
    date.setHours(8, 0, 0, 0)
    const cm = (n: number) => Math.round(n * 10) / 10
    return {
      id: `demo-tape-${i}`,
      date: date.toISOString(),
      day: dayKey(date),
      arm: cm(32 + 0.15 * i),
      chest: cm(96 + 0.3 * i),
      waist: cm(82 - 0.08 * i),
    }
  })
  return { days, workouts, bodyweights, measurements }
}
