import { ArrowLeftRight, ChevronLeft, FileChartColumn, MoreHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Accordion } from '#/components/ui/accordion'
import { Button } from '#/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '#/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { DEMO_SETTINGS, DEMO_SPLIT, demoHistory, demoSession } from '#/content/guide/demo-data'
import { findLibraryByName } from '#/lib/library'
import type { Alert } from '#/lib/logic/alerts'
import {
  addExerciseTo,
  lineOf,
  removeExerciseFrom,
  swapExerciseIn,
  swapLine,
  updateExerciseIn,
} from '#/lib/logic/day-edit'
import type { PeriodKind } from '#/lib/logic/report'
import { setsLeft, swapEntries } from '#/lib/logic/session-sync'
import {
  addDays,
  attachBodyweight,
  bodyweightTrend,
  plannedSetsFor,
  recentPRs,
  weeklyStreakOf,
} from '#/lib/logic/stats'
import { finishSummary, type SessionSummary } from '#/lib/logic/summary'
import { rowTap } from '#/lib/row-tap'
import { buildSplit, splitInfo } from '#/lib/splits'
import type { BodyweightLog, Exercise, MeasurementLog, PlanDay, Workout, WorkoutEntry } from '#/lib/types'
import { useContent } from '#/lib/use-content'
import { cn } from '#/lib/utils'
import { Wordmark } from './app-mark'
import { DayIcon } from './day-mark'
import { ExerciseEditor, type ExerciseEditorActions } from './exercise-editor'
import { NextUpView } from './next-up'
import { DayDialog, DaySection, PlanTitle } from './plan-view'
import { ReportView } from './report-view'
import { DiscardDialog, FinishCheckIn, SummaryDialog } from './session-finish'
import { SessionExercises, SessionFooter, SessionTitle, ZenButton } from './session-view'
import { BodyTab } from './stats-body'
import { LiftsTab, liftsFrom } from './stats-lifts'
import { SessionsTab } from './stats-sessions'
import { type StatsTab, StatsTabs, StatsTitle } from './stats-view'
import { SwapLiftPanel } from './swap-lift'
import { type PrimaryTab, TabBar } from './tab-bar'
import { useSessionSets } from './use-session-sets'
import { ZenScreen } from './zen-mode'

/*
 * The screens the phones on How it works run: the app's own pieces (the same rows, pad, editor, plan days, check-in,
 * summary and stats as the real screens, so they change when those do) on the made-up numbers in
 * `src/content/guide/demo-data.ts`. Nothing is saved. Each fills the window of a `DemoPhone`
 * (src/routes/demo.$screen.tsx).
 */

/** The screens a demo phone can run, by their name in `/demo/<screen>`. */
export const DEMO_SCREENS = ['app', 'zen', 'plan', 'lifts', 'body'] as const
export type DemoScreenName = (typeof DEMO_SCREENS)[number]

/** The made-up training the screens share: a finished demo session joins it, and Stats shows it. */
interface History {
  now: Date
  days: PlanDay[]
  workouts: Workout[]
  bodyweights: BodyweightLog[]
  measurements: MeasurementLog[]
}

/** `app` is the whole app to tap through; the others are one screen each, for the guide's pictures. */
export function DemoScreen({ screen }: { screen: DemoScreenName }) {
  const [history, setHistory] = useState<History>(() => {
    const now = new Date()
    return { now, ...demoHistory(now) }
  })
  const finished = (workout: Workout) => setHistory((h) => ({ ...h, workouts: [...h.workouts, workout] }))
  if (screen === 'app') return <AppDemo history={history} onFinished={finished} />
  if (screen === 'zen') return <SessionDemo start="zen" history={history} onFinished={finished} />
  if (screen === 'plan') return <PlanDemo />
  return <StatsDemo tab={screen} history={history} />
}

/** For the controls the demos leave to the real app: weekdays, renaming and removing days, opening a weigh-in. */
const nothing = () => undefined

/** The bar the app shows on phones, with the wordmark. */
function DemoHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center border-b px-4">
      <Wordmark />
    </header>
  )
}

// ---------------------------------------------------------------- the app

type Screen = PrimaryTab['to']

/**
 * The app as a phone shows it: Today, Plan and Stats behind the tab bar. The three stay in place while another is
 * shown, as the app's screens keep theirs, so ticked sets wait for the way back. Zen covers the tab bar, as its
 * full-screen dialog does in the app.
 */
