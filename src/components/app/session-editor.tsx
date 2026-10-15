import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DayIcon } from '#/components/app/day-mark'
import { EditorPanel, PanelFooter } from '#/components/app/editor-panel'
import { completeSet, ExerciseRow } from '#/components/app/exercise-row'
import { Accordion } from '#/components/ui/accordion'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { errorMessage, longDate, shortDate } from '#/lib/format'
import { EFFORT_LABEL, type Effort } from '#/lib/logic/effort'
import type { Steps } from '#/lib/logic/progression'
import { activeMinutes } from '#/lib/logic/session-time'
import { effectiveSets } from '#/lib/logic/stats'
import type { LoggedSet, Units, Workout, WorkoutEntry } from '#/lib/types'
import { deleteWorkoutFn, updateWorkoutFn } from '#/server/fns'

function minutesOf(w: Workout): number | null {
  if (!w.finishedAt) return null
  const m = activeMinutes(w, new Date(w.finishedAt))
  return m > 0 && m < 300 ? m : null
}

/** "Oct 11, 12 sets, 48 min, hard" */
export function sessionSummary(w: Workout): string {
  const sets = w.entries.reduce((n, e) => n + effectiveSets(e).length, 0)
  const parts = [shortDate(w.finishedAt ?? w.startedAt), `${sets} sets`]
  const mins = minutesOf(w)
  if (mins) parts.push(`${mins} min`)
  if (w.effort) parts.push(EFFORT_LABEL[w.effort as Effort].toLowerCase())
  return parts.join(', ')
}

/** One lift's sets as the editor leaves them. */
export interface SetChange {
  exerciseId: string
  sets: LoggedSet[]
}

interface EditorProps {
  workout: Workout | null
  units: Units
  steps?: Steps
  onClose: () => void
  onSaved: () => void | Promise<void>
  /**
   * Given, the session is a draft for an earlier day, not stored yet: Save hands the sets here instead of updating
   * a stored session, there is nothing to delete, and Tick all fills every set from its target.
   */
  log?: { onSave: (changes: SetChange[]) => Promise<void> }
}

/**
 * A finished session: fix a set, add or drop one, or remove the session. Opened from the Stats calendar. With `log`,
 * a session being written after the fact (see `PastSessionEditor`).
 */
export function SessionEditor({ workout, units, steps, onClose, onSaved, log }: EditorProps) {
  // Keep the last session while the panel animates closed, so the title does not blink away.
  const shown = useRef(workout)
  if (workout) shown.current = workout
  const current = workout ?? shown.current
  // The edits live here, above the panel: the panel swaps between a drawer and a dialog when the
  // viewport crosses 768px, which remounts its content, and a typed change must survive that.
  const [forId, setForId] = useState<string | null>(null)
  const [entries, setEntries] = useState<WorkoutEntry[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  if (workout && forId !== workout.id) {
    setForId(workout.id)
    setEntries(workout.entries)
    setOpenId(null)
  }
  return (
    <EditorPanel
      open={workout !== null}
      onClose={onClose}
      width="lg"
      title={
        current ? (
          <>
            <DayIcon type={current.dayType} className="size-6 rounded-md" />
            {current.dayName}
          </>
        ) : (
          ''
        )
      }
      description={
        current
          ? log
            ? longDate(current.startedAt)
            : `${sessionSummary(current)}${current.note ? `. ${current.note}` : ''}`
          : ''
      }
    >
      {workout && (
        <EditorBody
          key={workout.id}
          workout={workout}
          entries={entries}
          setEntries={setEntries}
          openId={openId}
          setOpenId={setOpenId}
          units={units}
          steps={steps}
          onClose={onClose}
          onSaved={onSaved}
          log={log}
        />
      )}
    </EditorPanel>
  )
}

function EditorBody({
  workout,
  entries,
  setEntries,
  openId,
  setOpenId,
  units,
  steps,
  onClose,
  onSaved,
  log,
}: EditorProps & {
  workout: Workout
  entries: WorkoutEntry[]
  setEntries: (update: (current: WorkoutEntry[]) => WorkoutEntry[]) => void
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const ticked = entries.some((e) => e.sets.some((s) => s.done))

  function updateSets(exerciseId: string, mutate: (sets: LoggedSet[]) => LoggedSet[]) {
    // From the latest state, so two quick changes both land.
    setEntries((current) => current.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: mutate(e.sets) } : e)))
  }

  /** Every set of every lift done, each filled from its target: the session went as planned. */
  function tickAll() {
    setEntries((current) =>
      current.map((e) => ({
        ...e,
        sets: e.sets.reduce((sets, s, i) => (s.done ? sets : completeSet(e, sets, i)), e.sets),
      })),
    )
  }

  async function save() {
    setBusy(true)
    try {
      const changes = entries.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets }))
      if (log) {
        await log.onSave(changes)
        await onSaved()
      } else {
        await updateWorkoutFn({ data: { workoutId: workout.id, changes } })
        // The page reloads its data before the toast, so what follows the toast sees the change.
        await onSaved()
        toast.success('Session updated')
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save.'))
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteWorkoutFn({ data: { workoutId: workout.id } })
      setDeleteOpen(false)
      await onSaved()
      toast.success('Session removed')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove it.'))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col">
      <Accordion
        type="single"
        collapsible
        value={openId ?? ''}
        onValueChange={(v) => setOpenId(v || null)}
        className="border-t px-4"
      >
        {entries.map((entry) => (
          <ExerciseRow
            key={entry.exerciseId}
            entry={entry}
            units={units}
            steps={steps}
            onChangeSet={(i, patch) =>
              updateSets(entry.exerciseId, (sets) => sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))
            }
            onToggleDone={(i) => updateSets(entry.exerciseId, (sets) => completeSet(entry, sets, i))}
            onAddSet={() =>
              updateSets(entry.exerciseId, (sets) => [...sets, { ...sets[sets.length - 1], done: false }])
            }
            onRemoveSet={() =>
              updateSets(entry.exerciseId, (sets) =>
                sets.length > 1 && !sets[sets.length - 1].done ? sets.slice(0, -1) : sets,
              )
            }
          />
        ))}
      </Accordion>

      <PanelFooter>
        {log ? (
          <Button variant="ghost" onClick={tickAll} disabled={busy}>
            Tick all
          </Button>
        ) : (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                Delete session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove this session?</DialogTitle>
                <DialogDescription>Its sets leave your stats. This cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                  Keep it
                </Button>
                <Button variant="destructive" onClick={remove} disabled={busy}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {/* A session with nothing ticked would hold nothing: logging waits for the first tick. */}
          <Button onClick={save} disabled={busy || (log !== undefined && !ticked)}>
            {log ? 'Log session' : 'Save changes'}
          </Button>
        </div>
      </PanelFooter>
    </div>
  )
}
