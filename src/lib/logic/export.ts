import type { BodyweightLog, MeasurementLog, Units, Workout } from '../types'
import { EFFORT_LABEL, type Effort } from './effort'
import { dayKey, effectiveSets, type FinishedWorkout, finished } from './stats'

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

/** The sets sheet's columns, in order, each with what it holds: the headers, and the zip's README, read them. */
export function setColumns(units: Units): { name: string; about: string }[] {
  return [
    { name: 'Date', about: 'the day the session was finished, YYYY-MM-DD' },
    { name: 'Time', about: 'when the session was started, 24-hour, your time' },
    { name: 'Day', about: 'the plan day it was, like Pull A' },
    { name: 'Type', about: "the day's kind, like push, pull or legs" },
    { name: 'Exercise', about: 'the lift' },
    { name: 'Muscle', about: 'the muscle the lift counts under' },
    { name: 'Set', about: 'which set of the lift, from 1' },
    { name: `Weight (${units})`, about: 'the weight lifted; blank for bodyweight lifts and timed holds' },
    { name: 'Reps', about: 'the reps done; blank for timed holds' },
    { name: 'Seconds', about: 'how long a timed hold lasted' },
    { name: 'Effort', about: 'how the whole session felt, picked at Finish' },
    { name: 'Note', about: 'the note written at Finish' },
  ]
}

export function setHeaders(units: Units): string[] {
  return setColumns(units).map((c) => c.name)
}

/**
 * The README.md inside the zip of everything (see `DownloadAllButton`): what each file is and what its columns
 * hold, in the account's units. Column names come from the same lists the files are written with.
 */
export function dataReadme(input: {
  units: Units
  today: string
  sessions: number
  sets: number
  weighIns: number
  tapeDays: number
  feedback: number
  planGuide: string[]
}): string {
  const length = input.units === 'kg' ? 'cm' : 'in'
  const columns = setColumns(input.units)
    .map((c) => `- **${c.name}**: ${c.about}.`)
    .join('\n')
  const guide = input.planGuide.map((line) => `- ${line}`).join('\n')
  return `# Your Plates data

Everything your account held on ${input.today}: ${input.sessions} finished sessions (${input.sets} sets),
${input.weighIns} weigh-ins, ${input.tapeDays} tape days and ${input.feedback} pieces of feedback. Weights are in
${input.units}, tape in ${length}. The files were built in your browser; nothing was sent anywhere to make them.

| File | What it holds |
| --- | --- |
| sessions.csv | One row per set ticked in a finished session, oldest first. |
| weigh-ins.csv | One row per bodyweight log: Date, Weight (${input.units}). |
| tape.csv | One row per tape day: Date, Arm, Chest and Waist (${length}). Blank where a site was skipped. |
| plan.xlsx | Your plan, as the Excel file Plates reads back. Excel, not CSV: a CSV would let Excel turn rep ranges like 6-10 into dates. |
| settings.json | Units, split, goal, schedule and the rest of Settings. |
| feedback.json | The feedback you sent from the app, with when and where. |
| everything.json | All of the above in one file with your username and email, as the app holds it: for a program, or another app. |

The CSV files and plan.xlsx open in Excel, Numbers or Google Sheets. Session details (day, effort, note) repeat on every row of
sessions.csv, so a filter or a pivot table works on its own.

## sessions.csv

${columns}

Sets left unticked are not in the file: they were never logged.

## plan.xlsx

To use it again: in Plates, Plan > Bring your own plan, then pick this file. Its Guide sheet says the same as below.

${guide}
`
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

/** How the logs are laid out in a spreadsheet: one row per set, or a logbook with a sheet per day. */
export type ExportLayout = 'log' | 'tracker'

/** A sheet of the tracker layout: a plan day, its headers, and a row per lift per session. */
export type TrackerSheet = { name: string; headers: string[]; rows: (string | number)[][] }

/** Excel allows 31 characters in a sheet name and none of `[ ] : * ? / \`. */
function sheetName(name: string): string {
  return (
    name
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 31) || 'Day'
  )
}

/**
 * The tracker layout, like a paper logbook: a sheet per plan day, one row per lift per session, oldest first, the
 * sets across. The weight is one number when every set used the same, else the weights in order; a timed hold
 * shows its seconds; lifts with no set done are left out.
 */
export function trackerSheets(workouts: Workout[], units: Units): TrackerSheet[] {
  const byDay = new Map<string, FinishedWorkout[]>()
  for (const w of finished(workouts)) byDay.set(w.dayName, [...(byDay.get(w.dayName) ?? []), w])
  const used = new Set<string>()
  return [...byDay].map(([day, sessions]) => {
    const most = Math.max(1, ...sessions.flatMap((w) => w.entries.map((e) => e.sets.filter((s) => s.done).length)))
    const setHeads = Array.from({ length: most }, (_, i) => `Set ${i + 1}`)
    const headers = ['Date', 'Exercise', 'Sets', `Weight (${units})`, ...setHeads, 'Total reps', 'Effort', 'Note']
    const rows = sessions.flatMap((w) =>
      w.entries
        .map((entry) => ({ entry, done: entry.sets.filter((s) => s.done) }))
        .filter(({ done }) => done.length > 0)
        .map(({ entry, done }) => {
          const weights = [...new Set(done.map((s) => s.weight).filter((x): x is number => x != null))]
          const cells = Array.from({ length: most }, (_, i) => {
            const s = done[i]
            if (!s) return ''
            return s.seconds != null ? `${s.seconds} s` : (s.reps ?? '')
          })
          const total = done.reduce((n, s) => n + (s.reps ?? 0), 0)
          const effort = w.effort ? EFFORT_LABEL[w.effort as Effort] : ''
          const weight = weights.length === 1 ? weights[0] : weights.join(' / ')
          return [dayKey(w.finishedAt), entry.name, done.length, weight, ...cells, total, effort, w.note ?? '']
        }),
    )
    let name = sheetName(day)
    for (let n = 2; used.has(name); n++) name = `${sheetName(day).slice(0, 28)} ${n}`
    used.add(name)
    return { name, headers, rows }
  })
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

/** `plates-logs-2026-10-10.xlsx`, or `plates-tracker-2026-10-10.xlsx` for the tracker layout. */
export function exportFileName(kind: 'xlsx' | 'csv', now = new Date(), layout: ExportLayout = 'log'): string {
  return `plates-${layout === 'tracker' ? 'tracker' : 'logs'}-${dayKey(now)}.${kind}`
}
