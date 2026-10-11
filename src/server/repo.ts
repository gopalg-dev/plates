import { createHash } from 'node:crypto'
import { ObjectId, type Db } from 'mongodb'
import { nextDayId } from '#/lib/logic/next-day'
import { STALL_SESSIONS, progressionOf, suggestNext, type PastEntry } from '#/lib/logic/progression'
import { assignWeekdays, type Finished } from '#/lib/logic/schedule'
import { bodyweightAlert, stallAlerts, weekAlert, type Alert } from '#/lib/logic/alerts'
import { attachBodyweight, plannedSetsFor, sessionsInWeek } from '#/lib/logic/stats'
import { plannedPerWeek, summarize, type SessionSummary } from '#/lib/logic/summary'
import { buildCustomDays, buildDay } from '#/lib/day-blocks'
import { slug } from '#/lib/seed-plan'
import { DEFAULT_SPLIT } from '#/lib/content'
import { splitTemplate } from './content'
import {
  MAX_DAYS,
  MAX_EXERCISES_PER_DAY,
  type BodyweightLog,
  type DayType,
  type Exercise,
  type LoggedSet,
  type MeasurementLog,
  type Plan,
  type PlanDay,
  type PlanSource,
  type Schedule,
  type Settings,
  type SplitId,
  type Workout,
  type WorkoutEntry,
} from '#/lib/types'
import { getDb } from './db'

// Every document belongs to one user. Settings use the user id as their _id; plans and the log
// collections carry a userId field, and every query filters on it.

type SettingsDoc = Settings & { _id: string }
type PlanDoc = Plan & { _id: ObjectId; userId: string; split: PlanSource }
/** The one-plan-per-user shape from before plans were kept per split. Read only to migrate. */
type LegacyPlanDoc = Plan & { _id: string }
type WorkoutDoc = Omit<Workout, 'id'> & { _id: ObjectId; userId: string }
type BodyweightDoc = Omit<BodyweightLog, 'id'> & { _id: ObjectId; userId: string }
type MeasurementDoc = Omit<MeasurementLog, 'id'> & { _id: ObjectId; userId: string }

const DEFAULT_SETTINGS: Settings = { units: 'kg', trainingAge: 'over1', setupDone: false }

const indexed = new WeakSet<Db>()

/** Indexes for the per-user queries. Created once per process, in the background. */
function ensureIndexes(db: Db) {
  if (indexed.has(db)) return
  indexed.add(db)
  void Promise.all([
    db.collection('plans').createIndexes([{ key: { userId: 1, split: 1 }, unique: true }]),
    db
      .collection('workouts')
      .createIndexes([{ key: { userId: 1, status: 1, finishedAt: -1 } }, { key: { userId: 1, startedAt: -1 } }]),
    db.collection('bodyweights').createIndexes([{ key: { userId: 1, date: -1 } }, { key: { userId: 1, day: 1 } }]),
    db.collection('measurements').createIndexes([{ key: { userId: 1, date: -1 } }, { key: { userId: 1, day: 1 } }]),
  ]).catch((err: unknown) => {
    indexed.delete(db)
    console.warn('Could not create indexes', err)
  })
}

async function cols() {
  const db = await getDb()
  ensureIndexes(db)
  return {
    db,
    settings: db.collection<SettingsDoc>('settings'),
    plan: db.collection<LegacyPlanDoc>('plan'),
    plans: db.collection<PlanDoc>('plans'),
    workouts: db.collection<WorkoutDoc>('workouts'),
    bodyweights: db.collection<BodyweightDoc>('bodyweights'),
    measurements: db.collection<MeasurementDoc>('measurements'),
  }
}

/** Sessions stored before October 2026 hold null for a value never entered; the app treats that as absent. */
function cleanSet(s: LoggedSet): LoggedSet {
  const out: LoggedSet = { done: s.done }
  if (s.weight != null) out.weight = s.weight
  if (s.reps != null) out.reps = s.reps
  if (s.seconds != null) out.seconds = s.seconds
  if (s.left != null) out.left = s.left
  return out
}

function toWorkout(doc: WorkoutDoc): Workout {
  const { _id, userId: _owner, ...rest } = doc
  return { id: _id.toHexString(), ...rest, entries: rest.entries.map((e) => ({ ...e, sets: e.sets.map(cleanSet) })) }
}

