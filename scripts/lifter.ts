/*
 * The simulated lifter, shared by the two-year simulator and the day-by-day script: a capacity per lift that grows
 * fast, then slowly, and what it allows on a given set.
 */

/** Starting capacity of a 60 kg beginner: a one-rep max in kg per lift, by its name and muscle. */
export function startCapacity(name: string, muscle: string, loadType: string): number {
  const n = name.toLowerCase()
  if (loadType === 'time') return 30 // seconds
  if (loadType === 'bodyweight') {
    if (/pull-?up|chin-?up/.test(n)) return 4
    if (/dip/.test(n)) return 6
    if (/push-?up/.test(n)) return 15
    return 8
  }
  const base: Record<string, number> = {
    chest: 45,
    back: 50,
    shoulders: 30,
    biceps: 25,
    triceps: 30,
    quads: 70,
    hamstrings: 70,
    calves: 90,
    abs: 30,
  }
  let c = base[muscle] ?? 40
  if (/leg press/.test(n)) c *= 1.8
  else if (/deadlift/.test(n)) c *= 1.4
  else if (/hip thrust/.test(n)) c *= 1.5
  else if (/shrug/.test(n)) c *= 1.5
  // Small isolation lifts are set per hand already; the dumbbell factor applies only to presses and rows.
  else if (/lateral raise|rear delt|reverse fly/.test(n)) return c * 0.4
  else if (/face pull/.test(n)) c *= 0.6
  else if (/fly/.test(n)) c *= 0.5
  else if (/pushdown|extension|skull/.test(n)) c *= 0.8
  else if (/curl/.test(n) && muscle !== 'hamstrings') c *= 1.0
  if (/\bdb\b|dumbbell/.test(n)) c *= 0.4 // one hand
  return c
}

const LOWER = new Set(['quads', 'hamstrings', 'calves'])

/** Gains come fast, then slow: a saturating curve over the two years. */
export function grown(cap0: number, muscle: string, loadType: string, day: number): number {
  const A = loadType === 'weight' ? (LOWER.has(muscle) ? 1.2 : 0.9) : 2.0
  const tau = loadType === 'weight' ? 220 : 250
  return cap0 * (1 + A * (1 - Math.exp(-day / tau)))
}

/** Reps a lift's capacity allows at a weight, on the i-th set (fatigue takes 3% a set): Epley turned around. */
export function repsAllowed(cap: number, weight: number, set: number): number {
  return Math.max(0, Math.floor(30 * ((cap * (1 - 0.03 * set)) / weight - 1)))
}
