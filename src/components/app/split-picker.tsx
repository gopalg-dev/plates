import { Minus, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { splitInfos, type SplitInfo, type SplitTemplate } from '#/lib/content'
import { DAY_LABEL, buildCustomDays } from '#/lib/day-blocks'
import { DAY_TYPES, type DayType, type SplitId } from '#/lib/types'
import { cn } from '#/lib/utils'
import { DayIcon } from './day-mark'
import { WeekShape } from './week-shape'

/** The row an option sits in. */
export const splitOptionRow =
  'flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-data-[state=checked]:border-foreground'

/** The id the picker uses for a plan the user lays out day by day. */
export const OWN_SPLIT = 'custom'

/** Two to six days, by type, for a plan of your own. The first draft: a four-day upper and lower. */
export const DEFAULT_OWN_DAYS: DayType[] = ['upper', 'lower', 'upper', 'lower']
export const MAX_OWN_DAYS = 6
export const MIN_OWN_DAYS = 2

/** Name, days, one line on who it fits, and the shape of the week. */
export function SplitOptionBody({ split, template }: { split: SplitInfo; template: SplitTemplate }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{split.name}</span>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {split.days} {split.days === 1 ? 'day' : 'days'}
        </span>
      </span>
      <span className="mt-0.5 block text-sm text-muted-foreground">{split.fit}</span>
      <WeekShape days={template.days} className="mt-2.5" />
    </span>
  )
}

/** The days of a plan of your own: one type per day, add or take one away. */
export function OwnDaysEditor({
  days,
  onChange,
  className,
}: {
  days: DayType[]
  onChange: (days: DayType[]) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {days.map((type, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
          <Select value={type} onValueChange={(v) => onChange(days.map((d, j) => (j === i ? (v as DayType) : d)))}>
            <SelectTrigger size="sm" className="flex-1" aria-label={`Day ${i + 1} type`}>
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove day ${i + 1}`}
            disabled={days.length <= MIN_OWN_DAYS}
            onClick={() => onChange(days.filter((_, j) => j !== i))}
          >
            <Minus aria-hidden />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <WeekShape days={buildCustomDays(days)} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={days.length >= MAX_OWN_DAYS}
          onClick={() => onChange([...days, days[days.length - 1] ?? 'full'])}
        >
          <Plus aria-hidden />
          Add a day
        </Button>
      </div>
    </div>
  )
}

/** The templates as a radio list, with "Your own" at the end: pick the days yourself. */
export function SplitPicker({
  splits,
  value,
  onChange,
  ownDays,
  onOwnDaysChange,
  className,
}: {
  splits: SplitTemplate[]
  /** Empty when the plan is custom and nothing is picked yet. */
  value: SplitId | ''
  onChange: (id: SplitId) => void
  ownDays: DayType[]
  onOwnDaysChange: (days: DayType[]) => void
  className?: string
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v)} className={cn('gap-3', className)}>
      {splitInfos(splits).map((s) => (
        <Label key={s.id} className={splitOptionRow}>
          <RadioGroupItem value={s.id} className="mt-0.5" />
          <SplitOptionBody split={s} template={splits.find((t) => t.id === s.id)!} />
        </Label>
      ))}
      <Label className={cn(splitOptionRow, 'flex-col items-stretch gap-0')}>
        <span className="flex items-start gap-3">
          <RadioGroupItem value={OWN_SPLIT} className="mt-0.5" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-medium">Your own</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {ownDays.length} {ownDays.length === 1 ? 'day' : 'days'}
              </span>
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Pick a kind for each day. Each starts with five lifts to edit.
            </span>
          </span>
        </span>
        {value === OWN_SPLIT && <OwnDaysEditor days={ownDays} onChange={onOwnDaysChange} className="mt-4 pl-7" />}
      </Label>
    </RadioGroup>
  )
}
