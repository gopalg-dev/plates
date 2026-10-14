import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { MOOD_LABEL } from '#/lib/logic/feedback'
import { DAY_TYPES, GOALS, MAX_DAYS, MAX_EXERCISES_PER_DAY, PROGRESSIONS } from '#/lib/types'
import { authOptions, currentUser } from './auth'
import { readContent } from './content'
import { sendMail } from './mail'
import * as repo from './repo'
import { authed } from './session'

// Every function here runs behind `authed`, which hands the signed-in user's id to the handler.
// The exceptions, getSessionFn and getShellFn, live in session.ts and answer "nobody" instead.

const units = z.enum(['kg', 'lb'])
/** A split template id. Open, since templates live in the database; the repo rejects unknown ones. */
const splitId = z.string().min(1).max(40)
const trainingAge = z.enum(['under1', 'over1'])
const muscle = z.enum(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'calves', 'abs'])
const loadType = z.enum(['weight', 'bodyweight', 'time'])

/** A value the user may not have entered. Sessions stored before October 2026 hold null for that. */
const absent = <T extends z.ZodType>(schema: T) => schema.nullish().transform((v) => v ?? undefined)

const loggedSet = z.object({
  weight: absent(z.number().min(0).max(2000)),
  reps: absent(z.number().int().min(0).max(500)),
  seconds: absent(z.number().int().min(0).max(3600)),
  left: absent(z.number().int().min(0).max(5)),
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

/** The splits this account has a plan for. Settings uses it to offer the plan of your own back. */
export const getPlanSlotsFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => repo.planSlots(context.userId))

export const saveSettingsFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      units: units.optional(),
      bodyweight: z.number().positive().max(500).optional(),
      trainingAge: trainingAge.optional(),
      setupDone: z.boolean().optional(),
      split: splitId.optional(),
      progression: z.enum(PROGRESSIONS).optional(),
      goal: z.enum(GOALS).optional(),
      keepAwake: z.boolean().optional(),
      plate: z.number().positive().max(50).optional(),
      dumbbellStep: z.number().positive().max(50).optional(),
      stackStep: z.number().positive().max(50).optional(),
      sameStep: z.boolean().optional(),
    }),
  )
  .handler(({ data, context }) => repo.saveSettings(context.userId, data))

/** One tap and an optional line. Stored with the account; also mailed to FEEDBACK_TO when that is set. */
export const sendFeedbackFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z
      .object({
        mood: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        text: z.string().trim().max(1000),
        route: z.string().max(200),
        trigger: z.enum(['menu', 'summary']),
      })
      .refine((d) => d.mood !== undefined || d.text.length > 0, { message: 'Pick a face or write a line.' }),
  )
  .handler(async ({ data, context }) => {
    await repo.addFeedback(context.userId, data)
    const to = process.env.FEEDBACK_TO
    if (to) {
      const mood = data.mood ? MOOD_LABEL[data.mood] : 'no face'
      const text = `${mood} on ${data.route} (${data.trigger})\n\n${data.text || '(no text)'}`
      await sendMail({
        to,
        subject: `Plates feedback: ${mood}`,
        text,
        html: `<pre style="font: 14px/1.5 sans-serif; white-space: pre-wrap">${escapeHtml(text)}</pre>`,
      }).catch((err: unknown) => console.warn('Feedback mail failed', err))
    }
  })

export const dismissNudgeFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ kind: z.enum(['weight', 'measure']) }))
  .handler(({ data, context }) => repo.dismissNudge(context.userId, data.kind))

export const dismissFeedbackFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .handler(({ context }) => repo.dismissFeedback(context.userId))

/** Hides a Today alert by its key (see repo.dismissAlert). */
export const dismissAlertFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ key: z.string().min(1).max(120) }))
  .handler(({ data, context }) => repo.dismissAlert(context.userId, data.key))

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
}

