import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Accordion } from '#/components/ui/accordion'
import { DEMO_SETTINGS, DEMO_SPLIT, demoHistory, demoSession } from '#/content/guide/demo-data'
import { addExerciseTo, removeExerciseFrom, swapExerciseIn, updateExerciseIn } from '#/lib/logic/day-edit'
import { bodyweightTrend, recentPRs } from '#/lib/logic/stats'
import { finishSummary, type SessionSummary } from '#/lib/logic/summary'
import { buildSplit, splitInfo } from '#/lib/splits'
import type { BodyweightLog, Exercise, MeasurementLog, PlanDay, Workout } from '#/lib/types'
import { useContent } from '#/lib/use-content'
import { cn } from '#/lib/utils'
import { Wordmark } from './app-mark'
import { ExerciseEditor, type ExerciseEditorActions } from './exercise-editor'
import { DaySection, PlanTitle } from './plan-view'
import { DiscardDialog, FinishCheckIn, SummaryDialog } from './session-finish'
import { SessionExercises, SessionFooter, SessionTitle, ZenButton } from './session-view'
import { BodyTab } from './stats-body'
import { LiftsTab, liftsFrom } from './stats-lifts'
import { SessionsTab } from './stats-sessions'
import { type StatsTab, StatsTabs, StatsTitle } from './stats-view'
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
  const panel = (on: Screen) =>
    cn('relative flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none', screen !== on && 'hidden')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={panel('/')}>
        <SessionDemo start="session" history={history} onFinished={onFinished} onZen={setZen} />
      </div>
      <div className={panel('/plan')}>
        <PlanDemo />
      </div>
      <div className={panel('/stats')}>
        <StatsDemo tab="lifts" history={history} />
      </div>
      {!zen && (
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

// ---------------------------------------------------------------- session

interface SessionProps {
  start: 'session' | 'zen'
  history: History
  /** A session finished: it joins the history. */
  onFinished: (workout: Workout) => void
  /** Zen mode opened or closed. */
  onZen?: (on: boolean) => void
}

/**
 * Today's session, ticked through on the page. Finishing asks how it went and shows the summary, as Today does; the
 * session then joins the history and the next one begins, its targets worked out from it.
 */
function SessionDemo({ start, history, onFinished, onZen }: SessionProps) {
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
      onFinished={(workout) => {
        onFinished(workout)
        next()
      }}
      onEmpty={next}
      onZen={onZen}
    />
  )
}

function SessionRun({
  start,
  history,
  onFinished,
  onEmpty,
  onZen,
}: SessionProps & {
  /** Discarded: there is nothing to keep. */
  onEmpty: () => void
}) {
  // Built once, from the history as it stood when this session began.
  const [session] = useState(() => demoSession(history.days, history.workouts, new Date()))
  const sets = useSessionSets(session.entries)
  const [zen, setZenState] = useState(start === 'zen')
  const [checkIn, setCheckIn] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [done, setDone] = useState<{ workout: Workout; summary: SessionSummary } | null>(null)
  const { units } = DEMO_SETTINGS
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
          onFinish={finishClick}
          onExit={() => setZen(false)}
        />
      ) : (
        <>
          <DemoHeader />
          <div className="flex-1 px-4 pt-5">
            <SessionTitle workout={session} actions={<ZenButton onClick={() => setZen(true)} />} />
            <SessionExercises sets={sets} units={units} />
          </div>
          <SessionFooter sets={sets} busy={false} onFinish={finishClick} className="sticky bottom-0 mt-6 px-4" />
        </>
      )}
      <FinishCheckIn
        open={checkIn}
        onOpenChange={setCheckIn}
        busy={false}
        total={sets.totalSets}
        unticked={sets.totalSets - sets.doneSets}
        onFinish={finish}
      />
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

// ---------------------------------------------------------------- plan

/** The default plan: days to open, reorder and move, and exercises to edit, swap, add and remove, on the page. */
function PlanDemo() {
  const { library } = useContent()
  const [days, setDays] = useState<PlanDay[]>(() => buildSplit(DEMO_SPLIT))
  const [openDay, setOpenDay] = useState<string | null>(() => days[0]?.id ?? null)
  const [editing, setEditing] = useState<{ day: PlanDay; exercise: Exercise | null } | null>(null)
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
      <DemoHeader />
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
              onRename={nothing}
              onMove={(direction) => move(day.id, direction)}
              onRemove={nothing}
            />
          ))}
        </Accordion>
      </div>
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
function StatsDemo({ tab: first, history }: { tab: StatsTab; history: History }) {
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
      <DemoHeader />
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
