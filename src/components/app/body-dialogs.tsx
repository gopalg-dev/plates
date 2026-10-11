import { Pencil, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { errorMessage, longDate } from '#/lib/format'
import { dayKey } from '#/lib/logic/stats'
import type { BodyweightLog, MeasurementLog, Units } from '#/lib/types'
import {
  deleteBodyweightFn,
  deleteMeasurementFn,
  logBodyweightFn,
  logMeasurementFn,
  updateBodyweightFn,
  updateMeasurementFn,
} from '#/server/fns'
import { DatePicker } from './date-picker'
import { NumberField } from './number-field'

type Variant = 'outline' | 'default' | 'secondary'

function fail(err: unknown) {
  toast.error(errorMessage(err, 'Could not save.'))
}

/** The instant stored for a log on `day`: right now for today, midday for an earlier day. */
function instantFor(day: string): string {
  return day === dayKey(new Date()) ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString()
}

/** Which day a log lands on. Today by default; an earlier day for an entry that was missed. */
function DateField({ id, value, onChange }: { id: string; value: string; onChange: (day: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Date</FieldLabel>
      <DatePicker id={id} value={value} onChange={onChange} />
    </Field>
  )
}

function futureDay(day: string): boolean {
  return day > dayKey(new Date())
}

// ---------------------------------------------------------------- bodyweight

interface BodyweightProps {
  units: Units
  onLogged: () => void
  variant?: Variant
}

export function LogBodyweightDialog({ units, onLogged, variant = 'outline' }: BodyweightProps) {
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState<number | undefined>(undefined)
  const [day, setDay] = useState(() => dayKey(new Date()))
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!weight) return
    if (futureDay(day)) return toast.error('That day has not happened yet.')
    setBusy(true)
    try {
      const at = instantFor(day)
      const today = day === dayKey(new Date())
      const res = await logBodyweightFn({ data: { weight, day, at } })
      toast.success(
        res.replaced
          ? today
            ? "Replaced today's weigh-in"
            : `Replaced the weigh-in for ${longDate(at)}`
          : today
            ? 'Bodyweight saved'
            : `Bodyweight saved for ${longDate(at)}`,
      )
      setWeight(undefined)
      setDay(dayKey(new Date()))
      setOpen(false)
      onLogged()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>Log bodyweight</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Log bodyweight</DialogTitle>
            <DialogDescription className="sr-only">The weight and the day it was taken.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-5 py-5">
            <NumberField
              label={`Bodyweight in ${units}`}
              size="lg"
              value={weight}
              onChange={setWeight}
              step={units === 'kg' ? 0.5 : 1}
              inputMode="decimal"
              placeholder={units === 'kg' ? '70' : '155'}
              autoFocus
            />
            <DateField id="bw-day" value={day} onChange={setDay} />
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={busy || !weight}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- one weigh-in

interface WeighInProps {
  /** The entry picked on the chart. Null keeps the dialog closed. */
  log: BodyweightLog | null
  units: Units
  onClose: () => void
  onChanged: () => void
}

/** Edit or remove one weigh-in. Opens when a point on the bodyweight chart is tapped. */
export function WeighInDialog({ log, units, onClose, onChanged }: WeighInProps) {
  return (
    <Dialog open={log !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{log && <WeighInForm key={log.id} log={log} units={units} onChanged={onChanged} />}</DialogContent>
    </Dialog>
  )
}

function WeighInForm({ log, units, onChanged }: { log: BodyweightLog; units: Units; onChanged: () => void }) {
  const [weight, setWeight] = useState<number | undefined>(log.weight)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!weight) return
    setBusy(true)
    try {
      await updateBodyweightFn({ data: { id: log.id, weight } })
      toast.success('Bodyweight updated')
      onChanged()
    } catch (err) {
      fail(err)
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteBodyweightFn({ data: { id: log.id } })
      toast.success('Weigh-in removed')
      onChanged()
    } catch (err) {
      fail(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      <DialogHeader>
        <DialogTitle>Weigh-in, {longDate(log.date)}</DialogTitle>
        <DialogDescription>Fix the number or remove the entry. The date stays.</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <NumberField
          label={`Bodyweight in ${units}`}
          size="lg"
          value={weight}
          onChange={setWeight}
          step={units === 'kg' ? 0.5 : 1}
          inputMode="decimal"
          autoFocus
        />
      </div>
      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={remove}
          disabled={busy}
        >
          Remove
        </Button>
        <Button type="submit" disabled={busy || !weight}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------- measurements

interface MeasurementProps {
  lengthUnit: string
  onLogged: () => void
  variant?: Variant
  log?: MeasurementLog
  trigger?: ReactNode
}

export function LogMeasurementsDialog({ lengthUnit, onLogged, variant = 'outline', log, trigger }: MeasurementProps) {
  const [open, setOpen] = useState(false)
  const [arm, setArm] = useState<number | undefined>(log?.arm)
  const [chest, setChest] = useState<number | undefined>(log?.chest)
  const [waist, setWaist] = useState<number | undefined>(log?.waist)
  const [day, setDay] = useState(() => dayKey(new Date()))
  const [busy, setBusy] = useState(false)
  const step = lengthUnit === 'cm' ? 0.5 : 0.25
  const empty = !arm && !chest && !waist
  const editing = log !== undefined

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (empty) return
    if (!editing && futureDay(day)) return toast.error('That day has not happened yet.')
    setBusy(true)
    try {
      if (editing) {
        await updateMeasurementFn({ data: { id: log.id, arm, chest, waist } })
        toast.success('Measurements updated')
      } else {
        const at = instantFor(day)
        const today = day === dayKey(new Date())
        const res = await logMeasurementFn({ data: { arm, chest, waist, day, at } })
        toast.success(
          res.replaced
            ? today
              ? "Updated today's tape entry"
              : `Updated the tape entry for ${longDate(at)}`
            : today
              ? 'Measurements saved'
              : `Measurements saved for ${longDate(at)}`,
        )
        setArm(undefined)
        setChest(undefined)
        setWaist(undefined)
        setDay(dayKey(new Date()))
      }
      setOpen(false)
      onLogged()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant={variant}>Log measurements</Button>}</DialogTrigger>
      <DialogContent>
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit measurements' : 'Log measurements'}</DialogTitle>
            <DialogDescription className="sr-only">Arm, chest and waist, and the day.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-5 py-5">
            <Field>
              <FieldLabel>Arm, {lengthUnit}</FieldLabel>
              <NumberField
                label={`Arm in ${lengthUnit}`}
                value={arm}
                onChange={setArm}
                step={step}
                inputMode="decimal"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel>Chest, {lengthUnit}</FieldLabel>
              <NumberField
                label={`Chest in ${lengthUnit}`}
                value={chest}
                onChange={setChest}
                step={step}
                inputMode="decimal"
              />
            </Field>
            <Field>
              <FieldLabel>Waist, {lengthUnit}</FieldLabel>
              <NumberField
                label={`Waist in ${lengthUnit}`}
                value={waist}
                onChange={setWaist}
                step={step}
                inputMode="decimal"
              />
            </Field>
            {!editing && <DateField id="tape-day" value={day} onChange={setDay} />}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={busy || empty}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteMeasurementButton({ log, onDeleted }: { log: MeasurementLog; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  async function remove() {
    setBusy(true)
    try {
      await deleteMeasurementFn({ data: { id: log.id } })
      toast.success('Tape entry removed')
      onDeleted()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      aria-label="Delete tape entry"
      onClick={remove}
      disabled={busy}
    >
      <X aria-hidden />
    </Button>
  )
}

export function EditMeasurementButton(props: Omit<MeasurementProps, 'trigger' | 'variant'> & { log: MeasurementLog }) {
  return (
    <LogMeasurementsDialog
      {...props}
      trigger={
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Edit tape entry">
          <Pencil aria-hidden />
        </Button>
      }
    />
  )
}
