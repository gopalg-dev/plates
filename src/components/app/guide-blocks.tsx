import type { ReactNode } from 'react'
import { DAY_LABEL } from '#/lib/day-blocks'
import { PROGRESSION_OPTIONS } from '#/lib/logic/progression'
import { TREND_LABEL, TREND_WEEKS, type Trend } from '#/lib/logic/trend'
import { DAY_TYPES } from '#/lib/types'
import { cn } from '#/lib/utils'
import { DayIcon } from './day-mark'
import { ExerciseThumb } from './exercise-thumb'
import { Sparkline } from './sparkline'

/**
 * Visuals only the guide uses (`src/content/guide`), imported by the sections that show them. They draw with the
 * app's own components and read the app's own labels, so the guide shows what the screens show and cannot drift
 * from them. The general blocks every content page can use (Lead, Facts, Steps, More, Tip) are in
 * `src/components/content/mdx.tsx`. Styling stays here, in TSX, where Tailwind looks for class names.
 */

/** A real exercise picture beside a line of text; the picture opens the exercise, as it does on Plan and Today. */
export function WithPicture({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <ExerciseThumb name={name} className="size-12" />
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}

/**
 * Reps first, then weight, as four sessions of a barbell lift with 2.5 kg plates: the reps climb through the
 * range, then the weight goes up and the reps start again. Bars are the reps, numbers the set.
 */
const LADDER = [
  { weight: 60, reps: 8 },
  { weight: 60, reps: 10 },
  { weight: 60, reps: 12 },
  { weight: 65, reps: 8 },
]
const LADDER_TOP = 12

export function Ladder() {
  return (
    <figure className="mt-6">
      <ol className="grid grid-cols-4 items-end gap-2 sm:gap-4" aria-label="Four sessions of one lift">
        {LADDER.map(({ weight, reps }, i) => {
          const jump = i > 0 && weight > LADDER[i - 1].weight
          return (
            <li key={`${weight}x${reps}`} className="flex flex-col">
              <span className="text-sm text-muted-foreground">Session {i + 1}</span>
              <span
                className={cn(
                  'mt-1 font-condensed text-3xl font-semibold leading-none tabular-nums sm:text-4xl',
                  jump ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {weight}
                <span className="ml-0.5 text-base font-medium">kg</span>
              </span>
              <span className="mt-0.5 font-condensed text-xl tabular-nums text-foreground">× {reps}</span>
              <span
                aria-hidden
                className={cn('mt-2 w-full rounded-t-sm', jump ? 'bg-primary' : 'bg-muted-foreground/25')}
                style={{ height: `${(reps / LADDER_TOP) * 4.5}rem` }}
              />
              <span className={cn('mt-1.5 h-4 text-xs font-medium', jump ? 'text-foreground' : 'invisible')}>
                {jump ? `+${weight - LADDER[i - 1].weight} kg` : ''}
              </span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}

/** The three progression methods, worded as Settings words them, each with its worked example. */
export function Methods() {
  return (
    <ul className="mt-5 divide-y border-y">
      {PROGRESSION_OPTIONS.map((o) => (
        <li key={o.value} className="py-3">
          <p className="font-medium text-foreground">{o.title}</p>
          <p className="mt-0.5 text-muted-foreground">{o.detail}</p>
          <p className="mt-1 font-condensed text-lg tabular-nums text-foreground">{o.example}</p>
        </li>
      ))}
    </ul>
  )
}

/** Every day kind with its tile, as Plan and Today draw it. */
export function DayKinds() {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {DAY_TYPES.map((type) => (
        <li key={type} className="flex items-center gap-2.5">
          <DayIcon type={type} className="size-8" />
          {DAY_LABEL[type]}
        </li>
      ))}
    </ul>
  )
}

/** Made-up weekly best sets, only to give each trend its shape. */
const TREND_SHAPES: { trend: Trend; values: number[]; reads: string }[] = [
  {
    trend: 'climbing',
    values: [60, 60, 62.5, 62.5, 65, 67.5],
    reads: `the last ${TREND_WEEKS} weeks beat its best from before`,
  },
  {
    trend: 'stuck',
    values: [65, 67.5, 67.5, 65, 67.5, 67.5],
    reads: `the last ${TREND_WEEKS} weeks did not beat its best from before`,
  },
  {
    trend: 'slipping',
    values: [70, 70, 67.5, 65, 65, 62.5],
    reads: `the last ${TREND_WEEKS} weeks are more than 5% under its best from before`,
  },
]

/** What the trend chips on the Lifts tab mean, drawn with the same sparkline the app uses. */
export function TrendShapes() {
  return (
    <ul className="mt-5 flex flex-col gap-3">
      {TREND_SHAPES.map(({ trend, values, reads }) => (
        <li key={trend} className="flex items-center gap-4">
          <Sparkline values={values} className="text-foreground" />
          <p>
            <span className="font-medium text-foreground">{TREND_LABEL[trend]}</span>{' '}
            <span className="text-muted-foreground">{reads}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}