function strip<T extends { _id: string }>(doc: T): Omit<T, '_id'> {
  const { _id: _ignored, ...rest } = doc
  return rest
}

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new Error('Not found')
  return new ObjectId(id)
}

// ---- settings ----

export async function getSettings(userId: string): Promise<Settings> {
  const { settings } = await cols()
  const doc = await settings.findOne({ _id: userId })
  return doc ? { ...DEFAULT_SETTINGS, ...strip(doc) } : { ...DEFAULT_SETTINGS }
}

export async function saveSettings(userId: string, patch: Partial<Settings>): Promise<Settings> {
  const { settings } = await cols()
  const set: Partial<Settings> = { ...patch }
  if (patch.setupDone) {
    // The join date is stamped once, the first time setup completes, and never moves.
    const existing = await settings.findOne({ _id: userId }, { projection: { joinedAt: 1 } })
    if (!existing?.joinedAt) set.joinedAt = new Date().toISOString()
  }
  await settings.updateOne({ _id: userId }, { $set: set, $setOnInsert: { _id: userId } }, { upsert: true })
  return getSettings(userId)
}

// ---- plan ----
//
// One plan per split the user has been on, in `plans`, keyed by user and split id (`custom` for an
// uploaded plan). Settings name the current split. Switching away keeps the plan; switching back
// finds it as it was left.

/** The split the user is on: a template id, `custom`, or the default before anything was chosen. */
async function currentSource(userId: string): Promise<PlanSource> {
  const settings = await getSettings(userId)
  return settings.split ?? DEFAULT_SPLIT
}

async function findPlan(userId: string, split: PlanSource): Promise<PlanDoc | null> {
  const { plans } = await cols()
  return plans.findOne({ userId, split })
}

function toPlan(doc: PlanDoc): Plan {
  return { days: doc.days, updatedAt: doc.updatedAt }
}

/** Writes the days into the slot for one split, creating the slot when it is new. */
async function savePlanFor(userId: string, split: PlanSource, days: PlanDay[]): Promise<Plan> {
  const { plans } = await cols()
  const updated = { days, updatedAt: new Date().toISOString() }
  await plans.updateOne({ userId, split }, { $set: updated, $setOnInsert: { userId, split } }, { upsert: true })
  return updated
}

/**
 * Before plans were kept per split, the one plan sat in `plan` under the user id. The first read
 * moves it into the slot for the split the user is on.
 */
async function migrateLegacyPlan(userId: string, split: PlanSource): Promise<Plan | null> {
  const { plan } = await cols()
  const legacy = await plan.findOne({ _id: userId })
  if (!legacy) return null
  const moved = await savePlanFor(userId, split, legacy.days)
  await plan.deleteOne({ _id: userId })
  return moved
}

/** The plan for the split the user is on, built from its template the first time. */
export async function getPlan(userId: string): Promise<Plan> {
  let source = await currentSource(userId)
  const doc = await findPlan(userId, source)
  if (doc) return toPlan(doc)
  const legacy = await migrateLegacyPlan(userId, source)
  if (legacy) return legacy
  if (source === 'custom') {
    // Nothing uploaded survives for this account; fall back to the default template.
    source = DEFAULT_SPLIT
    await saveSettings(userId, { split: source })
  }
  return savePlanFor(userId, source, await splitTemplate(source))
}

/** Saves the plan for the split the user is on. */
async function savePlan(userId: string, next: Plan): Promise<Plan> {
  return savePlanFor(userId, await currentSource(userId), next.days)
}

/** Back to the template of the split the user is on, edits and swaps gone. Logged workouts stay. */
export async function resetPlan(userId: string): Promise<Plan> {
  const source = await currentSource(userId)
  if (source === 'custom') throw new Error('A custom plan has no template to go back to')
  return savePlanFor(userId, source, await splitTemplate(source))
}

/**
 * Moves to another split: remembers the choice and shows that split's plan, as the user left it,
 * or fresh from the template the first time. The plan being left stays for when they come back.
 */
export async function applySplit(userId: string, split: SplitId): Promise<Plan> {
  // Read the template first: an unknown id throws before anything is written.
  const template = await splitTemplate(split)
  await saveSettings(userId, { split })
  const existing = await findPlan(userId, split)
  return existing ? toPlan(existing) : savePlanFor(userId, split, template)
}

