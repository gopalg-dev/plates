import type { ReactNode } from 'react'
import { Iphone } from '#/components/ui/iphone'
import { DAY_LABEL } from '#/lib/day-blocks'
import { PROGRESSION_OPTIONS } from '#/lib/logic/progression'
import { TREND_LABEL, TREND_WEEKS, type Trend } from '#/lib/logic/trend'
import { DAY_TYPES } from '#/lib/types'
import { cn } from '#/lib/utils'
import { DayIcon } from './day-mark'
import { PHONE_SHADOW } from './demo-phone'
import { ExerciseThumb } from './exercise-thumb'
import type { DemoScreenName } from './guide-demos'
import { Sparkline } from './sparkline'

/**
 * Visuals only the guide uses (`src/content/guide`), imported by the sections that show them. They draw with the
 * app's own components and read the app's own labels, so the guide shows what the screens show and cannot drift
 * from them. The general blocks every content page can use (Lead, Facts, Steps, More, Tip) are in
 * `src/components/content/mdx.tsx`. Styling stays here, in TSX, where Tailwind looks for class names.
 */

/**
 * A real exercise picture beside a line of text: the app's own thumb, with the pictures and the tap the page's
 * `ExercisePictures` gives it.
 */
export function WithPicture({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <ExerciseThumb name={name} className="size-12" />
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}

/** Where a phone sits beside the facts from 768px: the right column, in view while they are read. */
const PHONE_BESIDE = 'md:sticky md:top-16 md:col-start-2 md:row-start-1 md:w-full'

/**
 * A screenshot of one of the demo screens (`/demo/<name>`, the app's own pieces on made-up numbers) in the iPhone
 * frame, light or dark to match the page. The pictures are `public/guide/<name>-light.webp` and `-dark.webp`, taken by
 * `scripts/guide-pictures.spec.ts`: take them again after a screen changes. The two frames share one grid cell and
 * the other look's is made invisible, not removed: each frame cuts its screen with an SVG mask found by id, and a
 * mask inside a `display: none` frame stops working for every frame that shares the id.
 */
export function Shot({ name, alt, className }: { name: DemoScreenName; alt: string; className?: string }) {
  const layer = '[grid-area:1/1]'
  return (
    <figure role="img" aria-label={alt} className={cn('mt-6 grid w-56 shrink-0 sm:w-64', PHONE_SHADOW, className)}>
      <Iphone src={`/guide/${name}-light.webp`} className={cn(layer, 'dark:invisible')} />
      <Iphone src={`/guide/${name}-dark.webp`} className={cn(layer, 'invisible dark:visible')} />
    </figure>
  )
}

/**
 * A section's facts with a screenshot of their screen beside them from 768px, so the column has no empty half; the
 * phone stays clear of the page header when it comes back. On phones the phone comes first, above the facts.
 */
export function WithShot({ name, alt, children }: { name: DemoScreenName; alt: string; children: ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_13rem] md:items-start md:gap-8">
      <Shot name={name} alt={alt} className={PHONE_BESIDE} />
      <div className="min-w-0 md:col-start-1 md:row-start-1">{children}</div>
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
              <span className="text-muted-foreground">Session {i + 1}</span>
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
              <span className={cn('mt-1.5 h-6 font-medium', jump ? 'text-foreground' : 'invisible')}>
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
