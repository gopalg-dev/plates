import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { longDate } from '#/lib/format'
import { dayKey } from '#/lib/logic/stats'
import { cn } from '#/lib/utils'

interface Props {
  /** Lets a `<Label htmlFor>` name the button. */
  id?: string
  /** The chosen day, local, YYYY-MM-DD. */
  value: string
  onChange: (day: string) => void
  /** Latest day that can be picked, YYYY-MM-DD. Today by default. */
  max?: string
  className?: string
}

/** Midday on a local calendar day, so the Date never slips to the day before. */
function toDate(key: string): Date {
  return new Date(`${key}T12:00:00`)
}

/**
 * A day picker on the shadcn Calendar, opened from a button that shows the chosen day.
 * The caption carries month and year dropdowns, so an older entry is a few taps away.
 */
export function DatePicker({ id, value, onChange, max, className }: Props) {
  const [open, setOpen] = useState(false)
  const todayKey = dayKey(new Date())
  const selected = toDate(value)
  const latest = toDate(max ?? todayKey)
  const label = longDate(selected.toISOString())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn('h-10 w-full justify-start font-normal tabular-nums', className)}
        >
          <CalendarIcon aria-hidden className="text-muted-foreground" />
          {value === todayKey ? `Today, ${label}` : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          startMonth={new Date(latest.getFullYear() - 3, 0, 1)}
          endMonth={latest}
          disabled={{ after: latest }}
          onSelect={(day) => {
            if (!day) return
            onChange(dayKey(day))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
