import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Flame,
  Focus,
  MoreHorizontal,
  Ruler,
  Scale,
  Trash2,
  TrendingDown,
  Trophy,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogBodyweightDialog, LogMeasurementsDialog } from '#/components/app/body-dialogs'
import { DayIcon } from '#/components/app/day-mark'
import { ExerciseRow, completeSet, targetOf } from '#/components/app/exercise-row'
import { ExerciseThumb } from '#/components/app/exercise-thumb'
import { SectionHeading } from '#/components/app/section-heading'
import { Accordion } from '#/components/ui/accordion'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import { Input } from '#/components/ui/input'
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
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { errorMessage, timeOfDay } from '#/lib/format'
import { EFFORTS, EFFORT_LABEL, type Effort } from '#/lib/logic/effort'
import { nudgeFor } from '#/lib/logic/nudges'
import { WEEKDAY_LONG, WEEKDAY_SHORT, weekdayView } from '#/lib/logic/schedule'
import { plannedSetsFor, weeklyStreakOf } from '#/lib/logic/stats'
import { useWakeLock } from '#/lib/use-wake-lock'
import { rowTap } from '#/lib/row-tap'
import { cn } from '#/lib/utils'
import {
  type LoggedSet,
  type Plan,
  type PlanDay,
  type Settings,
  type Units,
  type Workout,
  type WorkoutEntry,
} from '#/lib/types'
import { FeedbackFields, useSendFeedback } from '#/components/app/feedback-form'
import type { Mood } from '#/lib/logic/feedback'
import type { SessionSummary } from '#/lib/logic/summary'
import type { TodayData } from '#/server/repo'
import {
  discardWorkoutFn,
  dismissFeedbackFn,
  finishWorkoutFn,
  getTodayFn,
  saveSetsFn,
  startWorkoutFn,
} from '#/server/fns'
import { pageTitle } from '#/lib/page-title'

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

// ---------------------------------------------------------------- finish summary

