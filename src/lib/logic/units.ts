import type { LoadType, Units } from '../types'

export function fmtWeight(n: number | undefined, units?: Units): string {
  if (n === undefined || Number.isNaN(n)) return ''
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
  return units ? `${s} ${units}` : s
}

/** A set written out by what it is measured in: "62.5 kg × 8", "12 reps", "45 s". */
export function fmtSet(
  loadType: LoadType,
  s: { weight?: number; reps?: number; seconds?: number },
  units: Units,
): string {
  if (loadType === 'weight') return `${fmtWeight(s.weight, units)} × ${s.reps ?? 0}`
  if (loadType === 'bodyweight') return `${s.reps ?? 0} reps`
  return `${s.seconds ?? 0} s`
}

export function roundToStep(n: number, step: number): number {
  return Math.round(n / step) * step
}

export function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