/** Removes the account and every trace of its data. The client asks for a typed confirmation first. */
export const deleteAccountFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .handler(({ context }) => repo.deleteAccount(context.userId))

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
/** `empty` starts the split as its days with no lifts, in place of whatever plan it had. */
export const applySplitFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ split: splitId, empty: z.boolean().optional() }))
  .handler(({ data, context }) => repo.applySplit(context.userId, data.split, { empty: data.empty }))

// ---- plan ----

const dayType = z.enum(DAY_TYPES)

export const addDayFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ type: dayType }))
  .handler(({ data, context }) => repo.addDay(context.userId, data.type))

export const updateDayFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({ dayId: z.string().min(1), name: z.string().trim().min(1).max(40).optional(), type: dayType.optional() }),
  )
  .handler(({ data, context }) => repo.updateDay(context.userId, data.dayId, { name: data.name, type: data.type }))

export const removeDayFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ dayId: z.string().min(1) }))
  .handler(({ data, context }) => repo.removeDay(context.userId, data.dayId))

export const moveDayFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ dayId: z.string().min(1), direction: z.enum(['up', 'down']) }))
  .handler(({ data, context }) => repo.moveDay(context.userId, data.dayId, data.direction))

/** A plan of the user's own from a list of day types, in the custom slot. */
export const createCustomPlanFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ types: z.array(dayType).min(1).max(MAX_DAYS), empty: z.boolean().optional() }))
  .handler(({ data, context }) => repo.createCustomPlan(context.userId, data.types, { empty: data.empty }))

export const getPlanFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(async ({ context }) => {
    const [plan, settings, active] = await Promise.all([
      repo.getPlan(context.userId),
      repo.getSettings(context.userId),
      repo.getActiveWorkout(context.userId),
    ])
    // The day of a session in progress: editing it asks whether today's session should follow.
    return { plan, settings, activeDayId: active?.dayId ?? null }
  })

/** Brings the session in progress up to its plan day, keeping what is logged (see repo.syncSession). */
export const syncSessionFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .handler(async ({ context }) => {
    const { kept } = await repo.syncSession(context.userId)
    return { kept }
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

export const reorderExercisesFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({ dayId: z.string().min(1), order: z.array(z.string().min(1)).min(1).max(MAX_EXERCISES_PER_DAY) }),
  )
  .handler(({ data, context }) => repo.reorderExercises(context.userId, data.dayId, data.order))

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
  .validator(z.object({ days: z.array(daySchema).min(1).max(MAX_DAYS), split: splitId.optional() }))
  .handler(({ data, context }) => repo.replacePlan(context.userId, data.days, data.split))

// ---- today / workouts ----

export const getTodayFn = createServerFn({ method: 'GET' })
  .middleware([authed])
  .handler(({ context }) => repo.getTodayData(context.userId))

export const startWorkoutFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ dayId: z.string().min(1) }))
  .handler(({ data, context }) => repo.startWorkout(context.userId, data.dayId))

export const acceptRampFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ workoutId: z.string().length(24), exerciseId: z.string().min(1) }))
  .handler(({ data, context }) => repo.acceptRamp(context.userId, data.workoutId, data.exerciseId))

/** Swaps one lift of the session in progress for another, by name; `alsoPlan` swaps it on the plan day too. */
export const swapSessionExerciseFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(
    z.object({
      workoutId: z.string().length(24),
      exerciseId: z.string().min(1),
      name: z.string().trim().min(1).max(80),
      alsoPlan: z.boolean(),
    }),
  )
  .handler(({ data, context }) =>
    repo.swapSessionExercise(context.userId, data.workoutId, data.exerciseId, data.name, data.alsoPlan),
  )

export const pauseWorkoutFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .validator(z.object({ workoutId: z.string().length(24), paused: z.boolean() }))
  .handler(({ data, context }) => repo.pauseWorkout(context.userId, data.workoutId, data.paused))

export const resetRampFn = createServerFn({ method: 'POST' })
  .middleware([authed])
  .handler(({ context }) => repo.resetRamp(context.userId))

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

const dayKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
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
