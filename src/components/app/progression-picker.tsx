import { ArrowUp, ArrowUpNarrowWide, Target } from 'lucide-react'
import { Label } from '#/components/ui/label'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { PROGRESSION_OPTIONS } from '#/lib/logic/progression'
import type { Progression } from '#/lib/types'
import { cn } from '#/lib/utils'

const ICON = { double: ArrowUpNarrowWide, linear: ArrowUp, topset: Target } as const

/** The three ways the weight can go up: an icon, one line, and a worked example each. Setup and Settings share it. */
export function ProgressionPicker({
  value,
  onChange,
  className,
}: {
  value: Progression
  onChange: (value: Progression) => void
  className?: string
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as Progression)} className={cn('gap-3', className)}>
      {PROGRESSION_OPTIONS.map((o) => {
        const Icon = ICON[o.value]
        return (
          <Label
            key={o.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-data-[state=checked]:border-foreground"
          >
            <RadioGroupItem value={o.value} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {o.title}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{o.detail}</span>
              <span className="mt-2 block rounded-md bg-muted px-2.5 py-1.5 text-sm tabular-nums">{o.example}</span>
            </span>
          </Label>
        )
      })}
    </RadioGroup>
  )
}