function AppDemo({ history, onFinished }: { history: History; onFinished: (workout: Workout) => void }) {
  const [screen, setScreen] = useState<Screen>('/')
  const [zen, setZen] = useState(false)
  // Report sits in the menu in the app; the demo has no sidebar, so a button in the top bar opens it over the tabs.
  const [report, setReport] = useState(false)
  const panel = (shown: boolean) =>
    cn('relative flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none', !shown && 'hidden')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!zen && <DemoTopBar report={report} onReport={() => setReport(true)} onBack={() => setReport(false)} />}
      {/* Built only while open: it has no in-progress state to keep, and its text would otherwise double the tabs'. */}
      <div className={panel(report)}>{report && <ReportDemo history={history} />}</div>
      <div className={panel(!report && screen === '/')}>
        <TodayDemo history={history} onFinished={onFinished} onZen={setZen} onReport={() => setReport(true)} />
      </div>
      <div className={panel(!report && screen === '/plan')}>
        <PlanDemo header={false} />
      </div>
      <div className={panel(!report && screen === '/stats')}>
        <StatsDemo tab="lifts" history={history} header={false} />
      </div>
      {!zen && !report && (
        <TabBar
          className="shrink-0"
          renderTab={(tab, content, className) => (
            <button
              type="button"
              className={className}
              data-status={tab.to === screen ? 'active' : undefined}
              aria-current={tab.to === screen ? 'page' : undefined}
              onClick={() => setScreen(tab.to)}
            >
              {content}
            </button>
          )}
        />
      )}
    </div>
  )
}

/** The demo's top bar: the wordmark and a Report button, or a Back button while the report is open. */
function DemoTopBar({ report, onReport, onBack }: { report: boolean; onReport: () => void; onBack: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      {report ? (
        <button type="button" onClick={onBack} className="-ml-1 flex items-center gap-1 py-1 pr-2 text-sm font-medium">
          <ChevronLeft className="size-5" aria-hidden />
          Back
        </button>
      ) : (
        <Wordmark />
      )}
      {!report && (
        <button
          type="button"
          onClick={onReport}
          className="flex items-center gap-1.5 py-1 text-sm font-medium text-muted-foreground"
        >
          <FileChartColumn className="size-4" aria-hidden />
          Report
        </button>
      )}
    </header>
  )
}

/** The Report page on the made-up history: the last finished week, with the period picker and share all live. */
function ReportDemo({ history }: { history: History }) {
  const [period, setPeriod] = useState<{ kind: PeriodKind; anchor: Date }>({ kind: 'week', anchor: history.now })
  const data = useMemo(
    () => ({
      settings: {
        units: DEMO_SETTINGS.units,
        trainingAge: DEMO_SETTINGS.trainingAge,
        schedule: DEMO_SETTINGS.schedule,
        joinedAt: addDays(history.now, -180).toISOString(),
      },
      plan: { days: history.days, updatedAt: history.now.toISOString() },
      workouts: attachBodyweight(history.workouts, history.bodyweights),
      bodyweights: history.bodyweights,
    }),
    [history],
  )
  return (
    <div className="px-4 pt-5 pb-8">
      <ReportView
        data={data}
        kind={period.kind}
        anchor={period.anchor}
        now={history.now}
        name="Sam"
        onChange={(kind, anchor) => setPeriod({ kind, anchor: anchor ?? history.now })}
      />
    </div>
  )
}

// ---------------------------------------------------------------- session

interface SessionProps {
  start: 'session' | 'zen'
  history: History
  /** The plan day to run; the default picks the next one, as the app does. */
  dayId?: string
  /** A session finished: it joins the history. */
  onFinished: (workout: Workout) => void
  /** Zen mode opened or closed. */
  onZen?: (on: boolean) => void
  /** The wordmark bar above the session. Off inside the app demo, which has its own top bar. */
  header?: boolean
}

/**
 * Today's session, ticked through on the page. Finishing asks how it went and shows the summary, as Today does; the
 * session then joins the history and the next one begins, its targets worked out from it.
 */
function SessionDemo({ start, history, dayId, onFinished, onZen, header }: SessionProps) {
  const [run, setRun] = useState(0)
  const next = () => {
    setRun((n) => n + 1)
    onZen?.(start === 'zen')
  }
  return (
    <SessionRun
      key={run}
      start={start}
      history={history}
      dayId={dayId}
      onFinished={(workout) => {
        onFinished(workout)
        next()
      }}
      onEmpty={next}
      onZen={onZen}
      header={header}
    />
  )
}

