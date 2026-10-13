import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarX,
  Flame,
  MoreHorizontal,
  Ruler,
  Scale,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogBodyweightDialog, LogMeasurementsDialog } from '#/components/app/body-dialogs'
import { DayIcon } from '#/components/app/day-mark'
import { targetOf } from '#/components/app/exercise-row'
import { ExerciseThumb } from '#/components/app/exercise-thumb'
import { SectionHeading } from '#/components/app/section-heading'
import { DiscardDialog, FinishCheckIn, SummaryDialog } from '#/components/app/session-finish'
import { SessionExercises, SessionFooter, SessionTitle, ZenButton } from '#/components/app/session-view'
import { useSessionSets } from '#/components/app/use-session-sets'
import { ZenMode } from '#/components/app/zen-mode'
import { Button } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
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
import { errorMessage, relativeDay } from '#/lib/format'
import { nudgeFor } from '#/lib/logic/nudges'
import { stepsOf } from '#/lib/logic/progression'
import { lastDoneAt, WEEKDAY_SHORT, weekdayOf, weekdayView } from '#/lib/logic/schedule'
import { plannedSetsFor, weeklyStreakOf } from '#/lib/logic/stats'
import type { SessionSummary } from '#/lib/logic/summary'
import { pageTitle } from '#/lib/page-title'
import { rowTap } from '#/lib/row-tap'
import type { LoggedSet, NudgeKind, Plan, PlanDay, Settings, Workout } from '#/lib/types'
import { useWakeLock } from '#/lib/use-wake-lock'
import { cn } from '#/lib/utils'
import {
  acceptRampFn,
  discardWorkoutFn,
  dismissNudgeFn,
  finishWorkoutFn,
  getTodayFn,
  saveSetsFn,
  startWorkoutFn,
} from '#/server/fns'
import type { TodayData } from '#/server/repo'

export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: pageTitle('Today') }] }),
  // /?zen=1 keeps zen mode across a refresh while a workout is active.
  validateSearch: (search: Record<string, unknown>): { zen?: true } => (search.zen ? { zen: true } : {}),
  loader: () => getTodayFn(),
  component: TodayPage,
})

/** Drawer headers centre their text on bottom drawers by default. The app reads left to right. */

function TodayPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const refresh = () => router.invalidate()
  // The finish summary outlives the workout it came from: it shows over Next up once the page refreshes.
  const [summary, setSummary] = useState<{ summary: SessionSummary; askFeedback: boolean } | null>(null)
  return (
    <>
      {data.active ? (
        <ActiveWorkout
          key={data.active.id}
          workout={data.active}
          settings={data.settings}
          plan={data.plan}
          onChanged={refresh}
          onSummary={(s, askFeedback) => setSummary({ summary: s, askFeedback })}
        />
      ) : (
        <NextUp data={data} onChanged={refresh} />
      )}
      <SummaryDialog
        summary={summary?.summary ?? null}
        askFeedback={summary?.askFeedback ?? false}
        onClose={() => setSummary(null)}
      />
    </>
  )
}

// ---------------------------------------------------------------- next up

