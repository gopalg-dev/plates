import type { BodyweightLog, MeasurementLog, Units, Workout } from '../types'
import { EFFORT_LABEL, type Effort } from './effort'
import { dayKey, effectiveSets, finished } from './stats'

/**
 * Flat rows for a spreadsheet: one per logged set, oldest session first.
 * Session fields (day, effort, note) repeat on every row so a filter or pivot works on its own.
 */
export type SetRow = {
  Date: string
  Time: string
  Day: string
  Type: string
  Exercise: string
  Muscle: string
  Set: number
  Weight: number | ''
  Reps: number | ''
  Seconds: number | ''
  Effort: string
  Note: string
}

export function setHeaders(units: Units): string[] {
  return [
    'Date',
    'Time',
    'Day',
    'Type',
    'Exercise',
    'Muscle',
    'Set',
    `Weight (${units})`,
    'Reps',
    'Seconds',
    'Effort',
    'Note',
  ]
}

function localTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function setsToRows(workouts: Workout[]): SetRow[] {
  const rows: SetRow[] = []
  for (const w of finished(workouts)) {
    for (const entry of w.entries) {
      entry.sets.forEach((s, i) => {
        if (!s.done) return
        rows.push({
          Date: dayKey(w.finishedAt),
          Time: localTime(w.startedAt),
          Day: w.dayName,
          Type: w.dayType,
          Exercise: entry.name,
          Muscle: entry.muscle,
          Set: i + 1,
          Weight: s.weight ?? '',
          Reps: s.reps ?? '',
          Seconds: s.seconds ?? '',
          Effort: w.effort ? EFFORT_LABEL[w.effort as Effort] : '',
          Note: w.note ?? '',
        })
      })
    }
  }
  return rows
}

/** Sets that count in stats: done, with reps or seconds. Same rule as the Stats page. */
export function countedSets(workouts: Workout[]): number {
  return finished(workouts).reduce((n, w) => n + w.entries.reduce((m, e) => m + effectiveSets(e).length, 0), 0)
}

export type BodyweightRow = { Date: string; Weight: number }

export function bodyweightsToRows(logs: BodyweightLog[]): BodyweightRow[] {
  return [...logs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((l) => ({ Date: l.day ?? dayKey(l.date), Weight: l.weight }))
}

export type MeasurementRow = { Date: string; Arm: number | ''; Chest: number | ''; Waist: number | '' }

export function measurementsToRows(logs: MeasurementLog[]): MeasurementRow[] {
  return [...logs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((l) => ({ Date: l.day ?? dayKey(l.date), Arm: l.arm ?? '', Chest: l.chest ?? '', Waist: l.waist ?? '' }))
}

/** `plates-logs-2026-10-10.xlsx` */
export function exportFileName(kind: 'xlsx' | 'csv', now = new Date()): string {
  return `plates-logs-${dayKey(now)}.${kind}`
}