function SessionRun({
  start,
  history,
  dayId,
  onFinished,
  onEmpty,
  onSwitch,
  onZen,
  header = true,
}: SessionProps & {
  /** Discarded: there is nothing to keep. */
  onEmpty: () => void
  /** Switch to another plan day mid-session; given, the session menu (Change / Discard) shows. */
  onSwitch?: (dayId: string) => void
}) {
  // Built once, from the history as it stood when this session began.
  const [session] = useState(() => demoSession(history.days, history.workouts, new Date(), dayId))
  const sets = useSessionSets(session.entries)
  const [zen, setZenState] = useState(start === 'zen')
  const [checkIn, setCheckIn] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [done, setDone] = useState<{ workout: Workout; summary: SessionSummary } | null>(null)
  const { units } = DEMO_SETTINGS
  const { library } = useContent()
  /** The lift the swap panel is open for: the machine is taken, so another lift takes its place for the session. */
  const [swapId, setSwapId] = useState<string | null>(null)
  const switchTo = (id: string) => {
    setChangeOpen(false)
    onSwitch?.(id)
  }
  const setZen = (on: boolean) => {
    setZenState(on)
    onZen?.(on)
  }

  /** Finish with nothing ticked would only throw the session away, so it asks that instead, as Today does. */
  function finishClick() {
    if (sets.doneSets > 0) setCheckIn(true)
    else setDiscard(true)
  }

  function finish(extra: { effort?: number; note?: string }) {
    const now = new Date()
    const workout: Workout = {
      ...session,
      ...extra,
      entries: sets.entries,
      status: 'done',
      finishedAt: now.toISOString(),
    }
    const plan = { days: history.days, updatedAt: now.toISOString() }
    const summary = finishSummary(workout, history.workouts, history.bodyweights, plan, DEMO_SETTINGS, now)
    setCheckIn(false)
    setDone({ workout, summary })
  }

  /** Another lift takes the swapped one's place for the rest of the session, built as a fresh entry. */
  function swapLift(name: string) {
    const entry = sets.entries.find((e) => e.exerciseId === swapId)
    if (!entry) return
    const taken = sets.entries.filter((e) => e !== entry).map((e) => e.exerciseId)
    const swapped = swapLine(lineOf(entry, entry.sets.length), name, library, taken)
    const known = findLibraryByName(library, swapped.name)
    const count = entry.sets.some((s) => s.done) ? setsLeft(entry) : swapped.sets
    const fresh: WorkoutEntry = {
      exerciseId: swapped.id,
      name: swapped.name,
      muscle: swapped.muscle,
      loadType: swapped.loadType,
      repMin: swapped.repMin,
      repMax: swapped.repMax,
      ...(known ? { equipment: known.equipment } : {}),
      ...(known?.plateLoaded ? { plateLoaded: true as const } : {}),
      sets: Array.from({ length: count }, () => ({ done: false })),
    }
    sets.setEntries(swapEntries(sets.entries, entry.exerciseId, fresh))
    sets.setOpenId(fresh.exerciseId)
    setSwapId(null)
    toast.success(`${swapped.name} today`)
  }

  return (
    <>
      {zen ? (
        <ZenScreen
          workout={session}
          entries={sets.entries}
          current={sets.openId}
          units={units}
          doneSets={sets.doneSets}
          totalSets={sets.totalSets}
          busy={false}
          onCurrent={sets.setOpenId}
          onChangeSet={sets.changeSet}
          onToggleDone={sets.toggleDone}
          onAddSet={sets.addSet}
          onRemoveSet={sets.removeSet}
          // The made-up lifts earn no extra set, so the ramp is never offered.
          onRamp={nothing}
          onSwap={setSwapId}
          onFinish={finishClick}
          onExit={() => setZen(false)}
        />
      ) : (
        <>
          {header && <DemoHeader />}
          <div className="flex-1 px-4 pt-5">
            <SessionTitle
              workout={session}
              actions={
                <>
                  <ZenButton onClick={() => setZen(true)} />
                  {onSwitch && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
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
                        <DropdownMenuItem variant="destructive" onSelect={() => setDiscard(true)}>
                          <Trash2 aria-hidden />
                          Discard workout
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              }
            />
            <SessionExercises sets={sets} units={units} onSwap={setSwapId} />
          </div>
          <SessionFooter sets={sets} busy={false} onFinish={finishClick} className="sticky bottom-0 mt-6 px-4" />
        </>
      )}
      <SwapLiftPanel
        entry={sets.entries.find((e) => e.exerciseId === swapId) ?? null}
        alternates={[]}
        onPlan={false}
        busy={false}
        onClose={() => setSwapId(null)}
        onPick={(name) => swapLift(name)}
      />
      <FinishCheckIn
        open={checkIn}
        onOpenChange={setCheckIn}
        busy={false}
        total={sets.totalSets}
        unticked={sets.totalSets - sets.doneSets}
        onFinish={finish}
      />
      {onSwitch && (
        <Drawer open={changeOpen} onOpenChange={setChangeOpen}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader>
              <DrawerTitle>Change this session</DrawerTitle>
              <DrawerDescription>
                {sets.doneSets > 0
                  ? `Switching drops the ${sets.doneSets} ${sets.doneSets === 1 ? 'set' : 'sets'} logged so far.`
                  : 'Nothing is logged yet, so nothing is lost.'}
              </DrawerDescription>
            </DrawerHeader>
            <ItemGroup className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {history.days
                .filter((d) => d.id !== session.dayId)
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
                        disabled={d.exercises.length === 0}
                      >
                        Switch
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
            </ItemGroup>
          </DrawerContent>
        </Drawer>
      )}
      <DiscardDialog
        open={discard}
        onOpenChange={setDiscard}
        doneSets={sets.doneSets}
        busy={false}
        onDiscard={() => {
          toast('Workout discarded')
          onEmpty()
        }}
      />
      <SummaryDialog
        summary={done?.summary ?? null}
        askFeedback={false}
        onClose={() => {
          if (done) onFinished(done.workout)
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------- today

/** One alert for the Today illustration: the real card deck on a made-up weekly review. */
const DEMO_ALERT: Alert = {
  kind: 'review',
  key: 'demo-review',
  title: 'Your week is ready',
  detail: 'See how last week went.',
  to: '/report',
}

/**
 * Today: the Next up screen first — the day the plan says is next, its lifts, the streak and a review alert — then
 * the live session once Start (or a day from Pick a day) is tapped, and back to Next up when it ends.
 */
function TodayDemo({
  history,
  onFinished,
  onZen,
  onReport,
}: {
  history: History
  onFinished: (workout: Workout) => void
  onZen: (on: boolean) => void
  onReport: () => void
}) {
  /** The day being trained, or null on Next up. */
  const [active, setActive] = useState<PlanDay | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  if (active) {
    const leave = () => {
      setActive(null)
      onZen(false)
    }
    return (
      <SessionRun
        key={active.id}
        start="session"
        dayId={active.id}
        history={history}
        header={false}
        onZen={onZen}
        onFinished={(workout) => {
          onFinished(workout)
          leave()
        }}
        onEmpty={leave}
        onSwitch={(id) => setActive(history.days.find((d) => d.id === id) ?? active)}
      />
    )
  }

  const day = history.days.find((d) => d.type === 'pull') ?? history.days[0]
  const totalSets = day.exercises.reduce((n, e) => n + plannedSetsFor(e.sets, DEMO_SETTINGS.trainingAge), 0)
  const recent = history.workouts.flatMap((w) => (w.finishedAt ? [{ dayId: w.dayId, finishedAt: w.finishedAt }] : []))
  const streak = weeklyStreakOf(
    recent.map((f) => f.finishedAt),
    history.now,
  )
  const alerts = [DEMO_ALERT].filter((a) => !dismissed.has(a.key))

  return (
    <div className="flex-1 px-4 pt-5 pb-8">
      <NextUpView
        day={day}
        days={history.days}
        trainingAge={DEMO_SETTINGS.trainingAge}
        now={history.now}
        streakWeeks={streak}
        title={day.name}
        markType={day.type}
        summary={`${day.exercises.length} exercises, ${totalSets} sets`}
        byWeekday={false}
        recent={recent}
        alerts={alerts}
        onDismissAlert={(key) => setDismissed((prev) => new Set(prev).add(key))}
        onAlertAction={onReport}
        onStart={(id) => setActive(history.days.find((d) => d.id === id) ?? day)}
        starting={null}
      />
    </div>
  )
}

// ---------------------------------------------------------------- plan

/** The default plan: days to open, reorder and move, and exercises to edit, swap, add and remove, on the page. */
function PlanDemo({ header = true }: { header?: boolean }) {
  const { library } = useContent()
  const [days, setDays] = useState<PlanDay[]>(() => buildSplit(DEMO_SPLIT))
  const [openDay, setOpenDay] = useState<string | null>(() => days[0]?.id ?? null)
  const [editing, setEditing] = useState<{ day: PlanDay; exercise: Exercise | null } | null>(null)
  const [renaming, setRenaming] = useState<PlanDay | null>(null)
  // Each day's exercises in the template's own order, for Restore default order.
  const defaults = useMemo(() => new Map(buildSplit(DEMO_SPLIT).map((d) => [d.id, d.exercises.map((e) => e.id)])), [])

  /** One day changed by `edit`, the same edits the server makes; one that throws leaves the plan as it was. */
  function editDay(dayId: string, edit: (day: PlanDay) => PlanDay) {
    const day = days.find((d) => d.id === dayId)
    if (!day) throw new Error('Day not found')
    const changed = edit(day)
    setDays((ds) => ds.map((d) => (d.id === dayId ? changed : d)))
  }
  const actions: ExerciseEditorActions = {
    save: async (dayId, exerciseId, fields) =>
      editDay(dayId, (d) => (exerciseId ? updateExerciseIn(d, exerciseId, fields) : addExerciseTo(d, fields))),
    remove: async (dayId, exerciseId) => editDay(dayId, (d) => removeExerciseFrom(d, exerciseId)),
    swap: async (dayId, exerciseId, alternate) =>
      editDay(dayId, (d) => swapExerciseIn(d, exerciseId, alternate, library)),
  }
  const reorder = async (dayId: string, order: string[]) =>
    editDay(dayId, (d) => ({ ...d, exercises: order.flatMap((id) => d.exercises.filter((e) => e.id === id)) }))
  const move = (dayId: string, direction: 'up' | 'down') =>
    setDays((ds) => {
      const i = ds.findIndex((d) => d.id === dayId)
      const j = direction === 'up' ? i - 1 : i + 1
      if (i < 0 || j < 0 || j >= ds.length) return ds
      const next = [...ds]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  return (
    <>
      {header && <DemoHeader />}
      <div className="px-4 pt-5 pb-6">
        <PlanTitle split={splitInfo(DEMO_SPLIT)} dayCount={days.length} schedule="rolling" />
        <Accordion
          type="single"
          collapsible
          value={openDay ?? ''}
          onValueChange={(v) => setOpenDay(v || null)}
          className="mt-6 border-t"
        >
          {days.map((day, i) => (
            <DaySection
              key={day.id}
              day={day}
              settings={DEMO_SETTINGS}
              schedule="rolling"
              position={i === 0 ? 'first' : i === days.length - 1 ? 'last' : 'middle'}
              onlyDay={false}
              onEdit={(exercise) => setEditing({ day, exercise })}
              onAdd={() => setEditing({ day, exercise: null })}
              defaultOrder={defaults.get(day.id) ?? []}
              onReorder={(order) => reorder(day.id, order)}
              onWeekday={nothing}
              onRename={() => setRenaming(day)}
              onMove={(direction) => move(day.id, direction)}
              onRemove={nothing}
            />
          ))}
        </Accordion>
      </div>
      <DayDialog
        day={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (name, type) => {
          if (renaming) editDay(renaming.id, (d) => ({ ...d, name, type }))
          setRenaming(null)
        }}
      />
      <ExerciseEditor
        editing={editing}
        trainingAge={DEMO_SETTINGS.trainingAge}
        actions={actions}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
    </>
  )
}

// ---------------------------------------------------------------- stats

/** The history on the three tabs. A day on the calendar opens nothing: there is no session editor here. */
function StatsDemo({ tab: first, history, header = true }: { tab: StatsTab; history: History; header?: boolean }) {
  const [tab, setTab] = useState<StatsTab>(first)
  const data = useMemo(() => {
    const plan = { days: history.days, updatedAt: history.now.toISOString() }
    return {
      plan,
      lifts: liftsFrom(plan, history.workouts),
      prs: recentPRs(history.workouts, history.now),
      bw: bodyweightTrend(history.bodyweights, history.now),
    }
  }, [history])
  const { units } = DEMO_SETTINGS
  return (
    <>
      {header && <DemoHeader />}
      <div className="px-4 pt-5 pb-6">
        <StatsTitle />
        <StatsTabs tab={tab} onChange={setTab} />
        {tab === 'lifts' && <LiftsTab lifts={data.lifts} prs={data.prs} units={units} now={history.now} />}
        {tab === 'sessions' && (
          <SessionsTab
            workouts={history.workouts}
            plan={data.plan}
            trainingAge={DEMO_SETTINGS.trainingAge}
            joinedAt={undefined}
            units={units}
            now={history.now}
            onOpenDay={nothing}
          />
        )}
        {tab === 'body' && (
          <BodyTab
            bw={data.bw}
            bodyweights={history.bodyweights}
            measurements={history.measurements}
            units={units}
            lengthUnit="cm"
            now={history.now}
            goal={DEMO_SETTINGS.goal}
            onPickWeight={nothing}
            onPickTape={nothing}
          />
        )}
      </div>
    </>
  )
}
