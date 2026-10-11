import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { DAY_TYPES, MAX_EXERCISES_PER_DAY } from '#/lib/types'
import { authOptions, currentUser } from './auth'
import { readContent } from './content'
import * as repo from './repo'
import { authed } from './session'

// Every function here runs behind `authed`, which hands the signed-in user's id to the handler.
// The exceptions, getSessionFn and getShellFn, live in session.ts and answer "nobody" instead.

const units = z.enum(['kg', 'lb'])
/** A split template id. Open, since templates live in the database; the repo rejects unknown ones. */
const splitId = z.string().min(1).max(40)
const trainingAge = z.enum(['under1', 'over1'])
const muscle = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'calves',
  'abs',
])
const loadType = z.enum(['weight', 'bodyweight', 'time'])

const loggedSet = z.object({
  weight: z.number().min(0).max(2000).optional(),
  reps: z.number().int().min(0).max(500).optional(),
  seconds: z.number().int().min(0).max(3600).optional(),
  done: z.boolean(),
})

// ---- shell ----

/** Which sign-in options are configured, for the sign-in page. */
export const getAuthOptionsFn = createServerFn({ method: 'GET' }).handler(() => authOptions())

/** The signed-in user plus their settings, for the app layout. Null when nobody is signed in. */
export const getShellFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await currentUser()
  if (!user) return null
  return { user, settings: await repo.getSettings(user.id) }
})

// ---- settings ----

/** The split templates and the exercise library, from the database (seeded from the bundle when empty). */
export const getContentFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(() => readContent())

export const getSettingsFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => repo.getSettings(context.userId))

export const saveSettingsFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      units: units.optional(),
      bodyweight: z.number().positive().max(500).optional(),
      trainingAge: trainingAge.optional(),
      setupDone: z.boolean().optional(),
      split: splitId.optional(),
    }),
  )
  .handler(({ data, context }) => repo.saveSettings(context.userId, data))

/** Wipes everything of this user except the account. The client asks for a typed confirmation first. */
export const startFreshFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .handler(({ context }) => repo.startFresh(context.userId))

export const setScheduleFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ schedule: z.enum(['rolling', 'weekday']) }))
  .handler(({ data, context }) => repo.setSchedule(context.userId, data.schedule))

export const setDayWeekdayFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ dayId: z.string().min(1), weekday: z.number().int().min(0).max(6) }))
  .handler(({ data, context }) => repo.setDayWeekday(context.userId, data.dayId, data.weekday))

/** Starts the plan over from a split template and remembers the choice. Logged workouts stay. */
export const applySplitFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ split: splitId }))
  .handler(({ data, context }) => repo.applySplit(context.userId, data.split))

// ---- plan ----

export const getPlanFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(async ({ context }) => {
    const [plan, settings] = await Promise.all([repo.getPlan(context.userId), repo.getSettings(context.userId)])
    return { plan, settings }
  })

export const updateExerciseFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      dayId: z.string().min(1),
      exerciseId: z.string().min(1),
      patch: z.object({
        name: z.string().trim().min(1).max(80).optional(),
        sets: z.number().int().min(1).max(10).optional(),
        repMin: z.number().int().min(1).max(600).optional(),
        repMax: z.number().int().min(1).max(600).optional(),
        muscle: muscle.optional(),
        loadType: loadType.optional(),
        note: z.string().trim().max(200).optional(),
        alternates: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
      }),
    }),
  )
  .handler(({ data, context }) => repo.updateExercise(context.userId, data.dayId, data.exerciseId, data.patch))

export const swapExerciseFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      dayId: z.string().min(1),
      exerciseId: z.string().min(1),
      name: z.string().trim().min(1).max(80),
    }),
  )
  .handler(({ data, context }) => repo.swapExercise(context.userId, data.dayId, data.exerciseId, data.name))

export const resetPlanFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .handler(({ context }) => repo.resetPlan(context.userId))

const exerciseInput = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(1).max(10),
  repMin: z.number().int().min(1).max(600),
  repMax: z.number().int().min(1).max(600),
  muscle,
  loadType,
  note: z.string().trim().max(200).optional(),
  alternates: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
})

export const addExerciseFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ dayId: z.string().min(1), exercise: exerciseInput }))
  .handler(({ data, context }) => repo.addExercise(context.userId, data.dayId, data.exercise))

