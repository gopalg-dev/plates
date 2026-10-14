import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { incrementFor, type Steps } from '#/lib/logic/progression'
import type { LoggedSet, Units, Workout, WorkoutEntry } from '#/lib/types'
import { cn } from '#/lib/utils'
import { DayIcon } from './day-mark'
import { canComplete, LEFT_OPTIONS, targetFor, targetOf } from './exercise-row'
import { ExerciseThumb } from './exercise-thumb'
import { NumberField } from './number-field'
import { Elapsed } from './session-view'

/*
 * Zen mode: one exercise on the screen. Every set is listed with its numbers, so the sets already
 * done stay in view; the set being worked sits on a pad of two tall fields with one full-width
 * button under them, where a thumb finds it without looking. Everything else stays small and grey.
 */

export interface ZenProps {
  workout: Workout
  entries: WorkoutEntry[]
  current: string | null
  units: Units
  steps?: Steps
  doneSets: number
  totalSets: number
  busy: boolean
  onCurrent: (exerciseId: string) => void
  onChangeSet: (exerciseId: string, index: number, patch: Partial<LoggedSet>) => void
  onToggleDone: (exerciseId: string, index: number) => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string) => void
  onRamp: (exerciseId: string) => void
  /** Opens the swap panel for a lift. Absent in the demo. */
  onSwap?: (exerciseId: string) => void
  /** Pauses or resumes the session's clock. Absent in the demo. */
  onPause?: (paused: boolean) => void
  onFinish: () => void
  onExit: () => void
}

/** One exercise filling the screen, over the whole app: `ZenScreen` in a full-screen dialog. */
export function ZenMode(props: ZenProps) {
  return (
    <Dialog open onOpenChange={(o) => !o && props.onExit()}>
      {/* The whole screen, over the app. The dialog locks the page scroll behind it. */}
      <DialogContent
        showCloseButton={false}
        aria-label="Zen mode"
        className="inset-0 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Zen mode</DialogTitle>
        <DialogDescription className="sr-only">One exercise at a time.</DialogDescription>
        <ZenScreen {...props} />
      </DialogContent>
    </Dialog>
  )
}

/**
 * The Zen pad itself, filling whatever holds it: the dialog above in the app, a phone frame in the demo on How it
 * works. Ticking the last set moves to the next exercise.
 */
