import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronsUpDown,
  Hourglass,
  LayoutGrid,
  Scale,
  Trash2,
  TrendingUp,
  UserRound,
  UserX,
  Weight,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ExportButtons } from '#/components/app/export-buttons'
import { SectionHeading } from '#/components/app/section-heading'
import { ProgressionPicker } from '#/components/app/progression-picker'
import { DEFAULT_OWN_DAYS, OWN_SPLIT, SplitPicker } from '#/components/app/split-picker'
import { WeekShape } from '#/components/app/week-shape'
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
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { buildSplitFrom, planSourceInfo, splitInfoOf } from '#/lib/content'
import { useContent } from '#/lib/use-content'
import { cn } from '#/lib/utils'
import { PROGRESSION_LABEL, progressionOf } from '#/lib/logic/progression'
import { GOAL_DONE, GOAL_OPTIONS } from '#/lib/logic/goal'
import type { DayType, Goal, Schedule, SplitId, TrainingAge, Units } from '#/lib/types'
import { authClient } from '#/lib/auth-client'
import {
  applySplitFn,
  createCustomPlanFn,
  deleteAccountFn,
  getPlanSlotsFn,
  getSettingsFn,
  saveSettingsFn,
  setScheduleFn,
  startFreshFn,
} from '#/server/fns'
import { pageTitle } from '#/lib/page-title'
import { errorMessage } from '#/lib/format'

export const Route = createFileRoute('/_app/settings')({
  head: () => ({ meta: [{ title: pageTitle('Settings') }] }),
  loader: async () => {
    const [settings, slots] = await Promise.all([getSettingsFn(), getPlanSlotsFn()])
    return { settings, slots }
  },
  component: SettingsPage,
})

const ageOptions: { value: TrainingAge; title: string; detail: string }[] = [
  { value: 'under1', title: 'Under a year', detail: 'Every 4-set lift becomes 3 sets while you build the base.' },
  { value: 'over1', title: 'A year or more', detail: 'The full plan, 4 sets on the big lifts.' },
]