export const removeExerciseFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ dayId: z.string().min(1), exerciseId: z.string().min(1) }))
  .handler(({ data, context }) => repo.removeExercise(context.userId, data.dayId, data.exerciseId))

const exerciseSchema = exerciseInput.extend({
  id: z.string().min(1).max(80),
})

const daySchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().trim().min(1).max(40),
  type: z.enum(DAY_TYPES),
  weekday: z.number().int().min(0).max(6).optional(),
  exercises: z.array(exerciseSchema).min(1).max(MAX_EXERCISES_PER_DAY),
})

export const replacePlanFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ days: z.array(daySchema).min(1).max(14), split: splitId.optional() }))
  .handler(({ data, context }) => repo.replacePlan(context.userId, data.days, data.split))

// ---- today / workouts ----

export const getTodayFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => repo.getTodayData(context.userId))

export const startWorkoutFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ dayId: z.string().min(1) }))
  .handler(({ data, context }) => repo.startWorkout(context.userId, data.dayId))

export const saveSetsFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      workoutId: z.string().length(24),
      exerciseId: z.string().min(1),
      sets: z.array(loggedSet).max(10),
    }),
  )
  .handler(({ data, context }) => repo.saveEntrySets(context.userId, data.workoutId, data.exerciseId, data.sets))

export const finishWorkoutFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      workoutId: z.string().length(24),
      effort: z.number().int().min(1).max(4).optional(),
      note: z.string().trim().max(200).optional(),
    }),
  )
  .handler(({ data, context }) =>
    repo.finishWorkout(context.userId, data.workoutId, { effort: data.effort, note: data.note }),
  )

export const updateWorkoutFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      workoutId: z.string().length(24),
      changes: z.array(z.object({ exerciseId: z.string().min(1), sets: z.array(loggedSet).max(10) })).max(30),
    }),
  )
  .handler(({ data, context }) => repo.updateWorkoutSets(context.userId, data.workoutId, data.changes))

export const deleteWorkoutFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ workoutId: z.string().length(24) }))
  .handler(({ data, context }) => repo.deleteWorkout(context.userId, data.workoutId))

export const getExportFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => repo.getExportData(context.userId))

export const discardWorkoutFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ workoutId: z.string().length(24) }))
  .handler(({ data, context }) => repo.discardWorkout(context.userId, data.workoutId))

// ---- stats / body ----

export const getStatsFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => repo.getStatsData(context.userId))

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
/** The instant a log happened. Optional and never in the future (a day of slack for time zones). */
const at = z.iso
  .datetime()
  .refine((s) => Date.parse(s) <= Date.now() + 86_400_000, 'That moment has not happened yet')
  .optional()
const measures = {
  arm: z.number().positive().max(200).optional(),
  chest: z.number().positive().max(300).optional(),
  waist: z.number().positive().max(300).optional(),
}

function dateOf(iso: string | undefined): Date | undefined {
  return iso ? new Date(iso) : undefined
}

export const logBodyweightFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ weight: z.number().positive().max(500), day: dayKey, at }))
  .handler(({ data, context }) => repo.logBodyweight(context.userId, data.weight, data.day, dateOf(data.at)))

export const updateBodyweightFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ id: z.string().length(24), weight: z.number().positive().max(500) }))
  .handler(({ data, context }) => repo.updateBodyweight(context.userId, data.id, data.weight))

export const deleteBodyweightFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ id: z.string().length(24) }))
  .handler(({ data, context }) => repo.deleteBodyweight(context.userId, data.id))

export const logMeasurementFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ ...measures, day: dayKey, at }))
  .handler(({ data, context }) =>
    repo.logMeasurement(
      context.userId,
      { arm: data.arm, chest: data.chest, waist: data.waist },
      data.day,
      dateOf(data.at),
    ),
  )

export const updateMeasurementFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ id: z.string().length(24), ...measures }))
  .handler(({ data, context }) =>
    repo.updateMeasurement(context.userId, data.id, { arm: data.arm, chest: data.chest, waist: data.waist }),
  )

export const deleteMeasurementFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ id: z.string().length(24) }))
  .handler(({ data, context }) => repo.deleteMeasurement(context.userId, data.id))