/** The week streak, top right of Today: a flame and a big number of weeks. Muted until the first streak week. */
function Streak({ weeks }: { weeks: number }) {
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

function NextUp({ data, onChanged }: { data: TodayData; onChanged: () => void }) {
  const { plan, settings, nextDayId } = data
  const [starting, setStarting] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const now = new Date()
  const nudge = nudgeFor(data.lastBodyweightAt, data.lastMeasurementAt, now, settings.nudges)
  // "Not now" hides the reminder at once; the server remembers it, and the next reload shows the next one, if any.
  const [waved, setWaved] = useState<NudgeKind | null>(null)
  const wave = async (kind: NudgeKind) => {
    setWaved(kind)
    try {
      await dismissNudgeFn({ data: { kind } })
      onChanged()
    } catch (err) {
      setWaved(null)
      toast.error(errorMessage(err, 'Could not save that.'))
    }
  }

  // Rolling: the next day in order. By weekday: the day on today's weekday, unless it is done already.
  const byWeekday = settings.schedule === 'weekday'
  const view = byWeekday ? weekdayView(plan.days, now, data.recent) : null
  const day: PlanDay | null = view
    ? view.today && !view.doneToday
      ? view.today
      : null
    : (plan.days.find((d) => d.id === nextDayId) ?? plan.days[0])

  const totalSets = day ? day.exercises.reduce((n, e) => n + plannedSetsFor(e.sets, settings.trainingAge), 0) : 0

  async function start(dayId: string) {
    setStarting(dayId)
    try {
      await startWorkoutFn({ data: { dayId } })
      setPickerOpen(false)
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start the workout.'))
    } finally {
      setStarting(null)
    }
  }

  const title = day ? day.name : view?.doneToday ? 'Done for today' : 'Rest day'
  const markType = day?.type ?? view?.today?.type
  const streak = weeklyStreakOf(
    data.recent.map((f) => f.finishedAt),
    now,
  )
  const nextLine = view?.next
    ? `Next: ${view.next.day.name}, ${view.next.inDays === 1 ? 'tomorrow' : weekdayOf(view.next.day)}.`
    : ''

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
        <Streak weeks={streak} />
      </div>
      {day ? (
        <p className="mt-3 text-muted-foreground">
          {day.exercises.length} exercises, {totalSets} sets
        </p>
      ) : (
        <p className="mt-3 text-muted-foreground">
          {view?.doneToday && view.today ? `${view.today.name} is in the log. ` : 'Nothing planned for today. '}
          {nextLine}
        </p>
      )}

      {data.alerts.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {data.alerts.map((a) => (
            <li key={a.kind + a.title} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
              {a.kind === 'stall' ? (
                <TrendingDown className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              ) : a.kind === 'week' ? (
                <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <Scale className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <p className="min-w-0 flex-1">
                <span className="font-medium">{a.title}</span> <span className="text-muted-foreground">{a.detail}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {nudge && nudge.kind !== waved && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5">
          {nudge.kind === 'weight' ? (
            <Scale className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <Ruler className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <p className="min-w-0 flex-1">
            <span className="font-medium">{nudge.title}</span>{' '}
            <span className="text-muted-foreground">{nudge.detail}</span>
          </p>
          <div className="ml-auto flex items-center gap-1">
            {nudge.kind === 'weight' ? (
              <LogBodyweightDialog units={settings.units} onLogged={onChanged} />
            ) : (
              <LogMeasurementsDialog lengthUnit={settings.units === 'kg' ? 'cm' : 'in'} onLogged={onChanged} />
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Not now" onClick={() => void wave(nudge.kind)}>
              <X aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {view && view.skipped.length > 0 && (
        <section className="mt-7" aria-labelledby="skipped-h">
          <SectionHeading id="skipped-h" icon={CalendarX}>
            Skipped this week
          </SectionHeading>
          <ul className="mt-3 divide-y border-y">
            {view.skipped.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <DayIcon type={d.type} className="size-8 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{d.name}</span>
                  <span className="block text-muted-foreground">{weekdayOf(d)}</span>
                </span>
                <Button variant="outline" size="sm" onClick={() => start(d.id)} disabled={starting !== null}>
                  Do it now
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {day && (
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
                  {plannedSetsFor(ex.sets, settings.trainingAge)} × {targetOf(ex)}
                </span>
              </Item>
            </div>
          ))}
        </ItemGroup>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
        {day && (
          <Button size="lg" className="h-12 text-base" onClick={() => start(day.id)} disabled={starting !== null}>
            Start {day.name}
          </Button>
        )}
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
              {plan.days.map((d) => {
                const doneAt = lastDoneAt(d.id, data.recent)
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
                        disabled={starting !== null}
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

// ---------------------------------------------------------------- active workout

interface ActiveProps {
  workout: Workout
  settings: Settings
  plan: Plan
  onChanged: () => void
  onSummary: (summary: SessionSummary, askFeedback: boolean) => void
}

function ActiveWorkout({ workout, settings, plan, onChanged, onSummary }: ActiveProps) {
  // The phone stays awake between sets, unless Settings says to let it sleep.
  useWakeLock(settings.keepAwake !== false)
  /** The sets as they are worked: every change is saved, a tick at once and a stepped number soon after. */
  const sets = useSessionSets(workout.entries, persist)
  const { entries, doneSets } = sets
  const [busy, setBusy] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  /** Zen mode: the screen holds one exercise at a time and nothing else. Lives in the URL. */
  const { zen = false } = Route.useSearch()
  const navigate = useNavigate()
  const setZen = (on: boolean) => navigate({ to: '/', search: on ? { zen: true } : {}, replace: true })
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const latest = useRef(entries)
  latest.current = entries

  function persist(exerciseId: string, sets: LoggedSet[], immediate: boolean) {
    const existing = pending.current.get(exerciseId)
    if (existing) clearTimeout(existing)
    const run = () => {
      pending.current.delete(exerciseId)
      saveSetsFn({ data: { workoutId: workout.id, exerciseId, sets } }).catch(() =>
        toast.error('Could not save that set. Check the connection.'),
      )
    }
    if (immediate) run()
    else pending.current.set(exerciseId, setTimeout(run, 500))
  }

  async function flush() {
    const ids = [...pending.current.keys()]
    for (const id of ids) {
      clearTimeout(pending.current.get(id))
      pending.current.delete(id)
      const entry = latest.current.find((e) => e.exerciseId === id)
      if (entry)
        await saveSetsFn({
          data: { workoutId: workout.id, exerciseId: id, sets: entry.sets },
        })
    }
  }

  /** Takes the set the ramp offered: the server adds it to the plan and the session; the row shows it at once. */
  async function rampUp(exerciseId: string) {
    try {
      await flush()
      const updated = await acceptRampFn({ data: { workoutId: workout.id, exerciseId } })
      sets.setEntries((es) => es.map((e) => (e.exerciseId === exerciseId ? updated : e)))
      toast.success(`${updated.name}: ${updated.sets.length} sets from now on`)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the set.'))
    }
  }

  async function finishNow(extra: { effort?: number; note?: string }) {
    setBusy(true)
    try {
      await flush()
      const res = await finishWorkoutFn({
        data: { workoutId: workout.id, ...extra },
      })
      setCheckInOpen(false)
      if (res.summary) onSummary(res.summary, res.askFeedback === true)
      else toast.success('Nothing was logged, so the workout was removed')
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not finish the workout.'))
      setBusy(false)
    }
  }

  /** Finish with nothing ticked would only throw the session away, so it asks that instead. */
  function onFinishClick() {
    if (doneSets === 0) setDiscardOpen(true)
    else setCheckInOpen(true)
  }

  async function switchTo(dayId: string) {
    setBusy(true)
    try {
      await startWorkoutFn({ data: { dayId } })
      setChangeOpen(false)
      toast('Switched day')
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not switch.'))
      setBusy(false)
    }
  }

  async function discard() {
    setBusy(true)
    try {
      await discardWorkoutFn({ data: { workoutId: workout.id } })
      setDiscardOpen(false)
      toast('Workout discarded')
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not discard the workout.'))
      setBusy(false)
    }
  }

  return (
    <div>
      <SessionTitle
        workout={workout}
        actions={
          <>
            <ZenButton onClick={() => setZen(true)} />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                {/* The trigger swaps the button's data-slot, so the touch-size rule in styles.css misses it:
                  size it here to match the Zen button beside it. */}
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="pointer-coarse:size-11"
                  aria-label="Session options"
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onSelect={() => setChangeOpen(true)}>
                  <ArrowLeftRight aria-hidden />
                  Change session
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setDiscardOpen(true)}>
                  <Trash2 aria-hidden />
                  Discard workout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Drawer open={changeOpen} onOpenChange={setChangeOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>Change this session</DrawerTitle>
            <DrawerDescription>
              {doneSets > 0
                ? `Switching drops the ${doneSets} ${doneSets === 1 ? 'set' : 'sets'} logged so far.`
                : 'Nothing is logged yet, so nothing is lost.'}
            </DrawerDescription>
          </DrawerHeader>
          <ItemGroup className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {plan.days
              .filter((d) => d.id !== workout.dayId)
              .map((d) => (
                <Item
                  key={d.id}
                  size="sm"
                  className="cursor-pointer px-2"
                  onClick={rowTap(() => switchTo(d.id)).onClick}
                >
                  <ItemMedia>
                    <DayIcon type={d.type} className="size-8 rounded-md" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-base">{d.name}</ItemTitle>
                    <ItemDescription>{d.exercises.length} exercises</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Switch to ${d.name}`}
                      onClick={() => switchTo(d.id)}
                      disabled={busy}
                    >
                      Switch
                    </Button>
                  </ItemActions>
                </Item>
              ))}
          </ItemGroup>
        </DrawerContent>
      </Drawer>
      <DiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        doneSets={doneSets}
        busy={busy}
        onDiscard={discard}
      />

      <SessionExercises sets={sets} units={settings.units} steps={stepsOf(settings)} onRamp={rampUp} />

      {/* Above the tab bar on phones, at the foot of the window from 768px. */}
      <SessionFooter
        sets={sets}
        busy={busy}
        onFinish={onFinishClick}
        className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] -mx-4 mt-6 px-4 md:bottom-0 md:-mx-8 md:px-8"
      />

      <FinishCheckIn
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        busy={busy}
        total={sets.totalSets}
        unticked={sets.totalSets - doneSets}
        onFinish={finishNow}
      />

      {zen && (
        <ZenMode
          workout={workout}
          entries={entries}
          current={sets.openId}
          units={settings.units}
          steps={stepsOf(settings)}
          doneSets={doneSets}
          totalSets={sets.totalSets}
          busy={busy}
          onCurrent={sets.setOpenId}
          onChangeSet={sets.changeSet}
          onToggleDone={sets.toggleDone}
          onAddSet={sets.addSet}
          onRemoveSet={sets.removeSet}
          onRamp={rampUp}
          onFinish={onFinishClick}
          onExit={() => setZen(false)}
        />
      )}
    </div>
  )
}
