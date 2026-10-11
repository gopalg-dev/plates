import type { Goal } from '../types'

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'gain', label: 'Gain' },
  { value: 'hold', label: 'Hold' },
  { value: 'cut', label: 'Cut' },
]

/** The toast after picking a goal in Settings. */
export const GOAL_DONE: Record<Goal, string> = {
  gain: 'Gaining: aim for a quarter to half a kilo a week',
  hold: 'Holding weight',
  cut: 'Cutting: aim for a quarter to half a kilo a week down',
}

/**
 * How the week's change in bodyweight reads against the goal. The lean-gain pace is 0.2 to 0.75
 * percent a week; a steady cut is 0.2 to 1 percent down.
 */
export function paceNote(changePct: number, goal: Goal | undefined = 'hold'): string {
  if (goal === 'gain') {
    if (changePct > 0.75) return 'Faster than the lean-gain pace. Trim a little.'
    if (changePct >= 0.2) return 'Right in the lean-gain pace.'
    return 'Below the gain pace. Eat more.'
  }
  if (goal === 'cut') {
    if (changePct < -1) return 'Faster than a steady cut. Eat a little more.'
    if (changePct <= -0.2) return 'A steady cut.'
    return 'Not dropping. Eat less.'
  }
  if (changePct > 0.3) return 'Drifting up.'
  if (changePct < -0.3) return 'Drifting down.'
  return 'Holding steady.'
}
