import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { errorMessage } from '#/lib/format'
import { MUSCLE_BY_DAY } from '#/lib/logic/plan-sheet'
import { MUSCLE_LABEL, MUSCLES, plannedSetsFor } from '#/lib/logic/stats'
import type { Exercise, LoadType, Muscle, PlanDay, TrainingAge } from '#/lib/types'
import { EditorPanel, PanelFooter } from './editor-panel'
import { ExerciseNameField } from './exercise-name-field'
import { LibraryPicker } from './library-list'
import { NumberField } from './number-field'

/*
 * The exercise editor, shared by the Plan page and the demo on How it works. Where its changes go is passed in as
 * `actions`: the server on the Plan page, the made-up plan in the demo.
 */

const LOAD_LABEL: Record<LoadType, string> = {
  weight: 'Weighted',
  bodyweight: 'Bodyweight',
  time: 'Timed hold',
}

/** Where the editor's changes go: the server on the Plan page, the made-up plan in the demo on How it works. */
export interface ExerciseEditorActions {
  /** Saves the fields onto the exercise, or, with no exercise id, adds them as a new one at the end of the day. */
  save: (dayId: string, exerciseId: string | null, fields: Omit<Exercise, 'id'>) => Promise<void>
  remove: (dayId: string, exerciseId: string) => Promise<void>
  /** Swaps the exercise for one of its alternates, by name. */
  swap: (dayId: string, exerciseId: string, alternate: string) => Promise<void>
}

interface EditorProps {
  editing: { day: PlanDay; exercise: Exercise | null } | null
  trainingAge: TrainingAge
  actions: ExerciseEditorActions
  onClose: () => void
  onSaved: () => void
}