function SettingsPage() {
  const { settings, slots } = Route.useLoaderData()
  const ownPlan = slots.find((s) => s.split === OWN_SPLIT)
  const [ownMode, setOwnMode] = useState<'keep' | 'build'>(ownPlan ? 'keep' : 'build')
  const router = useRouter()
  const { user } = Route.useRouteContext()
  const { splits } = useContent()
  const split = planSourceInfo(splits, settings.split, 0)
  /** The template the plan is on, or "Your own" for a custom plan. */
  const currentSplit: SplitId = split.custom ? OWN_SPLIT : split.id
  const [pickedSplit, setPickedSplit] = useState<SplitId | null>(null)
  const [ownDays, setOwnDays] = useState<DayType[]>(DEFAULT_OWN_DAYS)
  const [splitOpen, setSplitOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const schedule: Schedule = settings.schedule ?? 'rolling'

  async function switchSplit() {
    const keeping = pickedSplit === OWN_SPLIT && ownPlan !== undefined && ownMode === 'keep'
    if (!pickedSplit || (pickedSplit === currentSplit && (pickedSplit !== OWN_SPLIT || keeping))) return
    setSwitching(true)
    try {
      if (keeping) {
        await applySplitFn({ data: { split: OWN_SPLIT } })
        toast.success('Back on your own plan')
      } else if (pickedSplit === OWN_SPLIT) {
        await createCustomPlanFn({ data: { types: ownDays } })
        toast.success(`Now on your own plan, ${ownDays.length} days`)
      } else {
        await applySplitFn({ data: { split: pickedSplit } })
        toast.success(`Now on ${splitInfoOf(splits, pickedSplit).name}`)
      }
      setPickedSplit(null)
      setSplitOpen(false)
      await router.invalidate()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not switch the split.'))
    } finally {
      setSwitching(false)
    }
  }

  async function save(patch: Parameters<typeof saveSettingsFn>[0]['data'], done = 'Saved') {
    try {
      await saveSettingsFn({ data: patch })
      toast.success(done)
      await router.invalidate()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save.'))
    }
  }

  async function changeSchedule(next: Schedule) {
    if (next === schedule) return
    try {
      await setScheduleFn({ data: { schedule: next } })
      toast.success(next === 'weekday' ? 'Each day is on its weekday now' : 'Back to the rolling order')
      await router.invalidate()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the schedule.'))
    }
  }

  return (
    <div>
      <h1 className="font-condensed text-4xl font-semibold leading-none">Settings</h1>

      <div className="mt-8 flex flex-col gap-10">
        <section aria-labelledby="units-h">
          <SectionHeading id="units-h" icon={Weight}>
            Units
          </SectionHeading>
          <ToggleGroup
            type="single"
            variant="outline"
            value={settings.units}
            onValueChange={(v) => v && v !== settings.units && save({ units: v as Units }, `Lifting in ${v}`)}
            className="mt-3 w-full max-w-xs"
            aria-label="Units"
          >
            <ToggleGroupItem value="kg" className="h-12 flex-1 text-base">
              Kilograms
            </ToggleGroupItem>
            <ToggleGroupItem value="lb" className="h-12 flex-1 text-base">
              Pounds
            </ToggleGroupItem>
          </ToggleGroup>
        </section>

        <section aria-labelledby="age-h">
          <SectionHeading id="age-h" icon={Hourglass}>
            Training age
          </SectionHeading>
          <RadioGroup
            value={settings.trainingAge}
            onValueChange={(v) => v !== settings.trainingAge && save({ trainingAge: v as TrainingAge })}
            className="mt-3 gap-3"
          >
            {ageOptions.map((o) => (
              <Label
                key={o.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-data-[state=checked]:border-foreground"
              >
                <RadioGroupItem value={o.value} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{o.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{o.detail}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </section>

        <section aria-labelledby="goal-h">
          <SectionHeading id="goal-h" icon={Scale}>
            Bodyweight
          </SectionHeading>
          <ToggleGroup
            type="single"
            variant="outline"
            value={settings.goal ?? 'hold'}
            onValueChange={(v) =>
              v && v !== (settings.goal ?? 'hold') && save({ goal: v as Goal }, GOAL_DONE[v as Goal])
            }
            className="mt-3 w-full max-w-xs"
            aria-label="Bodyweight goal"
          >
            {GOAL_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} className="h-12 flex-1 text-base">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>

        <section aria-labelledby="progression-h">
          <SectionHeading id="progression-h" icon={TrendingUp}>
            Progression
          </SectionHeading>
          <ProgressionPicker
            value={progressionOf(settings)}
            onChange={(v) =>
              v !== progressionOf(settings) && save({ progression: v }, `Progression: ${PROGRESSION_LABEL[v]}`)
            }
            className="mt-3"
          />
        </section>

        <section aria-labelledby="schedule-h">
          <SectionHeading id="schedule-h" icon={CalendarDays}>
            Schedule
          </SectionHeading>
          <ToggleGroup
            type="single"
            variant="outline"
            value={schedule}
            onValueChange={(v) => v && changeSchedule(v as Schedule)}
            className="mt-3 w-full max-w-xs"
            aria-label="Schedule"
          >
            <ToggleGroupItem value="rolling" className="h-12 flex-1 text-base">
              Rolling
            </ToggleGroupItem>
            <ToggleGroupItem value="weekday" className="h-12 flex-1 text-base">
              By weekday
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="mt-2 text-sm text-muted-foreground">
            {schedule === 'weekday'
              ? 'Each day sits on a fixed weekday. The other days are rest days.'
              : 'The next day comes after the last one you finished, whatever the date.'}
          </p>
        </section>

        <section id="split" aria-labelledby="split-h">
          <SectionHeading id="split-h" icon={LayoutGrid}>
            Split
          </SectionHeading>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-medium">{split.name}</p>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`Change split, on ${split.name}`}
              onClick={() => setSplitOpen(true)}
            >
              <ChevronsUpDown aria-hidden />
            </Button>
          </div>
          <div className="mt-2 rounded-lg border px-4 py-3 text-sm">
            {!split.custom && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Days</span>
                <span className="tabular-nums">{split.days}</span>
              </div>
            )}
            <p className={cn('text-muted-foreground', !split.custom && 'mt-1')}>{split.fit}</p>
            {!split.custom && <WeekShape days={buildSplitFrom(splits, currentSplit)} className="mt-2.5" />}
          </div>
          <Dialog
            open={splitOpen}
            onOpenChange={(open) => {
              if (!open) setPickedSplit(null)
              setSplitOpen(open)
            }}
          >
            {/* The list scrolls between a fixed header and footer. */}
            <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
              <DialogHeader className="p-6 pb-4">
                <DialogTitle>Change split</DialogTitle>
                <DialogDescription>
                  Each split keeps its own plan. Coming back to one finds it as you left it.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 overflow-y-auto scrollbar-none px-6 pb-4">
                <SplitPicker
                  splits={splits}
                  value={pickedSplit ?? currentSplit}
                  onChange={setPickedSplit}
                  ownDays={ownDays}
                  onOwnDaysChange={setOwnDays}
                  ownPlan={ownPlan ? { days: ownPlan.days } : undefined}
                  ownMode={ownMode}
                  onOwnModeChange={setOwnMode}
                />
              </div>
              <DialogFooter className="border-t p-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPickedSplit(null)
                    setSplitOpen(false)
                  }}
                  disabled={switching}
                >
                  Keep {split.name}
                </Button>
                {pickedSplit !== null &&
                  (pickedSplit !== currentSplit || (pickedSplit === OWN_SPLIT && !(ownPlan && ownMode === 'keep'))) && (
                    <Button onClick={switchSplit} disabled={switching}>
                      {pickedSplit === OWN_SPLIT
                        ? ownPlan && ownMode === 'keep'
                          ? 'Back to my plan'
                          : 'Build my plan'
                        : `Switch to ${splitInfoOf(splits, pickedSplit).name}`}
                    </Button>
                  )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        <section aria-labelledby="account-h">
          <SectionHeading id="account-h" icon={UserRound}>
            Account
          </SectionHeading>
          <p className="mt-3">{user.username ?? user.name ?? user.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </section>

        <section aria-labelledby="fresh-h">
          <SectionHeading id="fresh-h" icon={Trash2}>
            Start fresh
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-foreground">
            Wipes your plan, your settings and every logged session, weigh-in and tape entry. Your account stays and
            setup runs again. There is no undo, so export your logs first if you want to keep them.
          </p>
          <StartFreshButton />
        </section>

        <section aria-labelledby="delete-h">
          <SectionHeading id="delete-h" icon={UserX}>
            Delete account
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-foreground">
            Removes your account and every trace of your data from the database: sessions, weigh-ins, measurements,
            plans and settings. There is no recovery. Download your logs first if you want to keep them.{' '}
            <Link to="/privacy" className="text-foreground underline-offset-4 hover:underline">
              What is kept and what is not
            </Link>
            .
          </p>
          <div className="mt-4">
            <ExportButtons />
          </div>
          <DeleteAccountButton />
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- start fresh

const CONFIRM = 'start fresh'

const DELETE_CONFIRM = 'delete my account'

function DeleteAccountButton() {
  const navigate = useNavigate()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = typed.trim().toLowerCase() === DELETE_CONFIRM

  async function remove() {
    if (!ready) return
    setBusy(true)
    try {
      await deleteAccountFn()
      // The session is gone with the account; signing out just clears the cookie, so a failure here is fine.
      await authClient.signOut().catch(() => undefined)
      setOpen(false)
      await router.invalidate()
      await navigate({ to: '/login', search: { deleted: true } })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the account.'))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setTyped('')
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" className="mt-4">
          Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void remove()
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your account and every log go for good. Type <strong>{DELETE_CONFIRM}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Field className="py-4">
            <FieldLabel htmlFor="delete-confirm">Confirmation</FieldLabel>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={DELETE_CONFIRM}
              autoComplete="off"
              autoCapitalize="none"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready || busy}>
              Delete everything
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StartFreshButton() {
  const navigate = useNavigate()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = typed.trim().toLowerCase() === CONFIRM

  async function wipe() {
    if (!ready) return
    setBusy(true)
    try {
      await startFreshFn()
      toast.success('Everything is wiped. Setup runs again.')
      setOpen(false)
      await router.invalidate()
      await navigate({ to: '/setup' })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not wipe the data.'))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setTyped('')
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" className="mt-4">
          Start fresh
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void wipe()
          }}
        >
          <DialogHeader>
            <DialogTitle>Wipe everything?</DialogTitle>
            <DialogDescription>
              Plan, settings and every log go. Your account stays. Type <strong>{CONFIRM}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Field className="py-4">
            <FieldLabel htmlFor="fresh-confirm">Confirmation</FieldLabel>
            <Input
              id="fresh-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM}
              autoComplete="off"
              autoCapitalize="none"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep my data
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready || busy}>
              Wipe and start over
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
