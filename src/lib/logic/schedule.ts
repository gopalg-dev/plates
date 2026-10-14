import type { PlanDay } from '../types'

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A day's weekday by name, or an empty string for a day not tied to one (the rolling schedule). */
export function weekdayOf(day: Pick<PlanDay, 'weekday'>): string {
  return day.weekday === undefined ? '' : WEEKDAY_LONG[day.weekday]
}

/** Monday first, for pickers and for ordering a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const SPREADS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
}

/** Spreads `count` sessions over the week, Monday first, with rest days where there is room. */
export function defaultWeekdays(count: number): number[] {
  if (count <= 0) return []
  return SPREADS[count] ?? Array.from({ length: count }, (_, i) => WEEK_ORDER[i % 7])
}

/** Gives every day without a weekday one, keeping the ones already set. Same array back when nothing changes. */
export function assignWeekdays(days: PlanDay[]): PlanDay[] {
  if (days.every((d) => d.weekday !== undefined)) return days
  const defaults = defaultWeekdays(days.length)
  return days.map((d, i) => (d.weekday === undefined ? { ...d, weekday: defaults[i] } : d))
}

export interface Finished {
  dayId: string
  finishedAt: string
}

/** When a plan day was last finished, from recent sessions: the latest finish time, or null when never. */
export function lastDoneAt(dayId: string, finished: Finished[]): string | null {
  let last: string | null = null
  for (const f of finished) {
    if (f.dayId === dayId && (last === null || new Date(f.finishedAt) > new Date(last))) last = f.finishedAt
  }
  return last
}

export interface WeekdayView {
  /** The day planned for today, if any. */
  today: PlanDay | null
  /** Today's day already has a finished session today. */
  doneToday: boolean
  /** The next planned day after today, and in how many days it comes. */
  next: { day: PlanDay; inDays: number } | null
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** What Today shows under the weekday schedule. `finished` holds recent sessions, at least this week's. */
export function weekdayView(days: PlanDay[], now: Date, finished: Finished[]): WeekdayView {
  const todayDone = new Set(finished.filter((f) => sameDay(new Date(f.finishedAt), now)).map((f) => f.dayId))
  const wd = now.getDay()

  // Two days can share a weekday (a day moved onto another's). The one still to do comes first.
  const onToday = days.filter((d) => d.weekday === wd)
  const today = onToday.find((d) => !todayDone.has(d.id)) ?? onToday[0] ?? null
  const doneToday = today !== null && todayDone.has(today.id)

  let next: WeekdayView['next'] = null
  for (let offset = 1; offset <= 7 && next === null; offset++) {
    const day = days.find((d) => d.weekday === (wd + offset) % 7)
    if (day) next = { day, inDays: offset }
  }

  return { today, doneToday, next }
}