/** The panel that edits one exercise of a plan day, or adds one: name, sets, range, type, muscle, note, alternates. */
export function ExerciseEditor({ editing, trainingAge, actions, onClose, onSaved }: EditorProps) {
  // Keep the last exercise while the panel animates closed, so the title does not blink away.
  const shown = useRef(editing)
  if (editing) shown.current = editing
  const current = editing ?? shown.current
  const adding = current !== null && current.exercise === null
  return (
    <EditorPanel
      open={editing !== null}
      onClose={onClose}
      title={adding ? 'New exercise' : (current?.exercise?.name ?? '')}
      description={adding ? `Goes to the end of ${current?.day.name ?? 'the day'}.` : ''}
    >
      {editing && (
        <EditorForm
          key={`${editing.day.id}:${editing.exercise?.id ?? 'new'}`}
          day={editing.day}
          exercise={editing.exercise}
          trainingAge={trainingAge}
          actions={actions}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </EditorPanel>
  )
}

interface FormProps {
  day: PlanDay
  /** Null means a new exercise for this day. */
  exercise: Exercise | null
  trainingAge: TrainingAge
  actions: ExerciseEditorActions
  onClose: () => void
  onSaved: () => void
}

function EditorForm({ day, exercise, trainingAge, actions, onClose, onSaved }: FormProps) {
  const dayId = day.id
  const [name, setName] = useState(exercise?.name ?? '')
  const [sets, setSets] = useState<number | undefined>(exercise?.sets ?? 3)
  const [repMin, setRepMin] = useState<number | undefined>(exercise?.repMin ?? 8)
  const [repMax, setRepMax] = useState<number | undefined>(exercise?.repMax ?? 12)
  const [loadType, setLoadType] = useState<LoadType>(exercise?.loadType ?? 'weight')
  const [muscle, setMuscle] = useState<Muscle>(exercise?.muscle ?? MUSCLE_BY_DAY[day.type])
  const [note, setNote] = useState(exercise?.note ?? '')
  const [alternates, setAlternates] = useState<string[]>(exercise?.alternates ?? [])
  const [newAlternate, setNewAlternate] = useState('')
  const [busy, setBusy] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Give the exercise a name.')
    if (!sets || !repMin || !repMax) return toast.error('Sets and range need a number.')
    if (repMax < repMin) return toast.error('The top of the range must be at least the bottom.')
    setBusy(true)
    try {
      const fields = { name: name.trim(), sets, repMin, repMax, loadType, muscle, note: note.trim(), alternates }
      if (exercise) {
        await actions.save(dayId, exercise.id, fields)
        toast.success('Saved')
      } else {
        await actions.save(dayId, null, { ...fields, note: fields.note || undefined })
        toast.success('Added to the day')
      }
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save.'))
      setBusy(false)
    }
  }

  async function remove() {
    if (!exercise) return
    setBusy(true)
    try {
      await actions.remove(dayId, exercise.id)
      toast.success('Removed from the day')
      setRemoveOpen(false)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove it.'))
      setBusy(false)
    }
  }

  async function swapToAlternate(alt: string) {
    if (!exercise) return
    setBusy(true)
    try {
      await actions.swap(dayId, exercise.id, alt)
      toast.success(`Switched to ${alt}`)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not switch.'))
      setBusy(false)
    }
  }

  function addAlternate() {
    const v = newAlternate.trim()
    if (!v || alternates.includes(v)) return
    setAlternates([...alternates, v])
    setNewAlternate('')
  }

  const unit = loadType === 'time' ? 'seconds' : 'reps'

  return (
    <form id="exercise-form" onSubmit={save} className="flex flex-col pb-4 md:pb-0">
      <FieldGroup className="gap-6 px-4">
        <Field>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="ex-name">Name</FieldLabel>
            <LibraryPicker
              onPick={(lib) => {
                setName(lib.name)
                setMuscle(lib.muscle)
                setLoadType(lib.loadType)
              }}
            />
          </div>
          <ExerciseNameField
            id="ex-name"
            value={name}
            onChange={setName}
            onPick={(lib) => {
              setMuscle(lib.muscle)
              setLoadType(lib.loadType)
            }}
            placeholder="Barbell Bench Press"
            required
            maxLength={80}
          />
        </Field>

        {/* Two columns at every width: a three-up row inside the dialog squeezes the numbers to one digit. */}
        <div className="grid grid-cols-2 gap-3">
          <Field className="col-span-2">
            <FieldLabel>Sets</FieldLabel>
            <NumberField label="Sets" value={sets} onChange={setSets} step={1} min={1} max={10} inputMode="numeric" />
            {/* Under a year, the plan and the logger cap each exercise: say so where the number is typed. */}
            {trainingAge === 'under1' && (sets ?? 0) > plannedSetsFor(sets ?? 0, 'under1') && (
              <FieldDescription>
                Capped at {plannedSetsFor(sets ?? 0, 'under1')} a session while under a year.
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel>Low, {unit}</FieldLabel>
            <NumberField
              label={`Low ${unit}`}
              value={repMin}
              onChange={setRepMin}
              step={1}
              min={1}
              inputMode="numeric"
            />
          </Field>
          <Field>
            <FieldLabel>High, {unit}</FieldLabel>
            <NumberField
              label={`High ${unit}`}
              value={repMax}
              onChange={setRepMax}
              step={1}
              min={1}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="ex-type">Type</FieldLabel>
            <Select value={loadType} onValueChange={(v) => setLoadType(v as LoadType)}>
              <SelectTrigger id="ex-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LOAD_LABEL) as LoadType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {LOAD_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ex-muscle">Muscle</FieldLabel>
            <Select value={muscle} onValueChange={(v) => setMuscle(v as Muscle)}>
              <SelectTrigger id="ex-muscle" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSCLES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MUSCLE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="ex-note">Note</FieldLabel>
          <Textarea
            id="ex-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Cues, depth, tempo"
          />
        </Field>

        <Field>
          <FieldLabel>Alternates</FieldLabel>
          {alternates.length === 0 && <FieldDescription>None yet. Add one below.</FieldDescription>}
          <ul className="flex flex-col gap-1">
            {alternates.map((alt) => (
              <li key={alt} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{alt}</span>
                {exercise && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => swapToAlternate(alt)}
                  >
                    Use this
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${alt}`}
                  onClick={() => setAlternates(alternates.filter((a) => a !== alt))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              value={newAlternate}
              onChange={(e) => setNewAlternate(e.target.value)}
              placeholder="Add an alternate"
              maxLength={80}
              aria-label="New alternate"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAlternate()
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addAlternate}>
              Add
            </Button>
          </div>
        </Field>
      </FieldGroup>

      <PanelFooter>
        {exercise && (
          <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                Remove from day
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Remove {exercise.name} from {day.name}?
                </DialogTitle>
                <DialogDescription>
                  It leaves the plan from the next workout on. Sessions already logged keep it.
                  {day.exercises.length <= 1 ? ' A day needs at least one exercise, so add another first.' : ''}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setRemoveOpen(false)}>
                  Keep it
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={remove}
                  disabled={busy || day.exercises.length <= 1}
                >
                  Remove
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {/* The footer sits outside the form in the DOM; `form` ties the button back to it. */}
          <Button type="submit" form="exercise-form" disabled={busy}>
            {exercise ? 'Save changes' : 'Add to day'}
          </Button>
        </div>
      </PanelFooter>
    </form>
  )
}