/** Rolling or by weekday. Going by weekday gives every day without one a sensible weekday. */
export async function setSchedule(userId: string, schedule: Schedule): Promise<{ settings: Settings; plan: Plan }> {
  const settings = await saveSettings(userId, { schedule })
  let plan = await getPlan(userId)
  if (schedule === 'weekday') {
    const days = assignWeekdays(plan.days)
    if (days !== plan.days) plan = await savePlan(userId, { ...plan, days })
  }
  return { settings, plan }
}

export async function setDayWeekday(userId: string, dayId: string, weekday: number): Promise<Plan> {
  const plan = await getPlan(userId)
  const day = plan.days.find((d) => d.id === dayId)
  if (!day) throw new Error('Day not found')
  day.weekday = weekday
  return savePlan(userId, plan)
}

/**
 * An uploaded plan. `split` is the template it was downloaded as, and the plan takes that split's
 * slot; without one the plan is custom. Logged workouts are untouched.
 */
export async function replacePlan(userId: string, days: PlanDay[], split?: SplitId): Promise<Plan> {
  if (days.length === 0) throw new Error('The plan needs at least one day')
  if (days.some((d) => d.exercises.length === 0)) throw new Error('Every day needs at least one exercise')
  if (split) await splitTemplate(split) // an unknown template id throws here
  const source: PlanSource = split ?? 'custom'
  await saveSettings(userId, { split: source })
  return savePlanFor(userId, source, days)
}

export type ExercisePatch = Partial<Omit<Exercise, 'id'>>

export async function updateExercise(
  userId: string,
  dayId: string,
  exerciseId: string,
  patch: ExercisePatch,
): Promise<Plan> {
  const plan = await getPlan(userId)
  const day = plan.days.find((d) => d.id === dayId)
  const ex = day?.exercises.find((e) => e.id === exerciseId)
  if (!day || !ex) throw new Error('Exercise not found')
  Object.assign(ex, patch)
  return savePlan(userId, plan)
}

/** Replace an exercise with one of its alternates. The old one becomes an alternate so you can swap back. */
export async function swapExercise(userId: string, dayId: string, exerciseId: string, newName: string): Promise<Plan> {
  const plan = await getPlan(userId)
  const day = plan.days.find((d) => d.id === dayId)
  const ex = day?.exercises.find((e) => e.id === exerciseId)
  if (!day || !ex) throw new Error('Exercise not found')
  const name = newName.trim()
  if (!name) throw new Error('Name is empty')
  const others = (ex.alternates ?? []).filter((a) => a !== name)
  ex.alternates = [ex.name, ...others]
  ex.name = name
  ex.id = uniqueId(
    slug(name),
    day.exercises.filter((e) => e !== ex).map((e) => e.id),
  )
  return savePlan(userId, plan)
}

function uniqueId(base: string, taken: string[]): string {
  let id = base
  let n = 2
  while (taken.includes(id)) id = `${base}-${n++}`
  return id
}

/** Adds an exercise to the end of a day. A day holds `MAX_EXERCISES_PER_DAY` at most. */
export async function addExercise(userId: string, dayId: string, input: Omit<Exercise, 'id'>): Promise<Plan> {
  const plan = await getPlan(userId)
  const day = plan.days.find((d) => d.id === dayId)
  if (!day) throw new Error('Day not found')
  if (day.exercises.length >= MAX_EXERCISES_PER_DAY) {
    throw new Error(`A day holds up to ${MAX_EXERCISES_PER_DAY} exercises`)
  }
  const id = uniqueId(
    slug(input.name),
    day.exercises.map((e) => e.id),
  )
  day.exercises.push({ ...input, id })
  return savePlan(userId, plan)
}

/** Takes an exercise off a day. Logged sessions keep their copy. A day keeps at least one exercise. */
export async function removeExercise(userId: string, dayId: string, exerciseId: string): Promise<Plan> {
  const plan = await getPlan(userId)
  const day = plan.days.find((d) => d.id === dayId)
  if (!day || !day.exercises.some((e) => e.id === exerciseId)) throw new Error('Exercise not found')
  if (day.exercises.length <= 1) throw new Error('A day needs at least one exercise')
  day.exercises = day.exercises.filter((e) => e.id !== exerciseId)
  return savePlan(userId, plan)
}

