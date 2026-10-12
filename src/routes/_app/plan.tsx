import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DayIcon } from '#/components/app/day-mark'
import { EditorPanel, PanelFooter } from '#/components/app/editor-panel'
import { ExerciseThumb } from '#/components/app/exercise-thumb'
import { LibraryPicker } from '#/components/app/library-list'
import { NumberField } from '#/components/app/number-field'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '#/components/ui/item'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { planSourceInfo } from '#/lib/content'
import { DAY_LABEL } from '#/lib/day-blocks'
import { errorMessage } from '#/lib/format'
import { MUSCLE_BY_DAY } from '#/lib/logic/plan-sheet'
import { WEEK_ORDER, WEEKDAY_LONG, weekdayOf } from '#/lib/logic/schedule'
import { MUSCLE_LABEL, MUSCLES, plannedSetsFor } from '#/lib/logic/stats'
import { pageTitle } from '#/lib/page-title'
import { rowTap } from '#/lib/row-tap'
import {
  DAY_TYPES,
  type DayType,
  type Exercise,
  type LoadType,
  MAX_DAYS,
  MAX_EXERCISES_PER_DAY,
  type Muscle,
  type PlanDay,
  type Schedule,
  type Settings,
} from '#/lib/types'
import { useContent } from '#/lib/use-content'
import {
  addDayFn,
  addExerciseFn,
  getPlanFn,
  moveDayFn,
  removeDayFn,
  removeExerciseFn,
  resetPlanFn,
  setDayWeekdayFn,
  swapExerciseFn,
  updateDayFn,
  updateExerciseFn,
} from '#/server/fns'

export const Route = createFileRoute('/_app/plan')({
  head: () => ({ meta: [{ title: pageTitle('Plan') }] }),
  loader: () => getPlanFn(),
  component: PlanPage,
})

const LOAD_LABEL: Record<LoadType, string> = {
  weight: 'Weighted',
  bodyweight: 'Bodyweight',
  time: 'Timed hold',
}

