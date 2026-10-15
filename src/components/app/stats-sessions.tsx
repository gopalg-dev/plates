import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileDown, Flame } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { monthYear, shortDate } from '#/lib/format'
import { deloadHint, effortLabel, effortThisWeek } from '#/lib/logic/effort'
import {
  dayKey,
  monthCalendar,
  noon,
  plannedVolumeByMuscle,
  sessionsInWeek,
  startOfWeek,
  volumeByMuscleInWeek,
  weeklyStreak,
  weekTotals,
} from '#/lib/logic/stats'
import type { Muscle, Plan, TrainingAge, Units, Workout } from '#/lib/types'
import { cn } from '#/lib/utils'
import { BodyMap, BodyMapLegend } from './body-map'
import { dayColourClass, dayInkClass } from './day-mark'
import { SectionHeading } from './section-heading'

/*
 * The Sessions tab of Stats, shared by the Stats page and the demo on How it works: the week's numbers, the
 * calendar to pick a week or open a day, and the body map of the week's hard sets. What talks to the server (opening
 * a day's session, dropping the ramp's extra sets, the export) is passed in, so the demo can leave it out.
 */

interface SessionsTabProps {
  workouts: Workout[]
  plan: Plan
  trainingAge: TrainingAge
  joinedAt: string | undefined
  units: Units
  now: Date
  /** A day tapped on the calendar: its session opens. */
  onOpenDay: (date: string) => void
  /** Under the deload card: the button that drops the ramp's extra sets, when there are some. */
  dropRamp?: ReactNode
  /** The export buttons; absent in a demo. */
  exportButtons?: ReactNode
}

