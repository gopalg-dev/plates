import { Link } from '@tanstack/react-router'
import { Flame } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '#/components/ui/item'
import { relativeDay } from '#/lib/format'
import type { Alert } from '#/lib/logic/alerts'
import type { Finished } from '#/lib/logic/schedule'
import { lastDoneAt, WEEKDAY_SHORT } from '#/lib/logic/schedule'
import { plannedSetsFor } from '#/lib/logic/stats'
import { rowTap } from '#/lib/row-tap'
import type { DayType, PlanDay, TrainingAge } from '#/lib/types'
import { cn } from '#/lib/utils'
import { AlertDeck } from './alert-deck'
import { DayIcon } from './day-mark'
import { targetOf } from './exercise-row'
import { ExerciseThumb } from './exercise-thumb'

/*
 * The Today "Next up" screen, shared by the Today route and the demo on How it works: the day the plan says is
 * next, its lifts, the week streak, the alerts, and the Start / Pick a day controls. The route wires it to the
 * server; the demo starts a made-up session. Change it here and both follow.
 */

/** The week streak, top right of Today: a flame and a big number of weeks. Muted until the first streak week. */
export function Streak({ weeks }: { weeks: number }) {
  const on = weeks > 0
  const unit = weeks === 1 ? 'week' : 'weeks'
  return (
    <div
      className={cn('flex shrink-0 items-center gap-2', on ? 'text-foreground' : 'text-muted-foreground')}
      role="img"
      aria-label={`${weeks} ${unit} streak`}
    >
      <Flame aria-hidden className={cn('size-8 sm:size-9', on ? 'fill-day-legs text-day-legs' : '')} />
      <span className="flex flex-col items-center">
        <span className="font-condensed text-4xl font-semibold leading-none tabular-nums sm:text-5xl">{weeks}</span>
        <span className="mt-1 text-sm leading-none text-muted-foreground">{unit}</span>
      </span>
    </div>
  )
}

export function NextUpView({
  day,
  days,
  trainingAge,
  now,
  streakWeeks,
  title,
  markType,
  summary,
  byWeekday,
  recent,
  alerts,
  onDismissAlert,
  onAlertAction,
  onStart,
  starting,
  nudge,
}: {
  /** The day the plan says is next, or null on a rest day / once today's is done. */
  day: PlanDay | null
  /** Every day, for the Pick-a-day drawer. */
  days: PlanDay[]
  trainingAge: TrainingAge
  now: Date
  streakWeeks: number
  /** The big heading: the day's name, "Done for today", or "Rest day". */
  title: string
  markType?: DayType
  /** The line under the heading: the day's size, or what is planned when there is no day. */
  summary: string
  byWeekday: boolean
  recent: Finished[]
  alerts: Alert[]
  onDismissAlert: (key: string) => void
  /** Given, the alert action runs this instead of navigating (the demo opens its own report). */
  onAlertAction?: (alert: Alert) => void
  onStart: (dayId: string) => void
  /** The day id being started, or null; disables the buttons while a start is in flight. */
  starting: string | null
  /** The weigh-in / tape reminder, rendered by the caller (the route only). */
  nudge?: ReactNode
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const start = (dayId: string) => {
    setPickerOpen(false)
    onStart(dayId)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <h1 className="mt-1 flex items-center gap-3 font-condensed text-4xl font-semibold leading-none sm:text-5xl">
            {markType && <DayIcon type={markType} className="size-11 rounded-xl" />}
            {title}
          </h1>
        </div>
        <Streak weeks={streakWeeks} />
      </div>
      <p className="mt-3 text-muted-foreground">{day && day.exercises.length === 0 ? 'No lifts yet.' : summary}</p>

      <AlertDeck alerts={alerts} onDismiss={onDismissAlert} onAction={onAlertAction} />

      {nudge}

      {day && day.exercises.length > 0 && (
        <ItemGroup className="mt-8 border-y">
          {day.exercises.map((ex, i) => (
            <div key={ex.id}>
              {i > 0 && <ItemSeparator />}
              <Item size="sm" className="px-1">
                <ItemMedia variant="image">
                  <ExerciseThumb name={ex.name} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-base font-normal">{ex.name}</ItemTitle>
                </ItemContent>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {plannedSetsFor(ex.sets, trainingAge)} × {targetOf(ex)}
                </span>
              </Item>
            </div>
          ))}
        </ItemGroup>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* A day with no lifts cannot start: it waits on Plan to be filled. */}
        {day &&
          (day.exercises.length === 0 ? (
            <Button asChild variant="outline" size="lg" className="h-12 text-base">
              <Link to="/plan">Add lifts on Plan</Link>
            </Button>
          ) : (
            <Button size="lg" className="h-12 text-base" onClick={() => start(day.id)} disabled={starting !== null}>
              Start {day.name}
            </Button>
          ))}
        <Drawer open={pickerOpen} onOpenChange={setPickerOpen}>
          <DrawerTrigger asChild>
            {day ? (
              <Button variant="ghost" size="lg">
                Not this one? Pick another day
              </Button>
            ) : (
              <Button size="lg" className="h-12 text-base">
                Pick a day
              </Button>
            )}
          </DrawerTrigger>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader>
              <DrawerTitle>Pick a day</DrawerTitle>
              <DrawerDescription className="sr-only">Start a different day.</DrawerDescription>
            </DrawerHeader>
            <ItemGroup className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {days.map((d) => {
                const doneAt = lastDoneAt(d.id, recent)
                // The day's weekday (or its size), and when it was last done, so a day just trained stands out.
                const detail = [
                  byWeekday && d.weekday !== undefined ? WEEKDAY_SHORT[d.weekday] : `${d.exercises.length} exercises`,
                  doneAt ? `Done ${relativeDay(doneAt, now)}` : null,
                ]
                return (
                  <Item
                    key={d.id}
                    size="sm"
                    className="cursor-pointer px-2"
                    onClick={rowTap(() => start(d.id)).onClick}
                  >
                    <ItemMedia>
                      <DayIcon type={d.type} className="size-8 rounded-md" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-base">{d.name}</ItemTitle>
                      <ItemDescription>{detail.filter(Boolean).join(' · ')}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        size="sm"
                        aria-label={`Start ${d.name}`}
                        onClick={() => start(d.id)}
                        disabled={starting !== null || d.exercises.length === 0}
                      >
                        Start
                      </Button>
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  )
}
