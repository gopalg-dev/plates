export interface Nudge {
  kind: 'weight' | 'measure'
  title: string
  detail: string
}

export function daysBetween(iso: string, now: Date): number {
  const a = new Date(now)
  a.setHours(0, 0, 0, 0)
  const b = new Date(iso)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

/**
 * One quiet reminder at a time. Weigh-in weekly, tape every four weeks.
 * A first measurement right away gives the baseline the later ones compare against.
 */
export function nudgeFor(lastBodyweightAt: string | null, lastMeasurementAt: string | null, now: Date): Nudge | null {
  if (!lastBodyweightAt) {
    return { kind: 'weight', title: 'Weigh-in due.', detail: 'Once a week, same time of day.' }
  }
  const sinceWeight = daysBetween(lastBodyweightAt, now)
  if (sinceWeight >= 7) {
    return { kind: 'weight', title: 'Weigh-in due.', detail: `Last logged ${sinceWeight} days ago.` }
  }
  if (!lastMeasurementAt) {
    return { kind: 'measure', title: 'Tape day.', detail: 'Arm, chest and waist set the baseline. Then every 4 weeks.' }
  }
  const sinceMeasure = daysBetween(lastMeasurementAt, now)
  if (sinceMeasure >= 28) {
    return { kind: 'measure', title: 'Tape day.', detail: `Last measured ${sinceMeasure} days ago.` }
  }
  return null
}
