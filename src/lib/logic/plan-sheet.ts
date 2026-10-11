import { slug } from '../seed-plan'
import type { SplitInfo } from '../splits'
import {
  DAY_TYPES,
  SPLIT_IDS,
  type DayType,
  type Exercise,
  type LoadType,
  type Muscle,
  type Plan,
  type PlanDay,
  type SplitId,
} from '../types'
import { MUSCLES } from './stats'

/** One row of the uploaded sheet, keyed by whatever the header row said. */
export type SheetRow = Record<string, unknown>

export interface ParseWarning {
  row: number
  message: string
}

export interface ParsedPlan {
  days: PlanDay[]
  warnings: ParseWarning[]
  /** The template the file was downloaded as, when its marker is still there. */
  split?: SplitId
}

/** The cells of the Template sheet: the split id a downloaded template carries. */
export function templateMarker(split: Pick<SplitInfo, 'id' | 'name' | 'days'>): string[][] {
  return [
    ['Split', split.id],
    ['Name', split.name],
    ['Days', String(split.days)],
  ]
}

/** The first Guide line, so the template says what it is when opened. */
export function templateTitle(split: Pick<SplitInfo, 'id' | 'name' | 'days'>): string {
  return `Template: ${split.name}, ${split.days} ${split.days === 1 ? 'day' : 'days'} (${split.id})`
}

/**
 * Finds the split id in the cells of a Template or Guide sheet: a "Split" cell followed by the id,
 * or a title ending in "(id)". Undefined when the file carries no marker: a custom plan.
 */
export function splitFromMarker(cells: unknown[][]): SplitId | undefined {
  const ids = new Set<string>(SPLIT_IDS)
  for (const row of cells) {
    for (let i = 0; i < row.length; i++) {
      const v = String(row[i] ?? '').trim()
      if (v.toLowerCase() === 'split' && ids.has(String(row[i + 1] ?? '').trim())) {
        return String(row[i + 1]).trim() as SplitId
      }
      const m = /\((\w+)\)\s*$/.exec(v)
      if (m && ids.has(m[1])) return m[1] as SplitId
    }
  }
  return undefined
}

export const TEMPLATE_HEADERS = [
  'Day',
  'Type',
  'Exercise',
  'Sets',
  'Reps',
  'Load',
  'Muscle',
  'Note',
  'Alternates',
] as const

export const GUIDE_LINES: string[][] = [
  ['How to fill the Plan sheet'],
  ['One row per exercise. Keep the header row as it is.'],
  ['Day: the session name, like Push A. Leave it blank on following rows to keep the same day.'],
  [`Type: one of ${DAY_TYPES.join(', ')}. Blank is fine, it is guessed from the day name.`],
  ['Exercise: the name you want to see in the app.'],
  ['Sets: a whole number, like 4.'],
  ['Reps: a range like 6-10, a single number like 12, or seconds for holds like 30-45 s.'],
  ['If Excel turns 6-10 into a date, type an apostrophe first: \'6-10'],
  ['Load: weight, bodyweight or time. Blank is fine, it is guessed from the name.'],
  [`Muscle: one of ${MUSCLES.join(', ')}. Blank is fine, it is guessed from the name.`],
  ['Note: a short cue. Alternates: other exercises for the same slot, separated by commas.'],
  ['Upload the file on the Bring your own plan page. Nothing is stored until you confirm.'],
]

// ---- header matching ----

const HEADER_ALIASES: Record<string, string> = {
  day: 'day',
  dayname: 'day',
  session: 'day',
  workout: 'day',
  type: 'type',
  daytype: 'type',
  exercise: 'exercise',
  exercises: 'exercise',
  name: 'exercise',
  movement: 'exercise',
  lift: 'exercise',
  sets: 'sets',
  set: 'sets',
  reps: 'reps',
  rep: 'reps',
  reprange: 'reps',
  range: 'reps',
  repslow: 'repmin',
  low: 'repmin',
  min: 'repmin',
  repmin: 'repmin',
  repshigh: 'repmax',
  high: 'repmax',
  max: 'repmax',
  repmax: 'repmax',
  load: 'load',
  loadtype: 'load',
  kind: 'load',
  muscle: 'muscle',
  musclegroup: 'muscle',
  bodypart: 'muscle',
  note: 'note',
  notes: 'note',
  cue: 'note',
  cues: 'note',
  alternates: 'alternates',
  alternate: 'alternates',
  alternatives: 'alternates',
  swaps: 'alternates',
  swap: 'alternates',
}

function canonicalKey(header: string): string | undefined {
  return HEADER_ALIASES[header.toLowerCase().replace(/[^a-z]/g, '')]
}

function normalise(row: SheetRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const key = canonicalKey(k)
    if (key && out[key] === undefined) out[key] = v
  }
  return out
}