/** The Sessions tab: a week, the numbers that describe it, and where its hard sets landed. */
export function SessionsTab({
  workouts,
  plan,
  trainingAge,
  joinedAt,
  units,
  now,
  onOpenDay,
  dropRamp,
  exportButtons,
}: SessionsTabProps) {
  /** Monday key of the week the numbers describe. Null means the current week. */
  const [week, setWeek] = useState<string | null>(null)
  const [pickedMuscle, setPickedMuscle] = useState<Muscle | null>(null)
  const { thisWeek, streak, target, deload } = useMemo(
    () => ({
      thisWeek: dayKey(startOfWeek(now)),
      streak: weeklyStreak(workouts, now),
      target: plannedVolumeByMuscle(plan, trainingAge),
      deload: deloadHint(workouts, now),
    }),
    [workouts, plan, trainingAge, now],
  )
  const weekKey = week ?? thisWeek
  const isThisWeek = weekKey === thisWeek

  const weekly = useMemo(() => {
    const at = isThisWeek ? now : new Date(noon(weekKey))
    return {
      sessions: sessionsInWeek(workouts, at),
      volume: volumeByMuscleInWeek(workouts, at),
      effort: effortThisWeek(workouts, at),
      totals: weekTotals(workouts, at),
    }
  }, [workouts, weekKey, isThisWeek, now])

  const { sessions, volume, effort, totals } = weekly
  const weekName = isThisWeek ? 'this week' : `week of ${shortDate(noon(weekKey))}`

  // Tracks of minmax(0, 1fr): a wide table in a section scrolls inside it instead of widening the page.
  return (
    <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-x-10">
      <section aria-labelledby="week-h" className="lg:col-span-2">
        <SectionHeading id="week-h" icon={CalendarDays}>
          {isThisWeek ? 'This week' : `Week of ${shortDate(noon(weekKey))}`}
        </SectionHeading>
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-10">
          <div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-condensed text-6xl font-semibold leading-none tabular-nums">{sessions}</span>
              <span className="text-muted-foreground">of {plan.days.length} sessions</span>
            </div>
            {/* One quiet line each: the streak with the effort, and the week's totals. */}
            {(streak > 0 || effort !== undefined) && (
              <p className="mt-2 text-muted-foreground">
                {[
                  streak > 0 ? `${streak} ${streak === 1 ? 'week' : 'weeks'} in a row` : null,
                  effort !== undefined ? `effort ${effortLabel(effort).toLowerCase()}` : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                .
              </p>
            )}
            <p className="mt-2 flex flex-wrap gap-x-3 tabular-nums">
              <span>{totals.sets} hard sets</span>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <span>
                {Math.round(totals.lifted).toLocaleString('en-US')} {units}
              </span>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <span>{totals.minutes} min</span>
            </p>
            {deload && (
              <div className="mt-3 rounded-lg border px-3 py-2">
                <p>Two hard weeks and no lift moved. Take a deload week: half the sets, same weights.</p>
                {dropRamp}
              </div>
            )}
          </div>
          <ActivityCalendar
            workouts={workouts}
            now={now}
            joinedAt={joinedAt}
            selected={weekKey}
            onSelect={(monday) => setWeek(monday === thisWeek ? null : monday)}
            onOpenDay={onOpenDay}
          />
        </div>
      </section>

      <section aria-labelledby="volume-h" className="lg:col-span-2">
        <SectionHeading id="volume-h" icon={Flame}>
          Hard sets {isThisWeek ? 'this week' : `, ${weekName}`}
        </SectionHeading>
        <BodyMap
          done={volume}
          target={target}
          picked={pickedMuscle}
          onPick={(m) => setPickedMuscle((cur) => (cur === m ? null : m))}
          className="mt-4"
        />
        <BodyMapLegend className="mt-3 justify-center" />
      </section>

      {exportButtons && workouts.length > 0 && (
        <section aria-labelledby="export-h" className="lg:col-span-2">
          <SectionHeading id="export-h" icon={FileDown}>
            Export
          </SectionHeading>
          <div className="mt-3">{exportButtons}</div>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- calendar

/** Column heads. Weeks start on Monday, like `startOfWeek`. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface CalendarProps {
  workouts: Workout[]
  now: Date
  /** When the user joined. Earlier days are shown dimmed and cannot be picked. */
  joinedAt?: string
  /** Monday key of the highlighted week. */
  selected: string
  onSelect: (monday: string) => void
  /** A tapped day with a session on it. */
  onOpenDay: (date: string) => void
}

/** One month of sessions as a calendar. Tap a day: its week drives the numbers, and its session opens. */
function ActivityCalendar({ workouts, now, joinedAt, selected, onSelect, onOpenDay }: CalendarProps) {
  const [offset, setOffset] = useState(0)
  const [jumpOpen, setJumpOpen] = useState(false)
  const month = useMemo(() => new Date(now.getFullYear(), now.getMonth() + offset, 1), [now, offset])
  const weeks = useMemo(() => monthCalendar(workouts, now, month, joinedAt), [workouts, now, month, joinedAt])
  // Session names per day, for the day buttons' labels.
  const names = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const w of workouts) {
      if (w.status !== 'done' || !w.finishedAt) continue
      const key = dayKey(w.finishedAt)
      m.set(key, [...(m.get(key) ?? []), w.dayName])
    }
    return m
  }, [workouts])
  const todayKey = dayKey(now)
  const thisWeek = dayKey(startOfWeek(now))
  const joined = joinedAt ? new Date(joinedAt) : null
  const atFirstMonth =
    joined !== null && month.getTime() <= new Date(joined.getFullYear(), joined.getMonth(), 1).getTime()
  const sessions = weeks.flatMap((w) => w.days).filter((d) => d?.type).length
  const title = monthYear(month)

  // Months are counted from year zero so a span across years compares as one number.
  const index = (d: Date) => d.getFullYear() * 12 + d.getMonth()
  const lowest = joined ? index(joined) : index(now) - 36
  const highest = index(now)

  /** Shows the month that holds `d`, kept within the join-to-now span. */
  function jumpTo(d: Date) {
    setOffset(Math.min(highest, Math.max(lowest, index(d))) - highest)
  }

  return (
    // The full width on phones, where square days make thumb-sized cells; a compact block from 640px up.
    <div className="mt-5 sm:max-w-xs">
      <div className="flex items-center gap-2">
        <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 gap-1 px-2 text-sm font-medium"
              aria-label={`${title}. Pick a month`}
            >
              {title}
              <ChevronDown aria-hidden className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            {/* The month and year dropdowns move this calendar as they change; a tapped day picks its week. */}
            <Calendar
              mode="single"
              captionLayout="dropdown"
              weekStartsOn={1}
              month={month}
              onMonthChange={jumpTo}
              startMonth={new Date(Math.floor(lowest / 12), lowest % 12, 1)}
              endMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
              disabled={[{ after: now }, ...(joined ? [{ before: joined }] : [])]}
              onSelect={(day) => {
                if (!day) return
                jumpTo(day)
                onSelect(dayKey(startOfWeek(day)))
                setJumpOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          {sessions} {sessions === 1 ? 'session' : 'sessions'}
        </p>
        <div className="ml-auto flex shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Previous month"
            onClick={() => setOffset(offset - 1)}
            disabled={atFirstMonth}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Next month"
            onClick={() => setOffset(offset + 1)}
            disabled={offset >= 0}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
      <div
        className="mt-1 grid grid-cols-7 gap-1 px-1 text-center text-sm text-muted-foreground sm:text-xs"
        aria-hidden
      >
        {WEEKDAYS.map((d, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the weekday letters repeat (T, S); the column is the identity
          <span key={i}>{d}</span>
        ))}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a labelled group of calendar buttons, not a form, so no fieldset */}
      <div className="mt-1 flex flex-col gap-1" role="group" aria-label={`Weeks of ${title}`}>
        {weeks.map((week) => {
          const isSelected = week.start === selected
          return (
            <div
              key={week.start}
              className={cn(
                'grid grid-cols-7 gap-1 rounded-md p-1 text-sm tabular-nums sm:text-xs',
                isSelected && 'bg-foreground/10',
              )}
            >
              {week.days.map((d, j) => {
                // biome-ignore lint/suspicious/noArrayIndexKey: an empty cell before the first of the month is only a position
                if (d === null) return <span key={`pad-${j}`} />
                const on = names.get(d.date) ?? []
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={d.future || d.before}
                    aria-label={`${shortDate(d.iso)}, ${on.length > 0 ? on.join(' and ') : 'no session'}`}
                    onClick={() => {
                      onSelect(week.start)
                      if (on.length > 0) onOpenDay(d.date)
                    }}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                      d.type
                        ? cn(dayColourClass(d.type), dayInkClass(d.type), 'font-medium hover:opacity-90')
                        : d.future || d.before
                          ? 'text-muted-foreground/40'
                          : 'bg-muted text-muted-foreground hover:bg-foreground/10',
                      d.date === todayKey && 'ring-2 ring-foreground/40 ring-offset-1 ring-offset-background',
                    )}
                  >
                    {d.dayOfMonth}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      {selected !== thisWeek && (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto px-0 text-muted-foreground"
          onClick={() => {
            setOffset(0)
            onSelect(thisWeek)
          }}
        >
          Back to this week
        </Button>
      )}
    </div>
  )
}
