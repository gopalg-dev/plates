import { Focus, Pause, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import { Accordion } from '#/components/ui/accordion'
import { Button } from '#/components/ui/button'
import { timeOfDay } from '#/lib/format'
import type { Steps } from '#/lib/logic/progression'
import { activeMs, elapsedLabel } from '#/lib/logic/session-time'
import type { Units, Workout } from '#/lib/types'
import { useNow } from '#/lib/use-now'
import { cn } from '#/lib/utils'
import { DayIcon } from './day-mark'
import { ExerciseRow } from './exercise-row'
import type { SessionSets } from './use-session-sets'

/*
 * The pieces of a running session, shared by Today and the demo on How it works: the title, the exercises with
 * their set loggers, and the bar that counts the sets and finishes. Change them here and both follow.
 */

/**
 * When it started, how long it has been going, and which day it is, with the session's buttons beside. The time
 * counts while the page is live and stops while the session is paused; `onPause` puts the pause button beside it.
 */
export function SessionTitle({
  workout,
  actions,
  onPause,
}: {
  workout: Pick<Workout, 'startedAt' | 'dayName' | 'dayType' | 'pausedAt' | 'pausedMs'>
  actions: ReactNode
  onPause?: (paused: boolean) => void
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-muted-foreground">
          Started {timeOfDay(workout.startedAt)}
          <Elapsed workout={workout} onPause={onPause} />
        </p>
        <h1 className="mt-1 flex items-center gap-3 font-condensed text-4xl font-semibold leading-none sm:text-5xl">
          <DayIcon type={workout.dayType} className="size-11 rounded-xl" />
          {workout.dayName}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  )
}

/**
 * "· 42 min" with a pause / resume button, as a span for a line of text. The minutes only appear once the page is
 * live (see `useNow`), and stand still while the session is paused.
 */
export function Elapsed({
  workout,
  onPause,
  className,
}: {
  workout: Pick<Workout, 'startedAt' | 'pausedAt' | 'pausedMs'>
  onPause?: (paused: boolean) => void
  className?: string
}) {
  const now = useNow(15_000)
  if (!now) return null
  const paused = Boolean(workout.pausedAt)
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span aria-hidden>·</span>
      <span className="tabular-nums">
        {elapsedLabel(activeMs(workout, now))}
        {paused && ', paused'}
      </span>
      {onPause && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 pointer-coarse:size-9"
          aria-label={paused ? 'Resume the session' : 'Pause the session'}
          onClick={() => onPause(!paused)}
        >
          {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
        </Button>
      )}
    </span>
  )
}

/** The button that turns the session into Zen mode. */
export function ZenButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" size="icon-sm" aria-label="Zen mode" onClick={onClick} disabled={disabled}>
      <Focus aria-hidden />
    </Button>
  )
}

/** Every exercise of the session, one open at a time, each with its set logger. */
export function SessionExercises({
  sets,
  units,
  steps,
  onRamp,
  onSwap,
}: {
  sets: SessionSets
  units: Units
  steps?: Steps
  onRamp?: (exerciseId: string) => void
  /** Opens the swap panel for a lift (the machine is taken). Absent in the demo. */
  onSwap?: (exerciseId: string) => void
}) {
  return (
    <Accordion
      type="single"
      collapsible
      value={sets.openId ?? ''}
      onValueChange={(v) => sets.setOpenId(v || null)}
      className="mt-6 border-t"
    >
      {sets.entries.map((entry) => (
        <ExerciseRow
          key={entry.exerciseId}
          entry={entry}
          units={units}
          steps={steps}
          onChangeSet={(i, patch) => sets.changeSet(entry.exerciseId, i, patch)}
          onToggleDone={(i) => sets.toggleDone(entry.exerciseId, i)}
          onAddSet={() => sets.addSet(entry.exerciseId)}
          onRemoveSet={() => sets.removeSet(entry.exerciseId)}
          onRamp={onRamp && (() => onRamp(entry.exerciseId))}
          onSwap={onSwap && (() => onSwap(entry.exerciseId))}
        />
      ))}
    </Accordion>
  )
}

/** The bar under the exercises: sets done so far, and Finish. Where it sticks is the page's call. */
export function SessionFooter({
  sets,
  busy,
  onFinish,
  className,
}: {
  sets: Pick<SessionSets, 'doneSets' | 'totalSets'>
  busy: boolean
  onFinish: () => void
  className?: string
}) {
  return (
    <div className={cn('z-30 border-t bg-background/95 py-3 backdrop-blur', className)}>
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 tabular-nums text-muted-foreground">
          {sets.doneSets} of {sets.totalSets} sets done
        </p>
        <Button onClick={onFinish} disabled={busy} className="shrink-0">
          Finish workout
        </Button>
      </div>
    </div>
  )
}
