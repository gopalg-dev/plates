import { WEEKDAY_SHORT, WEEK_ORDER, defaultWeekdays } from '#/lib/logic/schedule'
import { buildSplit } from '#/lib/splits'
import type { DayType, SplitId } from '#/lib/types'
import { cn } from '#/lib/utils'
import { DAY_LABEL, dayColourClass } from './day-mark'

/** Seven cells, Monday to Sunday: which days a split trains, in the plate colour of each day's type. */
export function WeekShape({ split, className }: { split: SplitId; className?: string }) {
  const days = buildSplit(split)
  const weekdays = defaultWeekdays(days.length)
  const byWeekday = new Map<number, DayType>()
  days.forEach((d, i) => {
    if (!byWeekday.has(weekdays[i])) byWeekday.set(weekdays[i], d.type)
  })
  return (
    <span className={cn('flex gap-1', className)} role="img" aria-label={describe(byWeekday)}>
      {WEEK_ORDER.map((wd) => {
        const type = byWeekday.get(wd)
        return (
          <span
            key={wd}
            title={`${WEEKDAY_SHORT[wd]}: ${type ? DAY_LABEL[type] : 'rest'}`}
            className={cn('h-2 w-4 rounded-sm', type ? dayColourClass(type) : 'bg-muted')}
          />
        )
      })}
    </span>
  )
}

function describe(byWeekday: Map<number, DayType>): string {
  const parts = WEEK_ORDER.map((wd) => {
    const type = byWeekday.get(wd)
    return `${WEEKDAY_SHORT[wd]} ${type ? DAY_LABEL[type].toLowerCase() : 'rest'}`
  })
  return `Week: ${parts.join(', ')}`
}
