import { Check } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion'
import { Button } from '#/components/ui/button'
import { Toggle } from '#/components/ui/toggle'
import { incrementFor } from '#/lib/logic/progression'
import type { Exercise, LoggedSet, Units, WorkoutEntry } from '#/lib/types'
import { cn } from '#/lib/utils'
import { ExerciseThumb } from './exercise-thumb'
import { NumberField } from './number-field'

export function targetOf(e: Pick<Exercise, 'repMin' | 'repMax' | 'loadType'>): string {
  const range = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}-${e.repMax}`
  return e.loadType === 'time' ? `${range} s` : range
}

export interface ExerciseRowProps {
  entry: WorkoutEntry
  units: Units
  onChangeSet: (index: number, patch: Partial<LoggedSet>) => void
  onToggleDone: (index: number) => void
  onAddSet: () => void
  /** Drops the last set. Offered while that set is still unticked and it is not the only one. */
  onRemoveSet: () => void
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
export function ExerciseRow({ entry, units, onChangeSet, onToggleDone, onAddSet, onRemoveSet }: ExerciseRowProps) {
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
      <AccordionTrigger className="items-center gap-3 py-3.5 text-base font-normal hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0">
        <ExerciseThumb name={entry.name} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-tight">{entry.name}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {entry.sets.length} × {targetOf(entry)}
          </span>
        </span>
        <span className={cn('text-sm tabular-nums', allDone ? 'text-success' : 'text-muted-foreground')}>
          {doneCount}/{entry.sets.length}
        </span>
        {allDone && (
          <span className="flex" aria-label="All sets done">
            <Check className="size-5 text-success" aria-hidden />
          </span>
        )}
      </AccordionTrigger>
      <AccordionContent className="pb-4 text-base">
        {entry.hint && <p className="mb-3 text-sm text-muted-foreground">{entry.hint}</p>}
        <div className={cn('mb-1 grid gap-2 px-1 text-xs text-muted-foreground', cols)}>
          <span>Set</span>
          {weighted && <span className="text-center">Weight, {units}</span>}
          <span className="text-center">{timed ? 'Seconds' : 'Reps'}</span>
          <span />
        </div>
        <ol className="flex flex-col gap-2">
          {entry.sets.map((s, i) => {
            const prevWeight = lastFilled(entry.sets, i, 'weight')
            const prevReps = lastFilled(entry.sets, i, 'reps') ?? entry.repMin
            const prevSeconds = lastFilled(entry.sets, i, 'seconds') ?? entry.repMin
            return (
              <li key={i} className={cn('grid items-center gap-2', cols)}>
                <span className="pl-1 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                {weighted && (
                  <NumberField
                    label={`Set ${i + 1} weight`}
                    value={s.weight}
                    base={prevWeight}
                    onChange={(v) => onChangeSet(i, { weight: v })}
                    step={incrementFor(entry.muscle, units)}
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
        <div className="mt-2 flex gap-1">
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
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

/** Marks a set done, filling blanks from the nearest earlier set or the target. Shared by Today and History. */
export function completeSet(entry: WorkoutEntry, sets: LoggedSet[], index: number): LoggedSet[] {
  return sets.map((s, i) => {
    if (i !== index) return s
    const done = !s.done
    if (!done) return { ...s, done }
    if (entry.loadType === 'time') {
      return { ...s, seconds: s.seconds ?? lastFilled(sets, index, 'seconds') ?? entry.repMin, done }
    }
    const reps = s.reps ?? lastFilled(sets, index, 'reps') ?? entry.repMin
    if (entry.loadType === 'weight') return { ...s, weight: s.weight ?? lastFilled(sets, index, 'weight'), reps, done }
    return { ...s, reps, done }
  })
}