function text(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

// ---- guessing ----

export function guessDayType(name: string): DayType {
  const n = name.toLowerCase()
  if (/full/.test(n)) return 'full'
  if (/upper/.test(n)) return 'upper'
  if (/lower/.test(n)) return 'lower'
  if (/\barms?\b|bicep|tricep/.test(n)) return 'arms'
  if (/shoulder|delt/.test(n)) return 'shoulders'
  if (/chest/.test(n)) return 'chest'
  if (/core|\babs\b/.test(n)) return 'core'
  if (/pull/.test(n)) return 'pull'
  if (/back/.test(n)) return 'back'
  if (/leg|squat|deadlift|glute/.test(n)) return 'legs'
  return 'push'
}

/** When nothing in the exercise name gives the muscle away, the day type picks the most likely one. */
export const MUSCLE_BY_DAY: Record<DayType, Muscle> = {
  push: 'chest',
  chest: 'chest',
  upper: 'chest',
  full: 'chest',
  shoulders: 'shoulders',
  pull: 'back',
  back: 'back',
  legs: 'quads',
  lower: 'quads',
  arms: 'biceps',
  core: 'abs',
}

export function guessMuscle(name: string, dayType: DayType): Muscle {
  const n = name.toLowerCase()
  if (/calf|calves/.test(n)) return 'calves'
  if (/crunch|plank|leg raise|knee raise|rollout|l-sit|sit-up|situp|ab wheel|dead bug|hollow|\babs?\b|core/.test(n))
    return 'abs'
  if (/deadlift|\brdl\b|romanian|leg curl|hamstring|good morning|hip thrust|glute|nordic/.test(n)) return 'hamstrings'
  if (/squat|leg press|lunge|leg extension|step-?up|hack|quad|pistol/.test(n)) return 'quads'
  if (/curl/.test(n)) return 'biceps'
  if (/tricep|pushdown|skull|extension|close-?grip|kickback|jm press/.test(n)) return 'triceps'
  if (/lateral|face pull|rear delt|reverse fly|overhead press|shoulder press|military|upright row|arnold|pike|handstand|delt/.test(n))
    return 'shoulders'
  if (/row|pulldown|pull-?up|chin-?up|pullover|\blats?\b|straight-?arm/.test(n)) return 'back'
  if (/bench|press|fly|flye|push-?up|dip|chest|pec/.test(n)) return 'chest'
  return MUSCLE_BY_DAY[dayType]
}

export function guessLoad(name: string, repsText: string): LoadType {
  const n = name.toLowerCase()
  if (/\bsec|seconds?\b|\bs\b|hold|plank|l-sit/.test(`${repsText.toLowerCase()} ${n}`)) return 'time'
  if (
    /pull-?up|chin-?up|push-?up|\bdips?\b|leg raise|knee raise|rollout|hanging|inverted row|pistol|nordic|hollow|dead bug/.test(n) &&
    !/weighted/.test(n)
  )
    return 'bodyweight'
  return 'weight'
}

function parseDayType(v: string): DayType | undefined {
  const t = v.toLowerCase().trim()
  return DAY_TYPES.find((d) => d === t || t.startsWith(d))
}

function parseLoad(v: string): LoadType | undefined {
  const t = v.toLowerCase().trim()
  if (!t) return undefined
  if (/^(weight|weighted|loaded|barbell|dumbbell|machine|cable)/.test(t)) return 'weight'
  if (/^(bodyweight|body weight|bw|calisthenic)/.test(t)) return 'bodyweight'
  if (/^(time|timed|hold|seconds|sec|isometric)/.test(t)) return 'time'
  return undefined
}

const MUSCLE_ALIASES: Record<string, Muscle> = {
  chest: 'chest',
  pecs: 'chest',
  back: 'back',
  lats: 'back',
  shoulders: 'shoulders',
  shoulder: 'shoulders',
  delts: 'shoulders',
  biceps: 'biceps',
  bicep: 'biceps',
  triceps: 'triceps',
  tricep: 'triceps',
  quads: 'quads',
  quad: 'quads',
  legs: 'quads',
  hamstrings: 'hamstrings',
  hams: 'hamstrings',
  glutes: 'hamstrings',
  calves: 'calves',
  calf: 'calves',
  abs: 'abs',
  core: 'abs',
}

function parseMuscle(v: string): Muscle | undefined {
  return MUSCLE_ALIASES[v.toLowerCase().replace(/[^a-z]/g, '')]
}

export interface RepRange {
  min: number
  max: number
}

/** Reads "6-10", "12", "45-60 s", "10 each leg". A Date means Excel ate "6-10"; month and day get it back. */
export function parseReps(v: unknown): { range?: RepRange; fromDate?: boolean } {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { range: { min: v.getMonth() + 1, max: v.getDate() }, fromDate: true }
  }
  const t = text(v)
  if (!t) return {}
  const nums = t.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (nums.length === 0) return {}
  if (nums.length === 1) return { range: { min: nums[0], max: nums[0] } }
  return { range: { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) } }
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base || 'exercise'
  let n = 2
  while (taken.has(id)) id = `${base}-${n++}`
  taken.add(id)
  return id
}