// ---- days ----

/** A new day of one type at the end of the plan, with the block's exercises. Up to 14 days. */
export async function addDay(userId: string, type: DayType): Promise<Plan> {
  const [plan, settings] = await Promise.all([getPlan(userId), getSettings(userId)])
  if (plan.days.length >= MAX_DAYS) throw new Error(`A plan holds up to ${MAX_DAYS} days`)
  plan.days.push(buildDay(type, plan.days))
  if (settings.schedule === 'weekday') plan.days = assignWeekdays(plan.days)
  return savePlan(userId, plan)
}

/** Renames a day or changes its kind. The exercises stay. */
export async function updateDay(
  userId: string,
  dayId: string,
  patch: { name?: string; type?: DayType },
): Promise<Plan> {
  const plan = await getPlan(userId)
  const day = plan.days.find((d) => d.id === dayId)
  if (!day) throw new Error('Day not found')
  if (patch.name !== undefined) day.name = patch.name
  if (patch.type !== undefined) day.type = patch.type
  return savePlan(userId, plan)
}

/** Takes a day out of the plan. Logged sessions keep their copy. A plan keeps at least one day. */
export async function removeDay(userId: string, dayId: string): Promise<Plan> {
  const plan = await getPlan(userId)
  if (!plan.days.some((d) => d.id === dayId)) throw new Error('Day not found')
  if (plan.days.length <= 1) throw new Error('A plan needs at least one day')
  plan.days = plan.days.filter((d) => d.id !== dayId)
  return savePlan(userId, plan)
}

/** Moves a day one place up or down the rolling order. */
export async function moveDay(userId: string, dayId: string, direction: 'up' | 'down'): Promise<Plan> {
  const plan = await getPlan(userId)
  const i = plan.days.findIndex((d) => d.id === dayId)
  if (i < 0) throw new Error('Day not found')
  const j = direction === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= plan.days.length) return plan
  const days = [...plan.days]
  ;[days[i], days[j]] = [days[j], days[i]]
  plan.days = days
  return savePlan(userId, plan)
}

/** A plan of the user's own, one block per chosen type, in the custom slot. */
export async function createCustomPlan(userId: string, types: DayType[]): Promise<Plan> {
  return replacePlan(userId, buildCustomDays(types))
}

// ---- workouts ----

export async function getActiveWorkout(userId: string): Promise<Workout | null> {
  const { workouts } = await cols()
  const doc = await workouts.findOne({ userId, status: 'in_progress' }, { sort: { startedAt: -1 } })
  return doc ? toWorkout(doc) : null
}

export async function lastFinishedWorkout(userId: string): Promise<Workout | null> {
  const { workouts } = await cols()
  const doc = await workouts.findOne({ userId, status: 'done' }, { sort: { finishedAt: -1 } })
  return doc ? toWorkout(doc) : null
}

/**
 * The last few finished sessions of an exercise, newest first, with how each felt. Sessions on the
 * same plan day come first (Chest and back A learns from A, not B); any day serves when that day has
 * no history yet.
 */
export async function recentEntries(
  userId: string,
  exerciseId: string,
  dayId: string,
  limit = STALL_SESSIONS,
): Promise<PastEntry[]> {
  const { workouts } = await cols()
  const match = { userId, status: 'done' as const, entries: { $elemMatch: { exerciseId, 'sets.done': true } } }
  let docs = await workouts.find({ ...match, dayId }, { sort: { finishedAt: -1 }, limit }).toArray()
  if (docs.length === 0) docs = await workouts.find(match, { sort: { finishedAt: -1 }, limit }).toArray()
  return docs.flatMap((doc) => {
    const entry = toWorkout(doc).entries.find((e) => e.exerciseId === exerciseId)
    return entry ? [{ entry, effort: doc.effort }] : []
  })
}

/** The last finished session of an exercise, on any day. */
export async function lastFinishedEntry(userId: string, exerciseId: string): Promise<WorkoutEntry | undefined> {
  const { workouts } = await cols()
  const doc = await workouts.findOne(
    { userId, status: 'done', entries: { $elemMatch: { exerciseId, 'sets.done': true } } },
    { sort: { finishedAt: -1 } },
  )
  return doc?.entries.find((e) => e.exerciseId === exerciseId)
}

