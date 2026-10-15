import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeftRight, MoreHorizontal, Ruler, Scale, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogBodyweightDialog, LogMeasurementsDialog } from '#/components/app/body-dialogs'
import { DayIcon } from '#/components/app/day-mark'
import { NextUpView } from '#/components/app/next-up'
import { DiscardDialog, FinishCheckIn, SummaryDialog } from '#/components/app/session-finish'
import { SessionExercises, SessionFooter, SessionTitle, ZenButton } from '#/components/app/session-view'
import { SwapLiftPanel } from '#/components/app/swap-lift'
import { useSessionSets } from '#/components/app/use-session-sets'
import { ZenMode } from '#/components/app/zen-mode'
import { Button } from '#/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '#/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { errorMessage } from '#/lib/format'
import { nudgeFor } from '#/lib/logic/nudges'
import { stepsOf } from '#/lib/logic/progression'
import { weekdayOf, weekdayView } from '#/lib/logic/schedule'
import type { Pause } from '#/lib/logic/session-time'
import { plannedSetsFor, weeklyStreakOf } from '#/lib/logic/stats'
import type { SessionSummary } from '#/lib/logic/summary'
import { pageTitle } from '#/lib/page-title'
import { rowTap } from '#/lib/row-tap'
import type { LoggedSet, NudgeKind, Plan, PlanDay, Settings, Workout } from '#/lib/types'
import { useWakeLock } from '#/lib/use-wake-lock'
import {
  acceptRampFn,
  discardWorkoutFn,
  dismissAlertFn,
  dismissNudgeFn,
  finishWorkoutFn,
  getTodayFn,
  pauseWorkoutFn,
  saveSetsFn,
  skipDayFn,
  startWorkoutFn,
  swapSessionExerciseFn,
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

function NextUp({ data, onChanged }: { data: TodayData; onChanged: () => void }) {
  const { plan, settings, nextDayId } = data
  const [starting, setStarting] = useState<string | null>(null)
  const now = new Date()
  const nudge = nudgeFor(data.lastBodyweightAt, data.lastMeasurementAt, now, settings.nudges)
  // "Not now" hides the reminder at once; the server remembers it, and the next reload shows the next one, if any.
  const [waved, setWaved] = useState<NudgeKind | null>(null)
  // Alerts dismissed this visit; the server hides them on the next load, this keeps them gone until then.
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const shownAlerts = data.alerts.filter((a) => !dismissedAlerts.has(a.key))
  const dismissAlert = (key: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(key))
    dismissAlertFn({ data: { key } }).catch((err) => toast.error(errorMessage(err, 'Could not dismiss that.')))
  }
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

  const title = day ? day.name : view?.doneToday ? 'Done for today' : 'Rest day'
  const markType = day?.type ?? view?.today?.type
  const streak = weeklyStreakOf(
    data.recent.map((f) => f.finishedAt),
    now,
  )
  const totalSets = day ? day.exercises.reduce((n, e) => n + plannedSetsFor(e.sets, settings.trainingAge), 0) : 0
  const nextLine = view?.next
    ? `Next: ${view.next.day.name}, ${view.next.inDays === 1 ? 'tomorrow' : weekdayOf(view.next.day)}.`
    : ''
  const summary = day
    ? `${day.exercises.length} exercises, ${totalSets} sets`
    : `${view?.doneToday && view.today ? `${view.today.name} is in the log. ` : 'Nothing planned for today. '}${nextLine}`

  async function start(dayId: string) {
    setStarting(dayId)
    try {
      await startWorkoutFn({ data: { dayId } })
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start the workout.'))
    } finally {
      setStarting(null)
    }
  }

  /** Next up moves past the day shown without a session. Rolling order only: by weekday, the calendar decides. */
  async function skip(dayId: string) {
    try {
      await skipDayFn({ data: { dayId } })
      toast(`Skipped ${plan.days.find((d) => d.id === dayId)?.name ?? 'the day'}`)
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not skip it.'))
    }
  }

  // The weigh-in / tape reminder: the one app-specific slot the shared view does not carry.
  const reminder =
    nudge && nudge.kind !== waved ? (
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
    ) : null

  return (
    <NextUpView
      day={day}
      days={plan.days}
      trainingAge={settings.trainingAge}
      now={now}
      streakWeeks={streak}
      title={title}
      markType={markType}
      summary={summary}
      byWeekday={byWeekday}
      recent={data.recent}
      alerts={shownAlerts}
      onDismissAlert={dismissAlert}
      onStart={start}
      starting={starting}
      onSkip={!byWeekday && plan.days.length > 1 ? skip : undefined}
      nudge={reminder}
    />
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
  /** The lift the swap panel is open for. */
  const [swapId, setSwapId] = useState<string | null>(null)
  const swapping = entries.find((e) => e.exerciseId === swapId)
  /** The plan's line for the lift being swapped: its alternates, and whether the plan can take the swap too. */
  const planLine = plan.days.find((d) => d.id === workout.dayId)?.exercises.find((e) => e.id === swapId)
  /** The pause as the server last confirmed it; the title's clock reads it. */
  const [pause, setPause] = useState<Pause>({ pausedAt: workout.pausedAt, pausedMs: workout.pausedMs })
  const timed = { ...workout, ...pause }
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

  /** Another lift takes the swapped one's place today; with `alsoPlan`, on the plan day as well. */
  async function swapLift(name: string, alsoPlan: boolean) {
    if (!swapId) return
    setBusy(true)
    try {
      await flush()
      const updated = await swapSessionExerciseFn({
        data: { workoutId: workout.id, exerciseId: swapId, name, alsoPlan },
      })
      sets.setEntries(updated.entries)
      const fresh = updated.entries.find((e) => e.name === name)
      if (fresh) sets.setOpenId(fresh.exerciseId)
      setSwapId(null)
      toast.success(alsoPlan ? `${name} today and on the plan` : `${name} today`)
      if (alsoPlan) onChanged()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not swap.'))
    } finally {
      setBusy(false)
    }
  }

  async function pauseSession(paused: boolean) {
    try {
      setPause(await pauseWorkoutFn({ data: { workoutId: workout.id, paused } }))
    } catch (err) {
      toast.error(errorMessage(err, paused ? 'Could not pause.' : 'Could not resume.'))
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
        workout={timed}
        onPause={pauseSession}
        actions={
          <>
            {/* A session can lose every lift to "Plan and today" after the day was emptied: nothing for Zen then. */}
            <ZenButton onClick={() => setZen(true)} disabled={entries.length === 0} />
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
                      disabled={busy || d.exercises.length === 0}
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

      <SessionExercises
        sets={sets}
        units={settings.units}
        steps={stepsOf(settings)}
        onRamp={rampUp}
        onSwap={setSwapId}
      />
      <SwapLiftPanel
        entry={swapping ?? null}
        alternates={(planLine?.alternates ?? []).filter((a) => a !== swapping?.name)}
        onPlan={planLine !== undefined}
        busy={busy}
        onClose={() => setSwapId(null)}
        onPick={swapLift}
      />

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

      {zen && entries.length > 0 && (
        <ZenMode
          workout={timed}
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
          onSwap={setSwapId}
          onPause={pauseSession}
          onFinish={onFinishClick}
          onExit={() => setZen(false)}
        />
      )}
    </div>
  )
}