function targetOf(e: Pick<Exercise, 'repMin' | 'repMax' | 'loadType'>): string {
  const range = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}-${e.repMax}`
  return e.loadType === 'time' ? `${range} s` : range
}

const rules = [
  'Stop 1 to 3 reps short of failure. Take the last set of small lifts to 0 or 1 left.',
  'Rest 2 to 3 minutes on big lifts, 60 to 90 seconds on small ones.',
  'Hit the top of the rep range on every set, and the next session suggests the bump.',
  'Every 6 to 8 weeks, or after two stalled weeks, halve the sets for a week.',
  'Add 2 or 3 easy cardio sessions of 20 to 30 minutes. After lifting or on rest days.',
]

function PlanPage() {
  const { plan, settings } = Route.useLoaderData()
  const router = useRouter()
  /** The exercise being edited, or null for a new one on that day. */
  const [editing, setEditing] = useState<{ day: PlanDay; exercise: Exercise | null } | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [renaming, setRenaming] = useState<PlanDay | null>(null)
  const [removing, setRemoving] = useState<PlanDay | null>(null)
  const [busy, setBusy] = useState(false)
  const { splits } = useContent()
  const split = planSourceInfo(splits, settings.split, plan.days.length)
  const schedule: Schedule = settings.schedule ?? 'rolling'

  async function addDay(type: DayType) {
    setBusy(true)
    try {
      const next = await addDayFn({ data: { type } })
      setAddOpen(false)
      await router.invalidate()
      setOpenDay(next.days[next.days.length - 1]?.id ?? null)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the day.'))
    } finally {
      setBusy(false)
    }
  }

  async function moveDay(dayId: string, direction: 'up' | 'down') {
    try {
      await moveDayFn({ data: { dayId, direction } })
      await router.invalidate()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not move the day.'))
    }
  }

  async function removeDay(day: PlanDay) {
    setBusy(true)
    try {
      await removeDayFn({ data: { dayId: day.id } })
      setRemoving(null)
      toast.success(`${day.name} removed`)
      await router.invalidate()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove the day.'))
    } finally {
      setBusy(false)
    }
  }

  async function changeWeekday(dayId: string, weekday: number) {
    try {
      await setDayWeekdayFn({ data: { dayId, weekday } })
      await router.invalidate()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not move the day.'))
    }
  }

  return (
    <div>
      <h1 className="font-condensed text-4xl font-semibold leading-none">Plan</h1>
      <p className="mt-2 text-muted-foreground">
        {/* A template whose name already says its days ("Push / Pull / Legs, 3 days") is not told twice. */}
        {/\d+ days$/.test(split.name) && split.days === plan.days.length
          ? split.name
          : `${split.name}, ${plan.days.length} ${plan.days.length === 1 ? 'day' : 'days'}`}
        {schedule === 'weekday' ? ' by weekday' : ''}
      </p>

      <Accordion
        type="single"
        collapsible
        value={openDay ?? ''}
        onValueChange={(v) => setOpenDay(v || null)}
        className="mt-6 border-t"
      >
        {plan.days.map((day, i) => (
          <DaySection
            key={day.id}
            day={day}
            settings={settings}
            schedule={schedule}
            position={i === 0 ? 'first' : i === plan.days.length - 1 ? 'last' : 'middle'}
            onlyDay={plan.days.length === 1}
            onEdit={(exercise) => setEditing({ day, exercise })}
            onAdd={() => setEditing({ day, exercise: null })}
            onWeekday={(weekday) => changeWeekday(day.id, weekday)}
            onRename={() => setRenaming(day)}
            onMove={(direction) => moveDay(day.id, direction)}
            onRemove={() => setRemoving(day)}
          />
        ))}
      </Accordion>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 text-muted-foreground"
        onClick={() => setAddOpen(true)}
        disabled={plan.days.length >= MAX_DAYS}
      >
        <Plus aria-hidden />
        Add a day
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>What kind of day?</DialogTitle>
            <DialogDescription>It starts with five lifts, yours to edit.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {DAY_TYPES.map((t) => (
              <Button
                key={t}
                variant="outline"
                className="h-auto flex-col gap-2 py-3"
                onClick={() => addDay(t)}
                disabled={busy}
              >
                <DayIcon type={t} className="size-9 rounded-lg" />
                <span className="text-sm">{DAY_LABEL[t]}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <DayDialog
        day={renaming}
        onClose={() => setRenaming(null)}
        onSaved={async () => {
          setRenaming(null)
          await router.invalidate()
        }}
      />

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>Its exercises go with it. Logged sessions stay.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => removing && removeDay(removing)} disabled={busy}>
              Remove day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="mt-10">
        <h2 className="font-condensed text-2xl font-semibold leading-none">Rules</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {rules.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/plan/import">Bring your own plan</Link>
        </Button>
        {!split.custom && <ResetPlanButton template={split.name} onReset={() => router.invalidate()} />}
      </div>

      <ExerciseEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          router.invalidate()
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------- day section

interface DayProps {
  day: PlanDay
  settings: Settings
  schedule: Schedule
  position: 'first' | 'middle' | 'last'
  onlyDay: boolean
  onEdit: (exercise: Exercise) => void
  onAdd: () => void
  onWeekday: (weekday: number) => void
  onRename: () => void
  onMove: (direction: 'up' | 'down') => void
  onRemove: () => void
}

function DaySection({
  day,
  settings,
  schedule,
  position,
  onlyDay,
  onEdit,
  onAdd,
  onWeekday,
  onRename,
  onMove,
  onRemove,
}: DayProps) {
  const full = day.exercises.length >= MAX_EXERCISES_PER_DAY
  const sets = day.exercises.reduce((n, e) => n + plannedSetsFor(e.sets, settings.trainingAge), 0)
  const onWeekdays = schedule === 'weekday' && day.weekday !== undefined
  return (
    <AccordionItem value={day.id}>
      <AccordionTrigger className="items-center gap-3 py-4 text-base font-normal hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0">
        <DayIcon type={day.type} className="size-10" />
        <span className="flex-1">
          <span className="block font-condensed text-2xl font-semibold leading-none">{day.name}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {day.exercises.length} exercises, {sets} sets
            {onWeekdays ? `, ${weekdayOf(day)}s` : ''}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-3 text-base">
        <div className="mb-2 flex items-center justify-end px-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={`${day.name} options`}>
                <MoreHorizontal aria-hidden />
                Day
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={onRename}>
                <Pencil aria-hidden />
                Rename or change kind
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove('up')} disabled={position === 'first'}>
                <ArrowUp aria-hidden />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove('down')} disabled={position === 'last'}>
                <ArrowDown aria-hidden />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove} disabled={onlyDay}>
                <Trash2 aria-hidden />
                Remove day
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {schedule === 'weekday' && (
          <div className="mb-3 flex items-center gap-3 px-2">
            <FieldLabel htmlFor={`weekday-${day.id}`} className="text-muted-foreground">
              On
            </FieldLabel>
            <Select value={String(day.weekday ?? 1)} onValueChange={(v) => onWeekday(Number(v))}>
              <SelectTrigger id={`weekday-${day.id}`} size="sm" className="w-36" aria-label={`${day.name} weekday`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_ORDER.map((wd) => (
                  <SelectItem key={wd} value={String(wd)}>
                    {WEEKDAY_LONG[wd]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <ItemGroup>
          {day.exercises.map((ex, i) => (
            <div key={ex.id}>
              {i > 0 && <ItemSeparator />}
              <Item size="sm" className="cursor-pointer px-2" onClick={rowTap(() => onEdit(ex)).onClick}>
                <ItemMedia variant="image">
                  <ExerciseThumb name={ex.name} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-base font-normal">{ex.name}</ItemTitle>
                  {ex.note && <ItemDescription>{ex.note}</ItemDescription>}
                </ItemContent>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {plannedSetsFor(ex.sets, settings.trainingAge)} × {targetOf(ex)}
                </span>
                <ItemActions>
                  <Button variant="ghost" size="sm" aria-label={`Edit ${ex.name}`} onClick={() => onEdit(ex)}>
                    <Pencil aria-hidden />
                    Edit
                  </Button>
                </ItemActions>
              </Item>
            </div>
          ))}
        </ItemGroup>
        <div className="mt-2 flex items-center justify-between gap-3 px-2">
          <span className="text-sm text-muted-foreground">
            {day.exercises.length} of {MAX_EXERCISES_PER_DAY} exercises
          </span>
          <Button variant="ghost" size="sm" aria-label={`Add exercise to ${day.name}`} onClick={onAdd} disabled={full}>
            <Plus aria-hidden />
            Add exercise
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

// ---------------------------------------------------------------- editor

interface EditorProps {
  editing: { day: PlanDay; exercise: Exercise | null } | null
  onClose: () => void
  onSaved: () => void
}

function ExerciseEditor({ editing, onClose, onSaved }: EditorProps) {
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
  onClose: () => void
  onSaved: () => void
}

function EditorForm({ day, exercise, onClose, onSaved }: FormProps) {
  const { settings } = Route.useLoaderData()
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
        await updateExerciseFn({ data: { dayId, exerciseId: exercise.id, patch: fields } })
        toast.success('Saved')
      } else {
        await addExerciseFn({ data: { dayId, exercise: { ...fields, note: fields.note || undefined } } })
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
      await removeExerciseFn({ data: { dayId, exerciseId: exercise.id } })
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
      await swapExerciseFn({ data: { dayId, exerciseId: exercise.id, name: alt } })
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
    <form id="exercise-form" onSubmit={save} className="flex flex-col">
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
          <Input
            id="ex-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            {settings.trainingAge === 'under1' && (sets ?? 0) > plannedSetsFor(sets ?? 0, 'under1') && (
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

// ---------------------------------------------------------------- account

/** Phones have no sidebar, so the sign-out lives here as well. */
// ---------------------------------------------------------------- day name and kind

function DayDialog({
  day,
  onClose,
  onSaved,
}: {
  day: PlanDay | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  return (
    <Dialog open={day !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {day && <DayForm key={day.id} day={day} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function DayForm({ day, onClose, onSaved }: { day: PlanDay; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(day.name)
  const [type, setType] = useState<DayType>(day.type)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await updateDayFn({ data: { dayId: day.id, name: name.trim(), type } })
      await onSaved()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the day.'))
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <DialogHeader>
        <DialogTitle>{day.name}</DialogTitle>
        <DialogDescription className="sr-only">Rename the day or change its kind.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="py-4">
        <Field>
          <FieldLabel htmlFor="day-name">Name</FieldLabel>
          <Input id="day-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="day-type">Kind</FieldLabel>
          <Select value={type} onValueChange={(v) => setType(v as DayType)}>
            <SelectTrigger id="day-type" className="w-full" aria-label="Kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  <DayIcon type={t} className="size-5 rounded" />
                  {DAY_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !name.trim()}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------- reset

function ResetPlanButton({ template, onReset }: { template: string; onReset: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  async function reset() {
    setBusy(true)
    try {
      await resetPlanFn()
      toast.success('Plan reset')
      setOpen(false)
      onReset()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reset.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground">
          Reset to the original plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset the plan?</DialogTitle>
          <DialogDescription>
            Every edit and swap goes back to the {template} template. Logged workouts stay.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep my edits
          </Button>
          <Button variant="destructive" onClick={reset} disabled={busy}>
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