export async function startWorkout(userId: string, dayId: string): Promise<Workout> {
  const [plan, settings] = await Promise.all([getPlan(userId), getSettings(userId)])
  const day = plan.days.find((d) => d.id === dayId)
  if (!day) throw new Error('Day not found')
  const { workouts } = await cols()
  await workouts.deleteMany({ userId, status: 'in_progress' })

  const entries: WorkoutEntry[] = []
  for (const ex of day.exercises) {
    const targetSets = plannedSetsFor(ex.sets, settings.trainingAge)
    const history = await recentEntries(userId, ex.id, dayId)
    const s = suggestNext(ex, targetSets, history, settings.units, progressionOf(settings))
    entries.push({
      exerciseId: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      loadType: ex.loadType,
      repMin: ex.repMin,
      repMax: ex.repMax,
      ...(s.hint ? { hint: s.hint } : {}),
      ...(s.suggested ? { suggested: s.suggested } : {}),
      sets: s.sets,
    })
  }

  const doc: WorkoutDoc = {
    _id: new ObjectId(),
    userId,
    dayId: day.id,
    dayName: day.name,
    dayType: day.type,
    startedAt: new Date().toISOString(),
    status: 'in_progress',
    entries,
  }
  await workouts.insertOne(doc)
  return toWorkout(doc)
}

export async function saveEntrySets(
  userId: string,
  workoutId: string,
  exerciseId: string,
  sets: LoggedSet[],
): Promise<void> {
  const { workouts } = await cols()
  const res = await workouts.updateOne(
    { _id: oid(workoutId), userId, 'entries.exerciseId': exerciseId },
    { $set: { 'entries.$.sets': sets } },
  )
  if (res.matchedCount === 0) throw new Error('Workout or exercise not found')
}

export interface FinishExtra {
  effort?: number
  note?: string
}

/**
 * Marks the workout done and says what it did: each lift's best set, new bests, and the week's count.
 * A workout with nothing checked is deleted instead.
 */
export async function finishWorkout(
  userId: string,
  workoutId: string,
  extra: FinishExtra = {},
): Promise<{ finished: boolean; summary?: SessionSummary }> {
  const { workouts } = await cols()
  const _id = oid(workoutId)
  const doc = await workouts.findOne({ _id, userId })
  if (!doc) throw new Error('Workout not found')
  const anyDone = doc.entries.some((e) => e.sets.some((s) => s.done))
  if (!anyDone) {
    await workouts.deleteOne({ _id, userId })
    return { finished: false }
  }
  const now = new Date()
  const patch: Partial<WorkoutDoc> = { status: 'done', finishedAt: now.toISOString() }
  if (extra.effort !== undefined) patch.effort = extra.effort
  if (extra.note) patch.note = extra.note
  // Earlier sessions are read before this one joins them.
  const [past, settings, plan, weighIns] = await Promise.all([
    listWorkouts(userId, { sinceDays: 365 }),
    getSettings(userId),
    getPlan(userId),
    listBodyweights(userId),
  ])
  await workouts.updateOne({ _id, userId }, { $set: patch })
  const earlier = attachBodyweight(past, weighIns)
  const [done] = attachBodyweight([{ ...toWorkout(doc), ...patch } as Workout], weighIns)
  const week = { done: sessionsInWeek(earlier, now) + 1, planned: plannedPerWeek(plan, settings) }
  return { finished: true, summary: summarize(done, earlier, settings.units, week) }
}

export async function discardWorkout(userId: string, workoutId: string): Promise<void> {
  const { workouts } = await cols()
  await workouts.deleteOne({ _id: oid(workoutId), userId, status: 'in_progress' })
}

/** Replaces the sets of the named exercises in a finished session. Unknown exercises are ignored. */
export async function updateWorkoutSets(
  userId: string,
  workoutId: string,
  changes: { exerciseId: string; sets: LoggedSet[] }[],
): Promise<Workout> {
  const { workouts } = await cols()
  const _id = oid(workoutId)
  const doc = await workouts.findOne({ _id, userId })
  if (!doc) throw new Error('Workout not found')
  const byId = new Map(changes.map((c) => [c.exerciseId, c.sets]))
  const entries = doc.entries.map((e) => (byId.has(e.exerciseId) ? { ...e, sets: byId.get(e.exerciseId)! } : e))
  await workouts.updateOne({ _id, userId }, { $set: { entries } })
  return toWorkout({ ...doc, entries })
}

