import type { Units } from '../types'

export function fmtWeight(n: number | undefined, units?: Units): string {
  if (n === undefined || Number.isNaN(n)) return ''
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
  return units ? `${s} ${units}` : s
}

export function roundToStep(n: number, step: number): number {
  return Math.round(n / step) * step
}

export function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
