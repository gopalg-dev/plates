import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { NumberField } from '#/components/app/number-field'
import { SplitPicker } from '#/components/app/split-picker'
import { Button } from '#/components/ui/button'
import { Field, FieldDescription } from '#/components/ui/field'
import { Label } from '#/components/ui/label'
import { Progress } from '#/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { dayKey } from '#/lib/logic/stats'
import { DEFAULT_SPLIT, templateOf } from '#/lib/splits'
import type { SplitId, TrainingAge, Units } from '#/lib/types'
import { applySplitFn, getSettingsFn, logBodyweightFn, saveSettingsFn } from '#/server/fns'
import { getSessionFn } from '#/server/session'

type Search = { step?: 'split' }
import { pageTitle } from '#/lib/page-title'

export const Route = createFileRoute('/setup')({
  head: () => ({ meta: [{ title: pageTitle('Setup') }] }),
  // /setup?step=split opens straight on the split question (linked from the Plan page).
  validateSearch: (search: Record<string, unknown>): Search => (search.step === 'split' ? { step: 'split' } : {}),
  beforeLoad: async () => {
    if (!(await getSessionFn())) throw redirect({ to: '/login' })
  },
  loader: () => getSettingsFn(),
  component: SetupPage,
})

// Units, split, bodyweight, training age. One question per screen.
const STEPS = 4
const SPLIT_STEP = 1

const ageOptions: { value: TrainingAge; title: string; detail: string }[] = [
  {
    value: 'under1',
    title: 'Under a year',
    detail: 'Every 4-set lift becomes 3 sets while you build the base.',
  },
  {
    value: 'over1',
    title: 'A year or more',
    detail: 'The full plan, 4 sets on the big lifts.',
  },
]

const optionRow =
  'flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-data-[state=checked]:border-foreground'

function SetupPage() {
  const initial = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [step, setStep] = useState(search.step === 'split' ? SPLIT_STEP : 0)
  const [units, setUnits] = useState<Units>(initial.units)
  const [split, setSplit] = useState<SplitId>(templateOf(initial.split))
  const [bodyweight, setBodyweight] = useState<number | undefined>(initial.bodyweight)
  const [trainingAge, setTrainingAge] = useState<TrainingAge>(initial.trainingAge)
  const [saving, setSaving] = useState(false)

  // The split the plan is on now. Before the first setup there is none; data claimed from before
  // accounts existed has no split recorded but is on the default. A custom plan matches no template.
  const currentSplit: SplitId | undefined =
    initial.split === 'custom' ? undefined : (initial.split ?? (initial.setupDone ? DEFAULT_SPLIT : undefined))
  const switching = initial.setupDone && split !== currentSplit

  async function finish() {
    setSaving(true)
    try {
      await saveSettingsFn({
        data: { units, trainingAge, setupDone: true, ...(bodyweight ? { bodyweight } : {}) },
      })
      // A new split starts the plan over from its template. The same split keeps the plan and its edits.
      if (split !== currentSplit) await applySplitFn({ data: { split } })
      // The first setup records the answer to "What do you weigh today?" as today's weigh-in. A later run
      // only logs when the number was changed, so re-running setup does not invent a weigh-in.
      if (bodyweight && (!initial.setupDone || bodyweight !== initial.bodyweight)) {
        await logBodyweightFn({ data: { weight: bodyweight, day: dayKey(new Date()) } })
      }
      await navigate({ to: '/' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  function next() {
    if (step < STEPS - 1) setStep(step + 1)
    else void finish()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 pb-8">
      <div className="flex items-center gap-3">
        <Progress value={((step + 1) / STEPS) * 100} className="h-1 flex-1" aria-label="Setup progress" />
        <span className="text-sm tabular-nums text-muted-foreground">
          {step + 1} of {STEPS}
        </span>
      </div>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
      >
        <div className="flex-1 pt-10">
          {step === 0 && (
            <section>
              <h1 className="font-condensed text-3xl font-semibold leading-tight">Which units do you lift in?</h1>
              <ToggleGroup
                type="single"
                variant="outline"
                value={units}
                onValueChange={(v) => v && setUnits(v as Units)}
                className="mt-8 w-full"
                aria-label="Units"
              >
                <ToggleGroupItem value="kg" className="h-14 flex-1 text-lg">
                  Kilograms
                </ToggleGroupItem>
                <ToggleGroupItem value="lb" className="h-14 flex-1 text-lg">
                  Pounds
                </ToggleGroupItem>
              </ToggleGroup>
            </section>
          )}

          {step === SPLIT_STEP && (
            <section>
              <h1 className="font-condensed text-3xl font-semibold leading-tight">Which split?</h1>
              <p className="mt-2 text-muted-foreground">
                How the week is cut up. Every template is yours to edit afterwards, exercise by exercise.
              </p>
              <SplitPicker value={split} onChange={setSplit} className="mt-8" />
              {switching && (
                <p className="mt-4 rounded-lg border px-3 py-2 text-sm">
                  Switching starts the plan over from this template. Your edits go, your logged workouts stay.
                </p>
              )}
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="font-condensed text-3xl font-semibold leading-tight">What do you weigh today?</h1>
              <Field className="mt-8">
                <NumberField
                  size="lg"
                  label={`Bodyweight in ${units}`}
                  value={bodyweight}
                  onChange={setBodyweight}
                  step={units === 'kg' ? 0.5 : 1}
                  inputMode="decimal"
                  placeholder={units === 'kg' ? '70' : '155'}
                  autoFocus
                />
                <FieldDescription>
                  A weekly weigh-in shows whether you are gaining at the right pace. You can skip this.
                </FieldDescription>
              </Field>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="font-condensed text-3xl font-semibold leading-tight">How long have you been lifting?</h1>
              <RadioGroup
                value={trainingAge}
                onValueChange={(v) => setTrainingAge(v as TrainingAge)}
                className="mt-8 gap-3"
              >
                {ageOptions.map((o) => (
                  <Label key={o.value} className={optionRow}>
                    <RadioGroupItem value={o.value} className="mt-0.5" />
                    <span>
                      <span className="block font-medium">{o.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{o.detail}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </section>
          )}
        </div>

        <div className="mt-8 flex items-center gap-2">
          {step > 0 && (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              <ChevronLeft aria-hidden />
              Back
            </Button>
          )}
          {step === 2 && bodyweight === undefined && (
            <Button type="button" variant="ghost" onClick={() => setStep(3)}>
              Skip
            </Button>
          )}
          <Button type="submit" size="lg" className="ml-auto h-12 px-6 text-base" disabled={saving}>
            {step < STEPS - 1 ? 'Continue' : 'Start training'}
          </Button>
        </div>
      </form>
    </main>
  )
}
