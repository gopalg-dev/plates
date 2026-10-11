import { ObjectId, type Db } from 'mongodb'
import { nextDayId } from '#/lib/logic/next-day'
import { suggestNext } from '#/lib/logic/progression'
import { assignWeekdays, type Finished } from '#/lib/logic/schedule'
import { plannedSetsFor } from '#/lib/logic/stats'
import { slug } from '#/lib/seed-plan'
import { buildSplit, templateOf } from '#/lib/splits'
import {
  MAX_EXERCISES_PER_DAY,
  type BodyweightLog,
  type Exercise,
  type LoggedSet,
  type MeasurementLog,
  type Plan,
  type PlanDay,
  type Schedule,
  type Settings,
  type SplitId,
  type Workout,
  type WorkoutEntry,
} from '#/lib/types'
import { getDb } from './db'

// Every document belongs to one user. Settings and plan use the user id as their _id;
// the log collections carry a userId field, and every query filters on it.

type SettingsDoc = Settings & { _id: string }
type PlanDoc = Plan & { _id: string }
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
    db.collection('workouts').createIndexes([
      { key: { userId: 1, status: 1, finishedAt: -1 } },
      { key: { userId: 1, startedAt: -1 } },
    ]),
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
    plan: db.collection<PlanDoc>('plan'),
    workouts: db.collection<WorkoutDoc>('workouts'),
    bodyweights: db.collection<BodyweightDoc>('bodyweights'),
    measurements: db.collection<MeasurementDoc>('measurements'),
  }
}

function toWorkout(doc: WorkoutDoc): Workout {
  const { _id, userId: _owner, ...rest } = doc
  return { id: _id.toHexString(), ...rest }
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

/** The user's chosen template, built fresh. */
async function templatePlan(userId: string): Promise<Plan> {
  const settings = await getSettings(userId)
  return { days: buildSplit(templateOf(settings.split)), updatedAt: new Date().toISOString() }
}

export async function getPlan(userId: string): Promise<Plan> {
  const { plan } = await cols()
  const doc = await plan.findOne({ _id: userId })
  if (doc) return strip(doc)
  const fresh = await templatePlan(userId)
  await plan.updateOne({ _id: userId }, { $setOnInsert: { _id: userId, ...fresh } }, { upsert: true })
  return fresh
}

async function savePlan(userId: string, next: Plan): Promise<Plan> {
  const { plan } = await cols()
  const updated = { ...next, updatedAt: new Date().toISOString() }
  await plan.updateOne({ _id: userId }, { $set: updated }, { upsert: true })
  return updated
}

/** Back to the chosen template, edits and swaps gone. Logged workouts stay. */
export async function resetPlan(userId: string): Promise<Plan> {
  return savePlan(userId, await templatePlan(userId))
}

/** Switches to another template: remembers the choice and starts the plan over from it. */
export async function applySplit(userId: string, split: SplitId): Promise<Plan> {
  await saveSettings(userId, { split })
  return savePlan(userId, { days: buildSplit(split), updatedAt: new Date().toISOString() })
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

/** Swaps the whole plan for days the user brought in. Logged workouts are untouched. */
/** An uploaded plan. `split` is the template it was downloaded as; without one the plan is custom. */
export async function replacePlan(userId: string, days: PlanDay[], split?: SplitId): Promise<Plan> {
  if (days.length === 0) throw new Error('The plan needs at least one day')
  if (days.some((d) => d.exercises.length === 0)) throw new Error('Every day needs at least one exercise')
  await saveSettings(userId, { split: split ?? 'custom' })
  return savePlan(userId, { days, updatedAt: new Date().toISOString() })
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
    const last = await lastFinishedEntry(userId, ex.id)
    const s = suggestNext(ex, targetSets, last, settings.units)
    entries.push({
      exerciseId: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      loadType: ex.loadType,
      repMin: ex.repMin,
      repMax: ex.repMax,
      ...(s.hint ? { hint: s.hint } : {}),
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

/** Marks the workout done. A workout with nothing checked is deleted instead. */
export async function finishWorkout(
  userId: string,
  workoutId: string,
  extra: FinishExtra = {},
): Promise<{ finished: boolean }> {
  const { workouts } = await cols()
  const _id = oid(workoutId)
  const doc = await workouts.findOne({ _id, userId })
  if (!doc) throw new Error('Workout not found')
  const anyDone = doc.entries.some((e) => e.sets.some((s) => s.done))
  if (!anyDone) {
    await workouts.deleteOne({ _id, userId })
    return { finished: false }
  }
  const patch: Partial<WorkoutDoc> = { status: 'done', finishedAt: new Date().toISOString() }
  if (extra.effort !== undefined) patch.effort = extra.effort
  if (extra.note) patch.note = extra.note
  await workouts.updateOne({ _id, userId }, { $set: patch })
  return { finished: true }
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

/** Wipes this user's plan, settings and every log. The account itself stays; setup runs again. */
export async function startFresh(userId: string): Promise<void> {
  const { settings, plan, workouts, bodyweights, measurements } = await cols()
  await Promise.all([
    settings.deleteOne({ _id: userId }),
    plan.deleteOne({ _id: userId }),
    workouts.deleteMany({ userId }),
    bodyweights.deleteMany({ userId }),
    measurements.deleteMany({ userId }),
  ])
}

// ---- accounts ----

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
    await plan.updateOne({ _id: userId }, { $set: strip(legacyPlan) }, { upsert: true })
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
}

export async function getTodayData(userId: string): Promise<TodayData> {
  const { bodyweights, measurements } = await cols()
  const [settings, plan, active, last, recent, lastWeight, lastMeasure] = await Promise.all([
    getSettings(userId),
    getPlan(userId),
    getActiveWorkout(userId),
    lastFinishedWorkout(userId),
    listWorkouts(userId, { sinceDays: 365 }),
    bodyweights.findOne({ userId }, { sort: { date: -1 } }),
    measurements.findOne({ userId }, { sort: { date: -1 } }),
  ])
  return {
    settings,
    plan,
    active,
    nextDayId: nextDayId(plan.days, last?.dayId),
    lastFinished: last ? { dayName: last.dayName, finishedAt: last.finishedAt! } : null,
    recent: recent.map((w) => ({ dayId: w.dayId, finishedAt: w.finishedAt! })),
    lastBodyweightAt: lastWeight?.date ?? null,
    lastMeasurementAt: lastMeasure?.date ?? null,
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
  return { settings, plan, workouts, bodyweights, measurements }
}
