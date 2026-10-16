import { ChevronDown, ChevronLeft, ChevronRight, TrendingUp, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { shortDate } from '#/lib/format'
import { EFFORT_LABEL, EFFORTS, type Effort } from '#/lib/logic/effort'
import {
  hasNext,
  lastFinished,
  type Period,
  type PeriodDay,
  type PeriodKind,
  periodLabel,
  type Report,
  shiftPeriod,
  type Tone,
} from '#/lib/logic/report'
import { addDays, MUSCLE_LABEL } from '#/lib/logic/stats'
import { fmtSet } from '#/lib/logic/units'
import type { DayType, Units } from '#/lib/types'
import { cn } from '#/lib/utils'
import { DAY_LABEL, dayColourClass, dayInkClass, daySplitStyle } from './day-mark'

/*
 * The pieces the report's looks share: the period row, the period as a calendar, the comparison words, the lists
 * of what went well and what needs attention, and the effort bar.
 */

/** New bests listed by name before the rest wait behind a button. */
const BESTS_SHOWN = 5

/** Up is good for every number the report compares, so it takes the success colour; the words carry it too. */
export const TONE: Record<Tone, string> = {
  up: 'text-success',
  down: 'text-muted-foreground',
  same: 'text-muted-foreground',
}

/** Whole sets: a month's average a week is rounded. */
export const sets = (n: number) => Math.round(n)

// ---------------------------------------------------------------- period row

export function PeriodBar({
  period,
  now,
  earliest,
  hasReports,
  onChange,
}: {
  period: Period
  now: Date
  /** The first day a period may start on or before: a year ago, or the join date when later. */
  earliest: Date
  /** Whether a report exists at all; before the first one there is nothing to pick. */
  hasReports: boolean
  /** A step through periods gives the new anchor; a switch of Week and Month gives none, to open on the latest. */
  onChange: (kind: PeriodKind, anchor?: Date) => void
}) {
  const { kind } = period
  const unit = kind === 'week' ? 'week' : 'month'
  const [pickerOpen, setPickerOpen] = useState(false)
  /** The month the picker shows; in Month mode, moving it is the pick. */
  const [shown, setShown] = useState(period.start)
  // The last day a report can be picked from: the day before the period now running.
  const latest = addDays(shiftPeriod(kind, lastFinished(kind, now), 1), -1)
  // The month the earliest day falls in: a period may start before that day, so the whole month is open.
  const firstMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={kind}
        onValueChange={(v) => v && v !== kind && onChange(v as PeriodKind)}
        aria-label="Period"
      >
        <ToggleGroupItem value="week" className="px-3">
          Week
        </ToggleGroupItem>
        <ToggleGroupItem value="month" className="px-3">
          Month
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex min-w-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Previous ${unit}`}
          disabled={period.start.getTime() <= earliest.getTime()}
          onClick={() => onChange(kind, shiftPeriod(kind, period.start, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        {hasReports ? (
          <Popover
            open={pickerOpen}
            onOpenChange={(open) => {
              setPickerOpen(open)
              if (open) setShown(period.start)
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 font-medium"
                aria-label={`${periodLabel(period)}. Pick a ${unit}`}
              >
                {periodLabel(period)}
                <ChevronDown aria-hidden className="text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              {/*
               * In Week mode a row is the target: the picked week is a band, a hovered row lights up whole and its
               * days show no hover of their own, and any day in a row picks its week. In Month mode only the caption
               * shows, the arrows and the month and year dropdowns, and the month picks as it moves.
               */}
              <Calendar
                mode="single"
                captionLayout="dropdown"
                weekStartsOn={1}
                className={cn(kind === 'week' && '[&_tbody_tr:hover_td]:bg-accent/60')}
                classNames={
                  kind === 'month'
                    ? { month_grid: 'hidden' }
                    : { day_button: 'hover:bg-transparent dark:hover:bg-transparent' }
                }
                month={shown}
                onMonthChange={(m) => {
                  setShown(m)
                  if (kind === 'month' && m >= firstMonth && m <= latest) onChange(kind, m)
                }}
                startMonth={firstMonth}
                endMonth={new Date(latest.getFullYear(), latest.getMonth(), 1)}
                disabled={[{ after: latest }, { before: earliest }]}
                modifiers={kind === 'week' ? { picked: { from: period.start, to: addDays(period.end, -1) } } : {}}
                modifiersClassNames={{ picked: 'bg-accent first:rounded-l-md last:rounded-r-md' }}
                onSelect={(day) => {
                  if (!day) return
                  onChange(kind, day)
                  setPickerOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <p className="min-w-0 truncate px-1 font-medium">{periodLabel(period)}</p>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Next ${unit}`}
          disabled={!hasNext(period, now)}
          onClick={() => onChange(kind, shiftPeriod(kind, period.start, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- calendar

/** Column heads. Weeks start on Monday, like `startOfWeek`. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** The key to the calendar's colours: the day types trained, and grey for a day without a session. */
function DayKey({ types, rest }: { types: DayType[]; rest: boolean }) {
  return (
    <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
      {types.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm', dayColourClass(t))} />
          {DAY_LABEL[t]}
        </li>
      ))}
      {rest && (
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted" />
          No session
        </li>
      )}
    </ul>
  )
}

/**
 * The period on a calendar: a week as one strip of seven days, a month as a grid, each day in its session's colour.
 * The same colours as the Stats calendar, so the two read alike.
 */
export function PeriodCalendar({ days, kind, className }: { days: PeriodDay[]; kind: PeriodKind; className?: string }) {
  const types = [...new Set(days.flatMap((d) => d.dayTypes))]
  const rest = days.some((d) => !d.dayType)
  const sessions = days.reduce((n, d) => n + d.dayTypes.length, 0)
  const lead = kind === 'month' ? (days[0].date.getDay() + 6) % 7 : 0
  const label = (d: PeriodDay) =>
    `${d.date.toLocaleDateString('en-US', { weekday: 'short' })} ${shortDate(d.date.toISOString())}, ${d.dayName ?? 'no session'}`
  return (
    <div className={className}>
      <div
        className={cn('grid grid-cols-7 text-center', kind === 'week' ? 'gap-1.5' : 'gap-1')}
        role="img"
        aria-label={`${sessions} sessions: ${days
          .filter((d) => d.dayType)
          .map((d) => label(d))
          .join('; ')}`}
      >
        {WEEKDAYS.map((w, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the weekday letters repeat (T, S); the column is the identity
          <span key={i} className="text-muted-foreground">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: an empty cell before the first of the month is only a position
          <span key={`pad-${i}`} />
        ))}
        {days.map((d) => (
          <span
            key={d.key}
            style={daySplitStyle(d.dayTypes)}
            className={cn(
              'flex items-center justify-center rounded-md tabular-nums',
              // A week's days are squares; a month's rows are wider than tall, so six rows stay short.
              kind === 'week' ? 'aspect-square font-medium' : 'aspect-[4/3]',
              d.dayType ? cn(dayColourClass(d.dayType), dayInkClass(d.dayType)) : 'bg-muted text-muted-foreground',
            )}
          >
            {d.date.getDate()}
          </span>
        ))}
      </div>
      <DayKey types={types} rest={rest} />
    </div>
  )
}

// ---------------------------------------------------------------- lists

/** What needs attention, as plain lines; empty when nothing does. */
export function attentionLines(report: Report, kind: PeriodKind): string[] {
  const { attention } = report
  const perWeek = kind === 'month' ? ' a week' : ''
  return [
    ...attention.under.map((m) => `${MUSCLE_LABEL[m.muscle]}: ${sets(m.perWeek)} of ${m.target} hard sets${perWeek}`),
    ...(attention.stuck.length > 0 ? [`Stuck: ${attention.stuck.join(', ')}`] : []),
    ...(attention.slipping.length > 0 ? [`Slipping: ${attention.slipping.join(', ')}`] : []),
    ...(attention.tooMuch > 0
      ? [`${attention.tooMuch} ${attention.tooMuch === 1 ? 'session' : 'sessions'} rated Too much`]
      : []),
    ...(attention.deload ? ['Two hard weeks and no lift moved. Take a deload week: half the sets, same weights.'] : []),
  ]
}

/** The bests of the period, then the lifts that beat the period before. */
export function BestsList({
  report,
  kind,
  units,
  before,
  className,
}: {
  report: Report
  kind: PeriodKind
  units: Units
  before: string
  className?: string
}) {
  const [all, setAll] = useState(false)
  const unit = kind === 'week' ? 'week' : 'month'
  const bests = all ? report.bests : report.bests.slice(0, BESTS_SHOWN)
  const hidden = report.bests.length - bests.length
  const when = (iso: string) =>
    kind === 'week' ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short' }) : shortDate(iso)
  if (report.bests.length === 0 && report.movers.length === 0) {
    return <p className={cn('text-muted-foreground', className)}>No new bests this {unit}.</p>
  }
  return (
    <ul className={cn('divide-y', className)}>
      {bests.map((pr) => (
        <li key={`${pr.exerciseId}-${pr.date}`} className="flex items-baseline gap-3 py-2.5">
          <Trophy className="size-4 shrink-0 translate-y-0.5 text-day-legs" aria-label="New best" />
          <span className="min-w-0 flex-1">{pr.name}</span>
          <span className="tabular-nums">{fmtSet(pr.loadType, pr, units)}</span>
          <span className="w-16 shrink-0 text-right text-muted-foreground">{when(pr.date)}</span>
        </li>
      ))}
      {hidden > 0 && (
        <li className="py-1.5">
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setAll(true)}>
            Show {hidden} more new {hidden === 1 ? 'best' : 'bests'}
          </Button>
        </li>
      )}
      {/* The set text is long, so on a narrow card it drops under the name rather than over it. */}
      {report.movers.map((m) => (
        <li key={m.to.exerciseId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
          <TrendingUp
            className="size-4 shrink-0 translate-y-0.5 text-muted-foreground"
            aria-label={`Up on ${before}`}
          />
          <span className="min-w-0 flex-1 basis-32">{m.to.name}</span>
          <span className="whitespace-nowrap tabular-nums">
            <span className="text-muted-foreground">{fmtSet(m.from.loadType, m.from, units)} → </span>
            {fmtSet(m.to.loadType, m.to, units)}
          </span>
          <span className="ml-auto w-16 shrink-0 text-right tabular-nums text-muted-foreground">
            +{Math.round(m.changePct * 10) / 10}%
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- effort

/** The effort mix, light to heavy; Too much takes the warning colour, the rest deepen with the effort. */
const EFFORT_FILL: Record<Effort, string> = {
  1: 'bg-foreground/20',
  2: 'bg-foreground/40',
  3: 'bg-foreground/70',
  4: 'bg-destructive',
}

/** One bar, light to heavy, with the counts in words beside each colour, and the reps left on last sets. */
export function EffortBar({ report, kind, before }: { report: Report; kind: PeriodKind; before: string }) {
  const unit = kind === 'week' ? 'week' : 'month'
  const rated = report.effort.counts.reduce((a, b) => a + b, 0)
  return (
    <div>
      {rated === 0 ? (
        <p className="text-muted-foreground">No sessions rated this {unit}.</p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
            {EFFORTS.map((e, i) =>
              report.effort.counts[i] > 0 ? (
                <span
                  key={e}
                  className={EFFORT_FILL[e]}
                  style={{ width: `${(report.effort.counts[i] / rated) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
            {EFFORTS.map((e, i) => (
              <li key={e} className="flex items-center gap-1.5">
                <span className={cn('size-2.5 rounded-full', EFFORT_FILL[e])} aria-hidden />
                {EFFORT_LABEL[e]} {report.effort.counts[i]}
              </li>
            ))}
          </ul>
        </>
      )}
      {report.effort.left !== undefined && (
        <p className="mt-3 tabular-nums">
          {report.effort.left} reps left on last sets
          {report.effort.prevLeft !== undefined && (
            <span className="text-muted-foreground">
              {' '}
              ({before}: {report.effort.prevLeft})
            </span>
          )}
        </p>
      )}
    </div>
  )
}
