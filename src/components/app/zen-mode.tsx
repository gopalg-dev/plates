import { Check, ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { incrementFor } from '#/lib/logic/progression'
import type { LoggedSet, Units, Workout, WorkoutEntry } from '#/lib/types'
import { cn } from '#/lib/utils'
import { DayIcon } from './day-mark'
import { LEFT_OPTIONS, canComplete, targetFor, targetOf } from './exercise-row'

/*
 * Zen mode: one exercise, one set, two numbers, one button. The screen is laid out like a phone's
 * clock app: the numbers are the biggest thing on it and the one action is a full-width pill under
 * them, so a thumb finds it without looking. Everything else stays small and grey.
 */

export interface ZenProps {
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

function round(n: number): number {
  return Math.round(n * 100) / 100
}

interface BigNumberProps {
  label: string
  unit: string
  value: number | undefined
  /** Where the buttons step from while the field is still blank: the set's target, or the set before. */
  base: number | undefined
  step: number
  placeholder: string
  inputMode: 'decimal' | 'numeric'
  onChange: (value: number | undefined) => void
}

/** A number big enough to read from the bench, with a round button either side of it. */
function BigNumber({ label, unit, value, base, step, placeholder, inputMode, onChange }: BigNumberProps) {
  const nudge = (dir: 1 | -1) => onChange(round(Math.max(0, (value ?? base ?? 0) + dir * step)))
  return (
    <div className="flex min-w-0 flex-col items-center">
      <input
        type="number"
        inputMode={inputMode}
        aria-label={label}
        value={value ?? ''}
        placeholder={placeholder}
        step={step}
        min={0}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value === '' ? undefined : round(Math.max(0, Number(e.target.value))))}
        className={cn(
          'w-full min-w-0 rounded-lg bg-transparent text-center font-condensed text-7xl font-semibold tabular-nums leading-none text-foreground outline-none',
          'placeholder:text-muted-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        )}
      />
      <span className="mt-1 text-sm text-muted-foreground">{unit}</span>
      <div className="mt-3 flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-14 rounded-full"
          aria-label={`Decrease ${label}`}
          onClick={() => nudge(-1)}
        >
          <Minus className="size-5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-14 rounded-full"
          aria-label={`Increase ${label}`}
          onClick={() => nudge(1)}
        >
          <Plus className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

/** One exercise filling the screen, over the whole app. Ticking the last set moves to the next exercise. */
export function ZenMode({
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
  // The exercise on screen: the current one; with none current, the first with a set left, else the last.
  const found = entries.findIndex((e) => e.exerciseId === current)
  const open = entries.findIndex((e) => e.sets.some((s) => !s.done))
  const at = found >= 0 ? found : open >= 0 ? open : entries.length - 1
  const entry = entries[at]
  const last = at === entries.length - 1

  // The set on the pad: the first not done, unless a dot was tapped to go back to another.
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

  const toggle = () => {
    // Ticking a set moves the pad on to the next one; unticking keeps it here to be fixed.
    setPick(set.done ? { id: entry.exerciseId, index } : null)
    onToggleDone(entry.exerciseId, index)
  }

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

        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto scrollbar-none px-5">
          {/* Centred when the screen is tall enough, scrolling when it is not. */}
          <div className="my-auto py-6">
            <p className="text-sm tabular-nums text-muted-foreground">
              {at + 1} of {entries.length}
            </p>
            <h2 className="mt-1 font-condensed text-4xl font-semibold leading-none sm:text-5xl">{entry.name}</h2>
            <p className="mt-2 text-base tabular-nums text-muted-foreground">
              {entry.sets.length} × {targetOf(entry)}
            </p>
            {entry.hint && <p className="mt-1 text-base text-muted-foreground">{entry.hint}</p>}

            <ol className="mt-6 flex flex-wrap gap-3" aria-label="Sets">
              {entry.sets.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    aria-label={`Set ${i + 1}${s.done ? ', done' : ''}`}
                    aria-current={i === index ? 'true' : undefined}
                    onClick={() => setPick({ id: entry.exerciseId, index: i })}
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full border text-base font-medium tabular-nums outline-none transition-colors',
                      'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      s.done
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-input bg-card text-muted-foreground',
                      i === index && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                    )}
                  >
                    {s.done ? <Check className="size-5" aria-hidden /> : i + 1}
                  </button>
                </li>
              ))}
            </ol>

            <div className={cn('mt-8 grid gap-4', weighted ? 'grid-cols-2' : 'grid-cols-1')}>
              {weighted && (
                <BigNumber
                  label={`Set ${index + 1} weight`}
                  unit={units}
                  value={set.weight}
                  base={prevWeight}
                  step={incrementFor(entry.muscle, units)}
                  placeholder={prevWeight !== undefined ? String(prevWeight) : '0'}
                  inputMode="decimal"
                  onChange={(v) => onChangeSet(entry.exerciseId, index, { weight: v })}
                />
              )}
              {timed ? (
                <BigNumber
                  label={`Set ${index + 1} seconds`}
                  unit="seconds"
                  value={set.seconds}
                  base={prevSeconds}
                  step={5}
                  placeholder={String(prevSeconds)}
                  inputMode="numeric"
                  onChange={(v) => onChangeSet(entry.exerciseId, index, { seconds: v })}
                />
              ) : (
                <BigNumber
                  label={`Set ${index + 1} reps`}
                  unit="reps"
                  value={set.reps}
                  base={prevReps}
                  step={1}
                  placeholder={String(prevReps)}
                  inputMode="numeric"
                  onChange={(v) => onChangeSet(entry.exerciseId, index, { reps: v })}
                />
              )}
            </div>

            {askLeft && (
              <div className="mt-8">
                <p className="text-center text-sm text-muted-foreground">Reps left on set {entry.sets.length}</p>
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
                className={cn('h-16 w-full rounded-full text-lg', askLeft ? 'mt-4' : 'mt-8')}
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

            <div className="mt-3 flex justify-center gap-1">
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
            <p className="flex-1 text-center text-sm tabular-nums text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  )
}