export async function deleteWorkout(userId: string, workoutId: string): Promise<void> {
  const { workouts } = await cols()
  await workouts.deleteOne({ _id: oid(workoutId), userId })
}

export async function listWorkouts(
  userId: string,
  opts: { sinceDays?: number; limit?: number } = {},
): Promise<Workout[]> {
  const { workouts } = await cols()
  const filter: Record<string, unknown> = { userId, status: 'done' }
  if (opts.sinceDays) {
    const since = new Date()
    since.setDate(since.getDate() - opts.sinceDays)
    filter.finishedAt = { $gte: since.toISOString() }
  }
  const docs = await workouts
    .find(filter)
    .sort({ finishedAt: -1 })
    .limit(opts.limit ?? 500)
    .toArray()
  return docs.map(toWorkout)
}

// ---- body ----

function localDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type Measures = { arm?: number; chest?: number; waist?: number }

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** Settings carry the most recent weigh-in, so a backfilled older entry never overwrites it. */
async function syncSettingsWeight(userId: string): Promise<void> {
  const { bodyweights } = await cols()
  const latest = await bodyweights.findOne({ userId }, { sort: { date: -1 } })
  if (latest) await saveSettings(userId, { bodyweight: latest.weight })
}

/**
 * One weigh-in per calendar day. Logging again the same day replaces the earlier value.
 * `date` is when it happened: now by default, or an earlier instant for a day that was missed.
 */
export async function logBodyweight(
  userId: string,
  weight: number,
  day?: string,
  date = new Date(),
): Promise<BodyweightLog & { replaced: boolean }> {
  const { bodyweights } = await cols()
  const key = day ?? localDay(date)
  const existing = await bodyweights.findOne({ userId, day: key })
  if (existing) {
    await bodyweights.updateOne({ _id: existing._id }, { $set: { weight, date: date.toISOString() } })
    await syncSettingsWeight(userId)
    return { id: existing._id.toHexString(), date: date.toISOString(), day: key, weight, replaced: true }
  }
  const doc: BodyweightDoc = { _id: new ObjectId(), userId, date: date.toISOString(), day: key, weight }
  await bodyweights.insertOne(doc)
  await syncSettingsWeight(userId)
  return { id: doc._id.toHexString(), date: doc.date, day: key, weight, replaced: false }
}

export async function updateBodyweight(userId: string, id: string, weight: number): Promise<void> {
  const { bodyweights } = await cols()
  const res = await bodyweights.updateOne({ _id: oid(id), userId }, { $set: { weight } })
  if (res.matchedCount === 0) throw new Error('Log not found')
  await syncSettingsWeight(userId)
}

export async function deleteBodyweight(userId: string, id: string): Promise<void> {
  const { bodyweights } = await cols()
  await bodyweights.deleteOne({ _id: oid(id), userId })
}

export async function listBodyweights(userId: string, limit = 120): Promise<BodyweightLog[]> {
  const { bodyweights } = await cols()
  const docs = await bodyweights.find({ userId }).sort({ date: -1 }).limit(limit).toArray()
  return docs.map(({ _id, userId: _owner, ...rest }) => ({ id: _id.toHexString(), ...rest })).reverse()
}

/** One tape entry per calendar day. Logging again the same day merges into it. */
export async function logMeasurement(
  userId: string,
  m: Measures,
  day?: string,
  date = new Date(),
): Promise<MeasurementLog & { replaced: boolean }> {
  const { measurements } = await cols()
  const key = day ?? localDay(date)
  const values = definedOnly(m)
  const existing = await measurements.findOne({ userId, day: key })
  if (existing) {
    await measurements.updateOne({ _id: existing._id }, { $set: { ...values, date: date.toISOString() } })
    const { _id, userId: _owner, ...rest } = existing
    return { id: _id.toHexString(), ...rest, ...values, date: date.toISOString(), replaced: true }
  }
  const doc: MeasurementDoc = { _id: new ObjectId(), userId, date: date.toISOString(), day: key, ...values }
  await measurements.insertOne(doc)
  const { _id, userId: _owner, ...rest } = doc
  return { id: _id.toHexString(), ...rest, replaced: false }
}

