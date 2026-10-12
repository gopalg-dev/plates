import {
  Anchor,
  ArrowBigDown,
  ArrowBigUp,
  ArrowDownToLine,
  ArrowUpToLine,
  BicepsFlexed,
  Dumbbell,
  Footprints,
  type LucideIcon,
  Shield,
  Target,
  Triangle,
} from 'lucide-react'
import type { DayType } from '#/lib/types'
import { cn } from '#/lib/utils'

export { DAY_LABEL } from '#/lib/day-blocks'

type Family = 'push' | 'pull' | 'legs' | 'mixed'

/** Plate colours follow the family: red for pushing, blue for pulling, yellow for legs, neutral for the rest. */
const family: Record<DayType, Family> = {
  push: 'push',
  chest: 'push',
  shoulders: 'push',
  pull: 'pull',
  back: 'pull',
  legs: 'legs',
  lower: 'legs',
  upper: 'mixed',
  full: 'mixed',
  arms: 'mixed',
  core: 'mixed',
}

const colour: Record<Family, string> = {
  push: 'bg-day-push',
  pull: 'bg-day-pull',
  legs: 'bg-day-legs',
  mixed: 'bg-muted-foreground',
}

/** Ink on top of each plate colour: a token, so a theme with light plates (Dracula) can darken it. */
const ink: Record<Family, string> = {
  push: 'text-(--day-push-ink)',
  pull: 'text-(--day-pull-ink)',
  legs: 'text-(--day-legs-ink)',
  mixed: 'text-background',
}

/** A plate-coloured bar. Red is push, blue is pull, yellow is legs, grey is a mixed day. */
export function DayMark({ type, className }: { type: DayType; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-block h-6 w-1.5 shrink-0 rounded-full', colour[family[type]], className)} />
  )
}

/** A glyph per day type: what the session is about, at a glance. */
const icon: Record<DayType, LucideIcon> = {
  push: ArrowBigUp,
  pull: ArrowBigDown,
  legs: Footprints,
  upper: ArrowUpToLine,
  lower: ArrowDownToLine,
  full: Dumbbell,
  chest: Shield,
  back: Anchor,
  shoulders: Triangle,
  arms: BicepsFlexed,
  core: Target,
}

/**
 * A plate-coloured tile with the day's glyph, for lists and titles. Size it with `size-*`; the glyph
 * scales with it. Red is push, blue is pull, yellow is legs, grey is a mixed day.
 */
export function DayIcon({ type, className }: { type: DayType; className?: string }) {
  const Icon = icon[type]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-lg',
        colour[family[type]],
        ink[family[type]],
        className,
      )}
    >
      {/* The ink and the size sit on the glyph itself: menus and selects restyle a bare svg to their own grey. */}
      <Icon strokeWidth={2.25} className={cn('size-[55%]', ink[family[type]])} />
    </span>
  )
}

export function dayColourClass(type: DayType): string {
  return colour[family[type]]
}

const colourVar: Record<Family, string> = {
  push: 'var(--day-push)',
  pull: 'var(--day-pull)',
  legs: 'var(--day-legs)',
  mixed: 'var(--muted-foreground)',
}

/** The same plate colour as a CSS value, for chart strokes. */
export function dayColourVar(type: DayType): string {
  return colourVar[family[type]]
}

/** Text colour that stays readable on top of the matching plate colour. */
export function dayInkClass(type: DayType): string {
  return ink[family[type]]
}
