import { ArrowLeftRight, Check } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion'
import { Button } from '#/components/ui/button'
import { Toggle } from '#/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { incrementFor, type Steps } from '#/lib/logic/progression'
import type { Exercise, LoggedSet, Units, WorkoutEntry } from '#/lib/types'
import { cn } from '#/lib/utils'
import { ExerciseThumb } from './exercise-thumb'
import { NumberField } from './number-field'

/** Reps left in the tank on the last set. Three or more tells the next session the weight was light. */
export const LEFT_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1–2' },
  { value: '3', label: '3+' },
]

export function targetOf(e: Pick<Exercise, 'repMin' | 'repMax' | 'loadType'>): string {
  const range = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}-${e.repMax}`
  return e.loadType === 'time' ? `${range} s` : range
}

export interface ExerciseRowProps {
  entry: WorkoutEntry
  units: Units
  /** The gym's smallest steps; see `stepsOf`. Unset reads as the common ones. */
  steps?: Steps
  onChangeSet: (index: number, patch: Partial<LoggedSet>) => void
  onToggleDone: (index: number) => void
  onAddSet: () => void
  /** Drops the last set. Offered while that set is still unticked and it is not the only one. */
  onRemoveSet: () => void
  /** Takes the set the ramp offered (`entry.rampOffer`): on the session and on the plan. Absent in the session editor. */
  onRamp?: () => void
  /** Opens the swap panel: another lift takes this one's place today. Absent in the session editor and the demo. */
  onSwap?: () => void
}

/** The nearest earlier set that has a value, so a blank set can borrow from it. */
function lastFilled(sets: LoggedSet[], index: number, key: 'weight' | 'reps' | 'seconds'): number | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const v = sets[i][key]
    if (v !== undefined) return v
  }
  return undefined
}

/**
 * One exercise in a session, as an accordion item: header row, and when open, the set logger.
 * Wrap a list of these in `<Accordion type="single" collapsible>`.
 */
export function ExerciseRow({
  entry,
  units,
  steps,
  onChangeSet,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onRamp,
  onSwap,
}: ExerciseRowProps) {
  const doneCount = entry.sets.filter((s) => s.done).length
  const allDone = entry.sets.length > 0 && doneCount === entry.sets.length
  const canRemove = entry.sets.length > 1 && !entry.sets[entry.sets.length - 1].done
  const weighted = entry.loadType === 'weight'
  const timed = entry.loadType === 'time'
  const cols = weighted
    ? 'grid-cols-[1.25rem_1fr_1fr_2.75rem] sm:grid-cols-[1.5rem_1fr_1fr_3rem]'
    : 'grid-cols-[1.25rem_1fr_2.75rem] sm:grid-cols-[1.5rem_1fr_3rem]'

  return (
    <AccordionItem value={entry.exerciseId}>
      {/* The still is its own button (it opens the library's view), so it sits beside the trigger, not inside it. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-3">
        <ExerciseThumb name={entry.name} />
        <AccordionTrigger className="items-center gap-3 py-3.5 text-base font-normal hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0">
          <span className="min-w-0 flex-1">
            <span className="block font-medium leading-tight">{entry.name}</span>
            <span className="mt-0.5 block text-muted-foreground">
              {entry.sets.length} × {targetOf(entry)}
            </span>
          </span>
          <span className={cn('text-sm tabular-nums', allDone ? 'text-success' : 'text-muted-foreground')}>
            {doneCount}/{entry.sets.length}
          </span>
          {allDone && (
            <span className="flex">
              <Check className="size-5 text-success" aria-hidden />
              <span className="sr-only">All sets done</span>
            </span>
          )}
        </AccordionTrigger>
      </div>
      <AccordionContent className="pb-4 text-base">
        {entry.hint && <p className="mb-3 text-muted-foreground">{entry.hint}</p>}
        <div className={cn('mb-1 grid gap-2 px-1 text-sm text-muted-foreground', cols)}>
          <span>Set</span>
          {weighted && <span className="text-center">Weight, {units}</span>}
          <span className="text-center">{timed ? 'Seconds' : 'Reps'}</span>
          <span />
        </div>
        <ol className="flex flex-col gap-2">
          {entry.sets.map((s, i) => {
            const prevWeight = targetFor(entry, entry.sets, i, 'weight')
            const prevReps = targetFor(entry, entry.sets, i, 'reps') ?? entry.repMin
            const prevSeconds = targetFor(entry, entry.sets, i, 'seconds') ?? entry.repMin
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a set is its position (set 1, set 2) and has no id
              <li key={i} className={cn('grid items-center gap-2', cols)}>
                <span className="pl-1 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                {weighted && (
                  <NumberField
                    label={`Set ${i + 1} weight`}
                    value={s.weight}
                    base={prevWeight}
                    onChange={(v) => onChangeSet(i, { weight: v })}
                    step={incrementFor(units, entry.equipment, steps, entry.plateLoaded)}
                    inputMode="decimal"
                    placeholder={prevWeight !== undefined ? String(prevWeight) : '0'}
                  />
                )}
                {timed ? (
                  <NumberField
                    label={`Set ${i + 1} seconds`}
                    value={s.seconds}
                    base={prevSeconds}
                    onChange={(v) => onChangeSet(i, { seconds: v })}
                    step={5}
                    inputMode="numeric"
                    placeholder={String(prevSeconds)}
                  />
                ) : (
                  <NumberField
                    label={`Set ${i + 1} reps`}
                    value={s.reps}
                    base={prevReps}
                    onChange={(v) => onChangeSet(i, { reps: v })}
                    step={1}
                    inputMode="numeric"
                    placeholder={String(prevReps)}
                  />
                )}
                <Toggle
                  pressed={s.done}
                  disabled={!s.done && !canComplete(entry, entry.sets, i)}
                  onPressedChange={() => onToggleDone(i)}
                  aria-label={`Mark set ${i + 1} ${s.done ? 'not done' : 'done'}`}
                  className={cn(
                    'h-12 w-11 rounded-lg border border-input bg-card text-muted-foreground hover:bg-card hover:text-foreground sm:w-12',
                    'data-[state=on]:border-success data-[state=on]:bg-success data-[state=on]:text-success-foreground',
                  )}
                >
                  <Check className="size-5" aria-hidden />
                </Toggle>
              </li>
            )
          })}
        </ol>
        {weighted && entry.sets[entry.sets.length - 1].done && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-muted-foreground">Reps left</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={2}
              value={String(entry.sets[entry.sets.length - 1].left ?? '')}
              onValueChange={(v) => onChangeSet(entry.sets.length - 1, { left: v ? Number(v) : undefined })}
              aria-label={`Reps left on set ${entry.sets.length}`}
            >
              {LEFT_OPTIONS.map((o) => (
                <ToggleGroupItem key={o.value} value={o.value} className="px-3">
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {entry.rampOffer && onRamp && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRamp}
              aria-label={`Add set ${entry.sets.length + 1} to the plan`}
            >
              +1 set to plan
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onAddSet}>
            Add a set
          </Button>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={onRemoveSet}
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
              onClick={onSwap}
              aria-label={`Swap ${entry.name}`}
            >
              <ArrowLeftRight aria-hidden />
              Swap
            </Button>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

type Target = Pick<WorkoutEntry, 'suggested'>

/**
 * What a blank field stands for: the set's own target from earlier sessions, else the nearest earlier
 * set in this session. Undefined when neither is known.
 */
export function targetFor(
  entry: Target,
  sets: LoggedSet[],
  index: number,
  key: 'weight' | 'reps' | 'seconds',
): number | undefined {
  return entry.suggested?.[index]?.[key] ?? lastFilled(sets, index, key)
}

/** The weight a set would be logged at: its own, else its target. Undefined when none is above zero. */
export function weightFor(entry: Target, sets: LoggedSet[], index: number): number | undefined {
  const w = sets[index].weight ?? targetFor(entry, sets, index, 'weight')
  return w !== undefined && w > 0 ? w : undefined
}

/** Whether a set can be marked done: a weight set needs a weight above zero, the others always can. */
export function canComplete(entry: Pick<WorkoutEntry, 'loadType'> & Target, sets: LoggedSet[], index: number): boolean {
  return entry.loadType !== 'weight' || weightFor(entry, sets, index) !== undefined
}

/**
 * Marks a set done, filling blanks from the set's target, the nearest earlier set, or the rep range. A
 * weight set with no weight stays as it is. Shared by Today and the session editor.
 */
export function completeSet(entry: WorkoutEntry, sets: LoggedSet[], index: number): LoggedSet[] {
  if (!sets[index].done && !canComplete(entry, sets, index)) return sets
  return sets.map((s, i) => {
    if (i !== index) return s
    const done = !s.done
    if (!done) return { ...s, done }
    if (entry.loadType === 'time') {
      return { ...s, seconds: s.seconds ?? targetFor(entry, sets, index, 'seconds') ?? entry.repMin, done }
    }
    const reps = s.reps ?? targetFor(entry, sets, index, 'reps') ?? entry.repMin
    if (entry.loadType === 'weight') return { ...s, weight: weightFor(entry, sets, index), reps, done }
    return { ...s, reps, done }
  })
}
