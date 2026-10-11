const LOCALE = 'en-US'

export function relativeDay(iso: string, now = new Date()): string {
  const a = new Date(now)
  a.setHours(0, 0, 0, 0)
  const b = new Date(iso)
  b.setHours(0, 0, 0, 0)
  const diff = Math.round((a.getTime() - b.getTime()) / 86_400_000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return shortDate(iso)
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "October 2026" */
export function monthYear(d: Date): string {
  return d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' })
}

export function signed(n: number, digits = 1): string {
  const s = n.toFixed(digits).replace(/\.0+$/, '')
  return n > 0 ? `+${s}` : s
}
