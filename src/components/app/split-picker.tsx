import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { SPLITS, type SplitInfo } from '#/lib/splits'
import type { SplitId } from '#/lib/types'
import { cn } from '#/lib/utils'
import { WeekShape } from './week-shape'

/** The row an option sits in. Shared with the collapsed "current split" row in Settings. */
export const splitOptionRow =
  'flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-data-[state=checked]:border-foreground'

/** Name, days, one line on who it fits, and the shape of the week. */
export function SplitOptionBody({ split }: { split: SplitInfo }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{split.name}</span>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {split.days} {split.days === 1 ? 'day' : 'days'}
        </span>
      </span>
      <span className="mt-0.5 block text-sm text-muted-foreground">{split.fit}</span>
      <WeekShape split={split.id} className="mt-2.5" />
    </span>
  )
}

/** The nine templates as a radio list. */
export function SplitPicker({
  value,
  onChange,
  className,
}: {
  /** Empty when the plan is custom and nothing is picked yet. */
  value: SplitId | ''
  onChange: (id: SplitId) => void
  className?: string
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as SplitId)} className={cn('gap-3', className)}>
      {SPLITS.map((s) => (
        <Label key={s.id} className={splitOptionRow}>
          <RadioGroupItem value={s.id} className="mt-0.5" />
          <SplitOptionBody split={s} />
        </Label>
      ))}
    </RadioGroup>
  )
}