/** What the session did, shown once at Finish: every lift's best set, new bests marked, the week's count. */
function SummaryDialog({
  summary,
  askFeedback,
  onClose,
}: {
  summary: SessionSummary | null
  askFeedback: boolean
  onClose: () => void
}) {
  const [mood, setMood] = useState<Mood | null>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const { send, busy } = useSendFeedback('summary')
  const asking = askFeedback && !sent

  async function close() {
    // Waving the prompt away counts: the next one waits a month.
    if (asking) void dismissFeedbackFn().catch(() => undefined)
    onClose()
    setMood(null)
    setText('')
    setSent(false)
  }

  async function sendNow() {
    if (await send(mood, text)) setSent(true)
  }

  return (
    <Dialog open={summary !== null} onOpenChange={(open) => !open && void close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workout saved</DialogTitle>
          <DialogDescription>
            {summary ? `${summary.week.done} of ${summary.week.planned} sessions this week.` : ''}
          </DialogDescription>
        </DialogHeader>
        {summary && (
          <ul className="divide-y">
            {summary.lines.map((l) => (
              <li key={l.exerciseId} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="shrink-0 tabular-nums">{l.best}</span>
                {l.pr ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-success" aria-label="New best">
                    <Trophy className="size-4" aria-hidden />
                    best
                  </span>
                ) : l.change ? (
                  <span
                    className={cn(
                      'shrink-0 text-sm tabular-nums',
                      l.change.startsWith('+') ? 'text-success' : 'text-muted-foreground',
                    )}
                  >
                    {l.change}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {asking && (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">How is Plates for you?</p>
            <FeedbackFields mood={mood} text={text} onMood={setMood} onText={setText} compact />
          </div>
        )}
        <DialogFooter>
          {asking && (
            <Button variant="outline" onClick={sendNow} disabled={busy || (mood === null && !text.trim())}>
              Send
            </Button>
          )}
          <Button onClick={close}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- next up

/** The week streak, top right of Today: a flame and a big number. Muted until the first streak week. */
function Streak({ weeks }: { weeks: number }) {
  const on = weeks > 0
  return (
    <div
      className={cn('flex shrink-0 items-center gap-2', on ? 'text-foreground' : 'text-muted-foreground')}
      aria-label={`${weeks} ${weeks === 1 ? 'week' : 'weeks'} streak`}
    >
      <Flame aria-hidden className={cn('size-8 sm:size-9', on ? 'fill-day-legs text-day-legs' : '')} />
      <span className="font-condensed text-4xl font-semibold leading-none tabular-nums sm:text-5xl">{weeks}</span>
    </div>
  )
}

function NextUp({ data, onChanged }: { data: TodayData; onChanged: () => void }) {
  const { plan, settings, nextDayId } = data
  const [starting, setStarting] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const now = new Date()
  const nudge = nudgeFor(data.lastBodyweightAt, data.lastMeasurementAt, now)

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
    ? `Next: ${view.next.day.name}, ${view.next.inDays === 1 ? 'tomorrow' : WEEKDAY_LONG[view.next.day.weekday!]}.`
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
          {view?.doneToday ? `${view.today!.name} is in the log. ` : 'Nothing planned for today. '}
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
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{a.title}</span> <span className="text-muted-foreground">{a.detail}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {nudge && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5">
          {nudge.kind === 'weight' ? (
            <Scale className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <Ruler className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{nudge.title}</span>{' '}
            <span className="text-muted-foreground">{nudge.detail}</span>
          </p>
          <div className="ml-auto">
            {nudge.kind === 'weight' ? (
              <LogBodyweightDialog units={settings.units} onLogged={onChanged} />
            ) : (
              <LogMeasurementsDialog lengthUnit={settings.units === 'kg' ? 'cm' : 'in'} onLogged={onChanged} />
            )}
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
                  <span className="block text-sm text-muted-foreground">{WEEKDAY_LONG[d.weekday!]}</span>
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
              {plan.days.map((d) => (
                <Item key={d.id} size="sm" className="cursor-pointer px-2" onClick={rowTap(() => start(d.id)).onClick}>
                  <ItemMedia>
                    <DayIcon type={d.type} className="size-8 rounded-md" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-base">{d.name}</ItemTitle>
                    <ItemDescription>
                      {byWeekday && d.weekday !== undefined
                        ? WEEKDAY_SHORT[d.weekday]
                        : `${d.exercises.length} exercises`}
                    </ItemDescription>
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
              ))}
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
  const [entries, setEntries] = useState<WorkoutEntry[]>(workout.entries)
  const [openId, setOpenId] = useState<string | null>(
    () => workout.entries.find((e) => e.sets.some((s) => !s.done))?.exerciseId ?? null,
  )
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

  function updateSets(exerciseId: string, mutate: (sets: LoggedSet[]) => LoggedSet[], immediate = false) {
    const next = entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: mutate(e.sets) } : e))
    setEntries(next)
    const entry = next.find((e) => e.exerciseId === exerciseId)
    if (entry) persist(exerciseId, entry.sets, immediate)
  }

  /** Opens the next exercise with something left to do, once this one is finished with. */
  function advanceFrom(exerciseId: string) {
    const following = entries.find((e) => e.exerciseId !== exerciseId && e.sets.some((s) => !s.done))
    setOpenId(following?.exerciseId ?? null)
  }

  function changeSet(exerciseId: string, index: number, patch: Partial<LoggedSet>) {
    updateSets(exerciseId, (sets) => sets.map((s, i) => (i === index ? { ...s, ...patch } : s)))
    // The reps-left answer on the last set is the last thing to do on a weight exercise.
    const entry = entries.find((e) => e.exerciseId === exerciseId)
    if (patch.left !== undefined && entry && entry.sets.every((s) => s.done)) advanceFrom(exerciseId)
  }

  function toggleDone(exerciseId: string, index: number) {
    const entry = entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) return
    const nowDone = !entry.sets[index].done
    updateSets(exerciseId, (sets) => completeSet(entry, sets, index), true)
    if (!nowDone) return
    const allDone = entry.sets.every((s, i) => i === index || s.done)
    // A weight exercise stays open after its last set so the reps-left question can be answered.
    if (allDone && entry.loadType !== 'weight') advanceFrom(exerciseId)
  }

  function addSet(exerciseId: string) {
    updateSets(exerciseId, (sets) => {
      const last = sets[sets.length - 1]
      return [...sets, { ...last, done: false }]
    })
  }

  function removeSet(exerciseId: string) {
    updateSets(exerciseId, (sets) => (sets.length > 1 && !sets[sets.length - 1].done ? sets.slice(0, -1) : sets), true)
  }

  const totalSets = entries.reduce((n, e) => n + e.sets.length, 0)
  const doneSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

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

  function onFinishClick() {
    if (doneSets === 0) void finishNow({})
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
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground">Started {timeOfDay(workout.startedAt)}</p>
          <h1 className="mt-1 flex items-center gap-3 font-condensed text-4xl font-semibold leading-none sm:text-5xl">
            <DayIcon type={workout.dayType} className="size-11 rounded-xl" />
            {workout.dayName}
          </h1>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" className="shrink-0" aria-label="Session options">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onSelect={() => setZen(true)}>
              <Focus aria-hidden />
              Zen mode
            </DropdownMenuItem>
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
      </header>

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
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this workout?</DialogTitle>
            <DialogDescription>
              {doneSets > 0
                ? `The ${doneSets} ${doneSets === 1 ? 'set' : 'sets'} logged so far will be lost.`
                : 'Nothing is logged yet, so nothing is lost.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
              Keep going
            </Button>
            <Button variant="destructive" onClick={discard} disabled={busy}>
              Discard workout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Accordion
        type="single"
        collapsible
        value={openId ?? ''}
        onValueChange={(v) => setOpenId(v || null)}
        className="mt-6 border-t"
      >
        {entries.map((entry) => (
          <ExerciseRow
            key={entry.exerciseId}
            entry={entry}
            units={settings.units}
            onChangeSet={(i, patch) => changeSet(entry.exerciseId, i, patch)}
            onToggleDone={(i) => toggleDone(entry.exerciseId, i)}
            onAddSet={() => addSet(entry.exerciseId)}
            onRemoveSet={() => removeSet(entry.exerciseId)}
          />
        ))}
      </Accordion>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-8 md:px-8">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm tabular-nums text-muted-foreground">
            {doneSets} of {totalSets} sets done
          </p>
          <Button onClick={onFinishClick} disabled={busy} className="shrink-0">
            Finish workout
          </Button>
        </div>
      </div>

      <FinishCheckIn open={checkInOpen} onOpenChange={setCheckInOpen} busy={busy} onFinish={finishNow} />

      {zen && (
        <ZenMode
          workout={workout}
          entries={entries}
          current={openId}
          units={settings.units}
          doneSets={doneSets}
          totalSets={totalSets}
          busy={busy}
          onCurrent={setOpenId}
          onChangeSet={changeSet}
          onToggleDone={toggleDone}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onFinish={onFinishClick}
          onExit={() => setZen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- zen mode

interface ZenProps {
  workout: Workout
  entries: WorkoutEntry[]
  current: string | null
  units: Units
  doneSets: number
  totalSets: number
  busy: boolean
  onCurrent: (exerciseId: string) => void
  onChangeSet: (exerciseId: string, index: number, patch: Partial<LoggedSet>) => void
  onToggleDone: (exerciseId: string, index: number) => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string) => void
  onFinish: () => void
  onExit: () => void
}

/** One exercise filling the screen, over the whole app. Ticking the last set moves to the next exercise. */
function ZenMode({
  workout,
  entries,
  current,
  units,
  doneSets,
  totalSets,
  busy,
  onCurrent,
  onChangeSet,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onFinish,
  onExit,
}: ZenProps) {
  const at = Math.max(
    0,
    entries.findIndex((e) => e.exerciseId === current),
  )
  const entry = entries[at]
  const last = at === entries.length - 1
  return (
    <Dialog open onOpenChange={(o) => !o && onExit()}>
      {/* The whole screen, over the app. The dialog locks the page scroll behind it. */}
      <DialogContent
        showCloseButton={false}
        aria-label="Zen mode"
        className="inset-0 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Zen mode</DialogTitle>
        <DialogDescription className="sr-only">One exercise at a time.</DialogDescription>
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-safe">
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <DayIcon type={workout.dayType} className="size-6 rounded-md" />
            {workout.dayName}
          </p>
          <Button variant="ghost" size="sm" className="mt-3 -mr-2" onClick={onExit}>
            <X aria-hidden />
            Exit zen
          </Button>
        </div>
        <div className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto scrollbar-none px-4 pb-6">
          <p className="mt-6 text-sm tabular-nums text-muted-foreground">
            {at + 1} of {entries.length}
          </p>
          <Accordion type="single" value={entry.exerciseId} className="mt-1 border-t">
            <ExerciseRow
              key={entry.exerciseId}
              entry={entry}
              units={units}
              onChangeSet={(i, patch) => onChangeSet(entry.exerciseId, i, patch)}
              onToggleDone={(i) => onToggleDone(entry.exerciseId, i)}
              onAddSet={() => onAddSet(entry.exerciseId)}
              onRemoveSet={() => onRemoveSet(entry.exerciseId)}
            />
          </Accordion>
        </div>
        <div className="shrink-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={at === 0}
              onClick={() => onCurrent(entries[at - 1].exerciseId)}
              aria-label="Previous exercise"
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <p className="flex-1 text-center text-sm tabular-nums text-muted-foreground">
              {doneSets} of {totalSets} sets done
            </p>
            {last ? (
              <Button size="sm" onClick={onFinish} disabled={busy}>
                Finish workout
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCurrent(entries[at + 1].exerciseId)}
                aria-label="Next exercise"
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- finish check-in

interface CheckInProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onFinish: (extra: { effort?: number; note?: string }) => void
}

function FinishCheckIn({ open, onOpenChange, busy, onFinish }: CheckInProps) {
  const [effort, setEffort] = useState<Effort | undefined>(undefined)
  const [note, setNote] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How did it go?</DialogTitle>
          <DialogDescription className="sr-only">Pick how hard it felt.</DialogDescription>
        </DialogHeader>
        <ToggleGroup
          type="single"
          variant="outline"
          value={effort ? String(effort) : ''}
          onValueChange={(v) => setEffort(v ? (Number(v) as Effort) : undefined)}
          className="w-full"
          aria-label="Effort"
        >
          {EFFORTS.map((e) => (
            <ToggleGroupItem key={e} value={String(e)} className="h-12 flex-1">
              {EFFORT_LABEL[e]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything to remember? Optional"
          aria-label="Session note"
          maxLength={200}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onFinish({})} disabled={busy}>
            Skip
          </Button>
          <Button onClick={() => onFinish({ effort, note: note.trim() || undefined })} disabled={busy}>
            Save and finish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