// ---- parse ----

/** Turns sheet rows (header row already applied as keys) into plan days. Never throws. */
export function parseRows(rows: SheetRow[]): ParsedPlan {
  const warnings: ParseWarning[] = []
  const days: PlanDay[] = []
  const dayIds = new Set<string>()
  const exerciseIds = new Map<string, Set<string>>()
  let current: PlanDay | undefined

  rows.forEach((raw, i) => {
    const rowNo = i + 2
    const r = normalise(raw)
    const dayName = text(r.day)
    const exerciseName = text(r.exercise)
    // A fully blank line is just spacing. A line with numbers but no name is a mistake worth flagging.
    if (!Object.values(r).some((v) => text(v) !== '')) return

    if (dayName) {
      const existing = days.find((d) => d.name.toLowerCase() === dayName.toLowerCase())
      if (existing) current = existing
      else {
        const type = parseDayType(text(r.type)) ?? guessDayType(dayName)
        current = { id: uniqueId(slug(dayName), dayIds), name: dayName, type, exercises: [] }
        days.push(current)
        exerciseIds.set(current.id, new Set())
      }
    }

    if (!exerciseName) {
      warnings.push({ row: rowNo, message: 'No exercise name, row skipped.' })
      return
    }
    if (!current) {
      warnings.push({ row: rowNo, message: 'No day name above this row, row skipped.' })
      return
    }

    const setsNum = Number.parseInt(text(r.sets), 10)
    let sets = setsNum
    if (!Number.isFinite(setsNum) || setsNum < 1) {
      sets = 3
      warnings.push({ row: rowNo, message: `Sets missing for ${exerciseName}, used 3.` })
    }
    sets = Math.min(sets, 10)

    let range: RepRange | undefined
    const lo = Number.parseInt(text(r.repmin), 10)
    const hi = Number.parseInt(text(r.repmax), 10)
    if (Number.isFinite(lo) || Number.isFinite(hi)) {
      const a = Number.isFinite(lo) ? lo : hi
      const b = Number.isFinite(hi) ? hi : lo
      range = { min: Math.min(a, b), max: Math.max(a, b) }
    } else {
      const parsed = parseReps(r.reps)
      range = parsed.range
      if (parsed.fromDate) {
        warnings.push({
          row: rowNo,
          message: `Reps for ${exerciseName} looked like a date. Read it as ${range!.min}-${range!.max}. Check it.`,
        })
      }
    }
    if (!range || range.min < 1) {
      range = { min: 8, max: 12 }
      warnings.push({ row: rowNo, message: `Reps missing for ${exerciseName}, used 8-12.` })
    }
    range = { min: Math.min(range.min, 600), max: Math.min(range.max, 600) }

    const repsText = text(r.reps)
    const loadType = parseLoad(text(r.load)) ?? guessLoad(exerciseName, repsText)
    const muscle = parseMuscle(text(r.muscle)) ?? guessMuscle(exerciseName, current.type)
    const note = text(r.note).slice(0, 200)
    const alternates = text(r.alternates)
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)

    const ex: Exercise = {
      id: uniqueId(slug(exerciseName), exerciseIds.get(current.id)!),
      name: exerciseName.slice(0, 80),
      sets,
      repMin: range.min,
      repMax: range.max,
      muscle,
      loadType,
      ...(note ? { note } : {}),
      ...(alternates.length ? { alternates } : {}),
    }
    current.exercises.push(ex)
  })

  const kept = days.filter((d) => d.exercises.length > 0)
  if (kept.length === 0) warnings.push({ row: 0, message: 'No exercises found. Check the header row and the Exercise column.' })
  return { days: kept, warnings }
}

// ---- export ----

export type TemplateRow = Record<(typeof TEMPLATE_HEADERS)[number], string | number>

function repsText(e: Exercise): string {
  const range = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}-${e.repMax}`
  return e.loadType === 'time' ? `${range} s` : range
}

/** The live plan as template rows, one per exercise. The day name is repeated on every row for easy sorting. */
export function planToRows(plan: Pick<Plan, 'days'>): TemplateRow[] {
  const rows: TemplateRow[] = []
  for (const d of plan.days) {
    for (const e of d.exercises) {
      rows.push({
        Day: d.name,
        Type: d.type,
        Exercise: e.name,
        Sets: e.sets,
        Reps: repsText(e),
        Load: e.loadType,
        Muscle: e.muscle,
        Note: e.note ?? '',
        Alternates: (e.alternates ?? []).join(', '),
      })
    }
  }
  return rows
}
