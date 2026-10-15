import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DayIcon } from '#/components/app/day-mark'
import { ExerciseEditor, type ExerciseEditorActions } from '#/components/app/exercise-editor'
import { DayDialog, DaySection, PlanTitle } from '#/components/app/plan-view'
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
import { DEFAULT_SPLIT, planSourceInfo } from '#/lib/content'
import { DAY_LABEL } from '#/lib/day-blocks'
import { errorMessage } from '#/lib/format'
import { inDefaultOrder, templateExercises } from '#/lib/logic/default-order'
import { pageTitle } from '#/lib/page-title'
import { DAY_TYPES, type DayType, type Exercise, MAX_DAYS, type PlanDay, type Schedule } from '#/lib/types'
import { useContent } from '#/lib/use-content'
import {
  addDayFn,
  addExerciseFn,
  getPlanFn,
  moveDayFn,
  removeDayFn,
  removeExerciseFn,
  reorderExercisesFn,
  resetPlanFn,
  setDayWeekdayFn,
  swapExerciseFn,
  syncSessionFn,
  updateDayFn,
  updateExerciseFn,
} from '#/server/fns'

export const Route = createFileRoute('/_app/plan')({
  head: () => ({ meta: [{ title: pageTitle('Plan') }] }),
  loader: () => getPlanFn(),
  component: PlanPage,
})

const rules = [
  'Stop 1 to 3 reps short of failure. Take the last set of small lifts to 0 or 1 left.',
  'Rest 2 to 3 minutes on big lifts, 60 to 90 seconds on small ones.',
  'Hit the top of the rep range on every set, and the next session suggests the bump.',
  'Every 6 to 8 weeks, or after two stalled weeks, halve the sets for a week.',
  'Add 2 or 3 easy cardio sessions of 20 to 30 minutes. After lifting or on rest days.',
]

/** The editor's changes, saved to the server. The page reloads the plan when the editor says it saved. */
const EDITOR_ACTIONS: ExerciseEditorActions = {
  save: async (dayId, exerciseId, fields) => {
    if (exerciseId) await updateExerciseFn({ data: { dayId, exerciseId, patch: fields } })
    else await addExerciseFn({ data: { dayId, exercise: fields } })
  },
  remove: async (dayId, exerciseId) => {
    await removeExerciseFn({ data: { dayId, exerciseId } })
  },
  swap: async (dayId, exerciseId, alternate) => {
    await swapExerciseFn({ data: { dayId, exerciseId, name: alternate } })
  },
}

function PlanPage() {
  const { plan, settings, activeDayId } = Route.useLoaderData()
  const router = useRouter()
  /** The exercise being edited, or null for a new one on that day. */
  const [editing, setEditing] = useState<{ day: PlanDay; exercise: Exercise | null } | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [renaming, setRenaming] = useState<PlanDay | null>(null)
  const [removing, setRemoving] = useState<PlanDay | null>(null)
  const [busy, setBusy] = useState(false)
  /** The day of the session in progress, just changed: asks whether today follows. */
  const [changedToday, setChangedToday] = useState<PlanDay | null>(null)
  /** After a change to a day: when it is the day being trained, ask about today's session. */
  const afterChange = (day: PlanDay | undefined) => {
    if (day && day.id === activeDayId) setChangedToday(day)
  }
  const { splits } = useContent()
  const split = planSourceInfo(splits, settings.split, plan.days.length)
  const source = settings.split ?? DEFAULT_SPLIT
  /** The split's own days, for each day's default order. A plan of your own falls back to the day blocks. */
  const templateDays = source === 'custom' ? null : (splits.find((s) => s.id === source)?.days ?? null)
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

  async function reorderExercises(dayId: string, order: string[]) {
    try {
      await reorderExercisesFn({ data: { dayId, order } })
      await router.invalidate()
      afterChange(plan.days.find((d) => d.id === dayId))
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the new order.'))
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
      <PlanTitle split={split} dayCount={plan.days.length} schedule={schedule} />

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
            inProgress={day.id === activeDayId}
            schedule={schedule}
            position={i === 0 ? 'first' : i === plan.days.length - 1 ? 'last' : 'middle'}
            onlyDay={plan.days.length === 1}
            onEdit={(exercise) => setEditing({ day, exercise })}
            onAdd={() => setEditing({ day, exercise: null })}
            defaultOrder={inDefaultOrder(day.exercises, templateExercises(templateDays, day)).map((e) => e.id)}
            onReorder={(order) => reorderExercises(day.id, order)}
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
                <span>{DAY_LABEL[t]}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <DayDialog
        day={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (name, type) => {
          if (renaming) await updateDayFn({ data: { dayId: renaming.id, name, type } })
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
        <ul className="mt-3 space-y-2 text-muted-foreground">
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
        trainingAge={settings.trainingAge}
        actions={EDITOR_ACTIONS}
        onClose={() => setEditing(null)}
        onSaved={() => {
          afterChange(editing?.day)
          setEditing(null)
          router.invalidate()
        }}
      />
      <TodaySyncDialog day={changedToday} onClose={() => setChangedToday(null)} />
    </div>
  )
}

// ---------------------------------------------------------------- today's session

/**
 * Asked after the day of a session in progress changed. A session starts from a copy of its day, so it keeps the
 * day as it was unless the lifter asks: "Plan and today" brings it up to the plan, keeping every logged set (see
 * repo.syncSession), and says which started lifts stay although the plan dropped them.
 */
function TodaySyncDialog({ day, onClose }: { day: PlanDay | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  async function alsoToday() {
    setBusy(true)
    try {
      const { kept } = await syncSessionFn()
      toast.success(
        kept.length === 0
          ? "Today's session updated"
          : `Today's session updated. ${kept.join(', ')} ${kept.length === 1 ? 'stays: it has' : 'stay: they have'} sets logged.`,
      )
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, "Could not update today's session."))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={day !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{day?.name} is in progress</DialogTitle>
          <DialogDescription>
            Change today's session too? Sets you've logged stay as they are. Plan only starts the change next time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Plan only
          </Button>
          <Button onClick={() => void alsoToday()} disabled={busy}>
            Plan and today
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
