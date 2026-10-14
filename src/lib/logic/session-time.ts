import type { Workout } from '../types'

/*
 * How long a session has been going, pauses taken out. A pause is a moment (`pausedAt`) while it runs and a total
 * (`pausedMs`) once it ends; the time on screen is the clock since the start minus both. A finished session reads the
 * same way for its minutes in Stats.
 */

export type Timed = Pick<Workout, 'startedAt' | 'finishedAt' | 'pausedAt' | 'pausedMs'>

/** Milliseconds spent training: from the start to the finish, or to `now`, less every pause. Never below zero. */
export function activeMs(w: Timed, now: Date): number {
  const end = w.finishedAt ? new Date(w.finishedAt).getTime() : now.getTime()
  const paused = (w.pausedMs ?? 0) + (w.pausedAt ? Math.max(0, end - new Date(w.pausedAt).getTime()) : 0)
  return Math.max(0, end - new Date(w.startedAt).getTime() - paused)
}

/** Whole minutes spent training. */
export function activeMinutes(w: Timed, now: Date): number {
  return Math.round(activeMs(w, now) / 60_000)
}

/** "0 min", "42 min", "1 h 5 min". */
export function elapsedLabel(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export type Pause = Pick<Workout, 'pausedAt' | 'pausedMs'>

/** The pause fields after a pause or a resume at `now`. Pausing twice, or resuming twice, changes nothing. */
export function setPaused(w: Pause, paused: boolean, now: Date): Pause {
  if (paused) return w.pausedAt ? { ...w } : { pausedMs: w.pausedMs ?? 0, pausedAt: now.toISOString() }
  if (!w.pausedAt) return { ...w }
  const spent = Math.max(0, now.getTime() - new Date(w.pausedAt).getTime())
  return { pausedMs: (w.pausedMs ?? 0) + spent }
}