export async function updateMeasurement(userId: string, id: string, m: Measures): Promise<void> {
  const { measurements } = await cols()
  const res = await measurements.updateOne({ _id: oid(id), userId }, { $set: definedOnly(m) })
  if (res.matchedCount === 0) throw new Error('Log not found')
}

export async function deleteMeasurement(userId: string, id: string): Promise<void> {
  const { measurements } = await cols()
  await measurements.deleteOne({ _id: oid(id), userId })
}

export async function listMeasurements(userId: string, limit = 24): Promise<MeasurementLog[]> {
  const { measurements } = await cols()
  const docs = await measurements.find({ userId }).sort({ date: -1 }).limit(limit).toArray()
  return docs.map(({ _id, userId: _owner, ...rest }) => ({ id: _id.toHexString(), ...rest })).reverse()
}

/** Wipes this user's plans, settings and every log. The account itself stays; setup runs again. */
export async function startFresh(userId: string): Promise<void> {
  const { settings, plan, plans, workouts, bodyweights, measurements } = await cols()
  await Promise.all([
    settings.deleteOne({ _id: userId }),
    plan.deleteOne({ _id: userId }),
    plans.deleteMany({ userId }),
    workouts.deleteMany({ userId }),
    bodyweights.deleteMany({ userId }),
    measurements.deleteMany({ userId }),
  ])
}

// ---- accounts ----

/** What the deletion log keeps: nothing that points back at a person. */
interface DeletionDoc {
  at: string
  /** SHA-256 of the lower-cased email, so a second deletion of the same address can be noticed; not reversible. */
  emailHash: string
  sessions: number
  /** Days between joining and deleting, when setup had been completed. */
  daysActive?: number
}

/**
 * Removes the account and every trace of its data: the Better Auth documents (user, sessions,
 * sign-in accounts, pending verifications), settings, plans, logs, and any sign-in mail still in
 * the outbox. One line goes into `deletions`: the date, a hash of the email and the session count.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { db, settings, plan, plans, workouts, bodyweights, measurements } = await cols()
  const ids = [userId, ...(ObjectId.isValid(userId) ? [new ObjectId(userId)] : [])]
  const user = await db.collection('user').findOne({ _id: { $in: ids } as never })
  const email = typeof user?.email === 'string' ? user.email.toLowerCase() : ''
  const [sessions, joined] = await Promise.all([
    workouts.countDocuments({ userId, status: 'done' }),
    settings.findOne({ _id: userId }, { projection: { joinedAt: 1 } }),
  ])
  const log: DeletionDoc = {
    at: new Date().toISOString(),
    emailHash: createHash('sha256').update(email).digest('hex'),
    sessions,
  }
  if (joined?.joinedAt) {
    log.daysActive = Math.max(0, Math.round((Date.now() - new Date(joined.joinedAt).getTime()) / 86_400_000))
  }
  await Promise.all([
    settings.deleteOne({ _id: userId }),
    plan.deleteOne({ _id: userId }),
    plans.deleteMany({ userId }),
    workouts.deleteMany({ userId }),
    bodyweights.deleteMany({ userId }),
    measurements.deleteMany({ userId }),
    db.collection('session').deleteMany({ userId: { $in: ids } }),
    db.collection('account').deleteMany({ userId: { $in: ids } }),
    ...(email
      ? [
          // Better Auth keys pending links and codes by the address, lower-cased, sometimes with a prefix.
          db
            .collection('verification')
            .deleteMany({ identifier: { $in: [email, `email-verification-otp-${email}`, `sign-in-otp-${email}`] } }),
          db.collection('mail_outbox').deleteMany({ to: email }),
        ]
      : []),
  ])
  await db.collection('user').deleteOne({ _id: { $in: ids } as never })
  await db.collection<DeletionDoc>('deletions').insertOne(log)
}

/**
 * Before accounts, the one user's data lived under fixed ids and without a userId.
 * The first account created on this database takes it over, once. Later accounts start empty.
 */
