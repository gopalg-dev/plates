import type { Units } from '../types'
import {
  beforeLabel,
  compared,
  comparedWeight,
  type Period,
  type PeriodDay,
  periodLabel,
  type Report,
  type Tone,
  toneOf,
} from './report'
import { dayKey } from './stats'
import { fmtSet, fmtWeight } from './units'

/*
 * What goes on the share card: the lifter's days, the sessions, and one highlight the lifter picks, a new best,
 * the streak, every session done, or nothing. Pure, so it can be tested; src/lib/share-card-draw.ts lays it out.
 */

/** A number on the card with, when the period before had sessions, how it moved. */
export interface CardFigure {
  value: string
  label: string
  change?: string
  tone: Tone
}

/** The highlight as drawn: a caption, the big line, and the line under it. */
export interface CardWin {
  /** "New best", "New bests", "Streak" or "Sessions". */
  caption: string
  /** "Hack Squat", "12", "3" or "All done". */
  big: string
  /** "90 kg × 12", "new bests this week", "weeks in a row" or "6 of 6". */
  small: string
}

/** One thing the card can tell, for the lifter to pick from. */
export interface Highlight {
  id: string
  /** As the picker lists it: "Hack Squat 90 kg × 12", "12 new bests", "3 weeks in a row", "All sessions done". */
  label: string
  /** Nothing to draw for "Nothing". */
  win: CardWin | null
}

/**
 * What this period offers, best first: the count of new bests when there are several, each best heaviest first,
 * the streak from two periods up, every planned session done, and nothing. The first is the pick to start from.
 */
export function highlights(report: Report, period: Period, units: Units): Highlight[] {
  const unit = period.kind === 'week' ? 'week' : 'month'
  const out: Highlight[] = []
  const n = report.bests.length
  if (n > 1) {
    out.push({
      id: 'bests',
      label: `${n} new bests`,
      win: { caption: 'New bests', big: String(n), small: `new bests this ${unit}` },
    })
  }
  for (const b of [...report.bests].sort((a, b) => b.weight - a.weight || b.score - a.score)) {
    const set = fmtSet(b.loadType, b, units)
    out.push({
      id: `best:${b.exerciseId}`,
      label: `${b.name} ${set}`,
      win: { caption: 'New best', big: b.name, small: set },
    })
  }
  if (report.streak >= 2) {
    const small = `${unit}s in a row`
    out.push({
      id: 'streak',
      label: `${report.streak} ${small}`,
      win: { caption: 'Streak', big: String(report.streak), small },
    })
  }
  if (report.sessions.done >= report.sessions.planned) {
    out.push({
      id: 'sessions',
      label: 'All sessions done',
      win: { caption: 'Sessions', big: 'All done', small: `${report.sessions.done} of ${report.sessions.planned}` },
    })
  }
  out.push({ id: 'none', label: 'Nothing', win: null })
  return out
}

export interface ShareCardContent {
  /** "Sam's week" or "Sam's month". */
  who: string
  /** "Sep 21 – 27" or "October 2026". */
  title: string
  days: PeriodDay[]
  sessions: CardFigure
  win: CardWin | null
  /** Only when asked for and there was a weigh-in. */
  bodyweight?: CardFigure
}

/**
 * The card's words and numbers for a report. `highlight` is a highlight's id, the first one when absent or unknown;
 * bodyweight only when `bodyweight` is true and there was a weigh-in.
 */
export function shareCardContent(
  report: Report,
  period: Period,
  days: PeriodDay[],
  units: Units,
  name: string,
  { bodyweight = false, highlight }: { bodyweight?: boolean; highlight?: string } = {},
): ShareCardContent {
  const before = beforeLabel(period.kind)
  // The period before had sessions: the change is a story. Otherwise it only repeats the number.
  const hadBefore = report.sessions.prev > 0
  const options = highlights(report, period, units)
  const card: ShareCardContent = {
    who: `${name}'s ${period.kind === 'week' ? 'week' : 'month'}`,
    title: periodLabel(period),
    days,
    sessions: {
      value: String(report.sessions.done),
      label: `of ${report.sessions.planned} sessions`,
      ...(hadBefore ? { change: compared(report.sessions.done, report.sessions.prev, before) } : {}),
      tone: hadBefore ? toneOf(report.sessions.done, report.sessions.prev) : 'same',
    },
    win: (options.find((h) => h.id === highlight) ?? options[0]).win,
  }
  if (bodyweight && report.bodyweight) {
    const { from, to } = report.bodyweight
    card.bodyweight = {
      value: fmtWeight(to, units),
      label: 'bodyweight',
      ...(from !== undefined ? { change: comparedWeight(to, from, units, before) } : {}),
      tone: from === undefined ? 'same' : toneOf(to, from),
    }
  }
  return card
}

/** "plates-week-2026-10-05.png" or "plates-month-2026-09.png". */
export function shareCardFileName(period: Period): string {
  const key = dayKey(period.start)
  return `plates-${period.kind}-${period.kind === 'week' ? key : key.slice(0, 7)}.png`
}
