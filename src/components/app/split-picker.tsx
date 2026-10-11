import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { splitInfos, type SplitInfo, type SplitTemplate } from '#/lib/content'
import type { SplitId } from '#/lib/types'
import { cn } from '#/lib/utils'
import { WeekShape } from './week-shape'

/** The row an option sits in. */
export const splitOptionRow =
  'flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-data-[state=checked]:border-foreground'

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

/** The templates as a radio list. */
export function SplitPicker({
  splits,
  value,
  onChange,
  className,
}: {
  splits: SplitTemplate[]
  /** Empty when the plan is custom and nothing is picked yet. */
  value: SplitId | ''
  onChange: (id: SplitId) => void
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
    </RadioGroup>
  )
}