export async function claimLegacyData(userId: string): Promise<void> {
  const { db, settings, plan, workouts, bodyweights, measurements } = await cols()
  const users = await db.collection('user').countDocuments({}, { limit: 2 })
  if (users > 1) return

  const legacySettings = await settings.findOne({ _id: 'settings' })
  if (legacySettings) {
    await settings.updateOne({ _id: userId }, { $set: strip(legacySettings) }, { upsert: true })
    await settings.deleteOne({ _id: 'settings' })
  }
  const legacyPlan = await plan.findOne({ _id: 'plan' })
  if (legacyPlan) {
    await savePlanFor(userId, await currentSource(userId), legacyPlan.days)
    await plan.deleteOne({ _id: 'plan' })
  }
  const orphaned = { userId: { $exists: false } }
  await Promise.all([
    workouts.updateMany(orphaned, { $set: { userId } }),
    bodyweights.updateMany(orphaned, { $set: { userId } }),
    measurements.updateMany(orphaned, { $set: { userId } }),
  ])
}

// ---- screen data ----

export interface TodayData {
  settings: Settings
  plan: Plan
  active: Workout | null
  nextDayId: string
  lastFinished: { dayName: string; finishedAt: string } | null
  /** Sessions finished in the last year: this week's for the weekday schedule, all of them for the streak. */
  recent: Finished[]
  lastBodyweightAt: string | null
  lastMeasurementAt: string | null
  /** Lifts that stopped moving, a week running out, a scale that is not moving. */
  alerts: Alert[]
}

export async function getTodayData(userId: string): Promise<TodayData> {
  const { measurements } = await cols()
  const now = new Date()
  const [settings, plan, active, last, recent, bodyweights, lastMeasure] = await Promise.all([
    getSettings(userId),
    getPlan(userId),
    getActiveWorkout(userId),
    lastFinishedWorkout(userId),
    listWorkouts(userId, { sinceDays: 365 }),
    listBodyweights(userId, 60),
    measurements.findOne({ userId }, { sort: { date: -1 } }),
  ])
  const alerts: Alert[] = [
    ...stallAlerts(attachBodyweight(recent, bodyweights), now),
    weekAlert(sessionsInWeek(recent, now), plannedPerWeek(plan, settings), now),
    bodyweightAlert(bodyweights, settings.goal, settings.units, now),
  ].filter((a): a is Alert => a !== null)
  return {
    settings,
    plan,
    active,
    nextDayId: nextDayId(plan.days, last?.dayId),
    lastFinished: last ? { dayName: last.dayName, finishedAt: last.finishedAt! } : null,
    recent: recent.map((w) => ({ dayId: w.dayId, finishedAt: w.finishedAt! })),
    lastBodyweightAt: bodyweights.at(-1)?.date ?? null,
    lastMeasurementAt: lastMeasure?.date ?? null,
    alerts,
  }
}

export interface HistoryData {
  settings: Settings
  workouts: Workout[]
}

export async function getHistoryData(userId: string): Promise<HistoryData> {
  const [settings, workouts] = await Promise.all([getSettings(userId), listWorkouts(userId, { limit: 100 })])
  return { settings, workouts }
}

export interface ExportData {
  settings: Settings
  workouts: Workout[]
  bodyweights: BodyweightLog[]
  measurements: MeasurementLog[]
}

/** Everything the spreadsheet export needs: every finished session and every body log. */
export async function getExportData(userId: string): Promise<ExportData> {
  const [settings, workouts, bodyweights, measurements] = await Promise.all([
    getSettings(userId),
    listWorkouts(userId, { limit: 5000 }),
    listBodyweights(userId, 5000),
    listMeasurements(userId, 5000),
  ])
  return { settings, workouts, bodyweights, measurements }
}

export interface StatsData {
  settings: Settings
  plan: Plan
  workouts: Workout[]
  bodyweights: BodyweightLog[]
  measurements: MeasurementLog[]
}

export async function getStatsData(userId: string): Promise<StatsData> {
  const [settings, plan, workouts, bodyweights, measurements] = await Promise.all([
    getSettings(userId),
    getPlan(userId),
    listWorkouts(userId, { sinceDays: 365 }),
    listBodyweights(userId),
    listMeasurements(userId),
  ])
  return { settings, plan, workouts: attachBodyweight(workouts, bodyweights), bodyweights, measurements }
}