export function ZenScreen({
  workout,
  entries,
  current,
  units,
  steps,
  doneSets,
  totalSets,
  busy,
  onCurrent,
  onChangeSet,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onRamp,
  onSwap,
  onPause,
  onFinish,
  onExit,
}: ZenProps) {
  // The exercise on screen: the current one; with none current, the first with a set left, else the last.
  const found = entries.findIndex((e) => e.exerciseId === current)
  const open = entries.findIndex((e) => e.sets.some((s) => !s.done))
  const at = found >= 0 ? found : open >= 0 ? open : entries.length - 1
  const entry = entries[at]
  const last = at === entries.length - 1

  // The set on the pad: the first not done, unless a row was tapped to bring another back.
  const [pick, setPick] = useState<{ id: string; index: number } | null>(null)
  const firstOpen = entry.sets.findIndex((s) => !s.done)
  const index =
    pick?.id === entry.exerciseId && pick.index < entry.sets.length
      ? pick.index
      : firstOpen === -1
        ? entry.sets.length - 1
        : firstOpen
  const set = entry.sets[index]
  const weighted = entry.loadType === 'weight'
  const timed = entry.loadType === 'time'
  const prevWeight = targetFor(entry, entry.sets, index, 'weight')
  const prevReps = targetFor(entry, entry.sets, index, 'reps') ?? entry.repMin
  const prevSeconds = targetFor(entry, entry.sets, index, 'seconds') ?? entry.repMin
  const lastSet = entry.sets[entry.sets.length - 1]
  const allDone = entry.sets.every((s) => s.done)
  const canRemove = entry.sets.length > 1 && !lastSet.done
  // Once every set of a weight exercise is done, the last thing to say is how many reps were left.
  const askLeft = weighted && allDone
  const showPill = !askLeft || pick?.id === entry.exerciseId
  const cols = weighted ? 'grid-cols-[2rem_1fr_1fr_2rem]' : 'grid-cols-[2rem_1fr_2rem]'

  const toggle = () => {
    // Ticking a set moves the pad on to the next one; unticking keeps it here to be fixed.
    setPick(set.done ? { id: entry.exerciseId, index } : null)
    onToggleDone(entry.exerciseId, index)
  }

  /** A set's numbers for the list: what was logged, else what it is aiming for, greyed. */
  const cell = (i: number, key: 'weight' | 'reps' | 'seconds') => {
    const s = entry.sets[i]
    const own = s[key]
    if (own !== undefined) return <span>{own}</span>
    const target = targetFor(entry, entry.sets, i, key) ?? (key === 'weight' ? undefined : entry.repMin)
    return <span className="text-muted-foreground/60">{target ?? '–'}</span>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-safe">
        <p className="mt-3 flex min-w-0 items-center gap-2 text-muted-foreground">
          <DayIcon type={workout.dayType} className="size-6 shrink-0 rounded-md" />
          <span className="truncate">{workout.dayName}</span>
          <Elapsed workout={workout} onPause={onPause} className="shrink-0" />
        </p>
        <Button variant="ghost" size="sm" className="mt-3 -mr-2" onClick={onExit}>
          <X aria-hidden />
          Exit zen
        </Button>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto scrollbar-none px-4">
        {/* Centred when the screen is tall enough, scrolling when it is not. */}
        <div className="my-auto py-5">
          {/* The name beside its picture: a long name wraps (a long word breaks), and the picture keeps its size. */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm tabular-nums text-muted-foreground">
                {at + 1} of {entries.length}
              </p>
              <h2 className="mt-1 font-condensed text-4xl font-semibold leading-none [overflow-wrap:anywhere] sm:text-5xl">
                {entry.name}
              </h2>
              <p className="mt-2 text-base tabular-nums text-muted-foreground">
                {entry.sets.length} × {targetOf(entry)}
              </p>
            </div>
            <ExerciseThumb name={entry.name} className="size-20 rounded-xl sm:size-24" />
          </div>
          {entry.hint && <p className="mt-2 text-base text-muted-foreground">{entry.hint}</p>}

          {/* Every set with its numbers: logged ones as they were, the rest as their targets. A tap brings a set to the pad. */}
          <div className={cn('mt-6 grid gap-2 px-3 text-sm text-muted-foreground', cols)}>
            <span>Set</span>
            {weighted && <span className="text-center">Weight, {units}</span>}
            <span className="text-center">{timed ? 'Seconds' : 'Reps'}</span>
            <span />
          </div>
          <ol className="mt-1 flex flex-col gap-1" aria-label="Sets">
            {entry.sets.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a set is its position (set 1, set 2) and has no id
              <li key={i}>
                <button
                  type="button"
                  aria-label={`Set ${i + 1}${s.done ? ', done' : ''}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setPick({ id: entry.exerciseId, index: i })}
                  className={cn(
                    'block h-12 w-full rounded-lg px-3 text-left text-lg tabular-nums outline-none transition-colors',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    i === index ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50',
                  )}
                >
                  {/* The grid sits on a span: a button does not lay its children out as a grid. */}
                  <span className={cn('grid h-full items-center gap-2', cols)}>
                    <span className={cn('text-base', i === index ? 'font-semibold' : 'text-muted-foreground')}>
                      {i + 1}
                    </span>
                    {weighted && <span className="text-center">{cell(i, 'weight')}</span>}
                    <span className="text-center">{cell(i, timed ? 'seconds' : 'reps')}</span>
                    <span className="flex justify-end">
                      {s.done && <Check className="size-5 text-success" aria-hidden />}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className={cn('mt-5 grid gap-3', weighted ? 'grid-cols-2' : 'grid-cols-1')}>
            {weighted && (
              <NumberField
                size="lg"
                label={`Set ${index + 1} weight`}
                value={set.weight}
                base={prevWeight}
                onChange={(v) => onChangeSet(entry.exerciseId, index, { weight: v })}
                step={incrementFor(units, entry.equipment, steps, entry.plateLoaded)}
                inputMode="decimal"
                placeholder={prevWeight !== undefined ? String(prevWeight) : '0'}
              />
            )}
            {timed ? (
              <NumberField
                size="lg"
                label={`Set ${index + 1} seconds`}
                value={set.seconds}
                base={prevSeconds}
                onChange={(v) => onChangeSet(entry.exerciseId, index, { seconds: v })}
                step={5}
                inputMode="numeric"
                placeholder={String(prevSeconds)}
              />
            ) : (
              <NumberField
                size="lg"
                label={`Set ${index + 1} reps`}
                value={set.reps}
                base={prevReps}
                onChange={(v) => onChangeSet(entry.exerciseId, index, { reps: v })}
                step={1}
                inputMode="numeric"
                placeholder={String(prevReps)}
              />
            )}
          </div>

          {askLeft && (
            <div className="mt-5">
              <p className="text-center text-muted-foreground">Reps left on set {entry.sets.length}</p>
              <ToggleGroup
                type="single"
                variant="outline"
                value={String(lastSet.left ?? '')}
                onValueChange={(v) => v && onChangeSet(entry.exerciseId, entry.sets.length - 1, { left: Number(v) })}
                className="mt-2 w-full"
                aria-label={`Reps left on set ${entry.sets.length}`}
              >
                {LEFT_OPTIONS.map((o) => (
                  <ToggleGroupItem key={o.value} value={o.value} className="h-14 flex-1 text-lg">
                    {o.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          {showPill && (
            <Button
              size="lg"
              variant={set.done ? 'outline' : 'default'}
              disabled={!set.done && !canComplete(entry, entry.sets, index)}
              aria-label={`Mark set ${index + 1} ${set.done ? 'not done' : 'done'}`}
              onClick={toggle}
              className="mt-3 h-14 w-full text-lg"
            >
              {set.done ? (
                <>Undo set {index + 1}</>
              ) : (
                <>
                  <Check className="size-6" aria-hidden />
                  Set {index + 1} done
                </>
              )}
            </Button>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
            {entry.rampOffer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRamp(entry.exerciseId)}
                aria-label={`Add set ${entry.sets.length + 1} to the plan`}
              >
                +1 set to plan
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onAddSet(entry.exerciseId)}
            >
              Add a set
            </Button>
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => onRemoveSet(entry.exerciseId)}
                aria-label={`Remove set ${entry.sets.length}`}
              >
                Remove the last set
              </Button>
            )}
            {onSwap && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => onSwap(entry.exerciseId)}
                aria-label={`Swap ${entry.name}`}
              >
                <ArrowLeftRight aria-hidden />
                Swap
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12"
            disabled={at === 0}
            onClick={() => onCurrent(entries[at - 1].exerciseId)}
            aria-label="Previous exercise"
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <p className="flex-1 text-center tabular-nums text-muted-foreground">
            {doneSets} of {totalSets} sets done
          </p>
          {last ? (
            <Button size="lg" className="h-12" onClick={onFinish} disabled={busy}>
              Finish workout
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="h-12"
              onClick={() => onCurrent(entries[at + 1].exerciseId)}
              aria-label="Next exercise"
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
