import { Minus, Plus } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '#/components/ui/input-group'
import { cn } from '#/lib/utils'

interface Props {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  step: number
  /** Where the +/- buttons start from while the field is still empty. */
  base?: number
  min?: number
  max?: number
  inputMode?: 'decimal' | 'numeric'
  placeholder?: string
  size?: 'md' | 'lg'
  className?: string
  autoFocus?: boolean
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

// Narrower on phones, where two fields share a 375px row with the set number and the done toggle.
const stepButton =
  'h-full w-9 rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-accent sm:w-11'

/** A number input with plate-step buttons on both sides, on the shadcn input group. Big enough for thumbs. */
export function NumberField({
  label,
  value,
  onChange,
  step,
  base,
  min = 0,
  max,
  inputMode = 'decimal',
  placeholder = '0',
  size = 'md',
  className,
  autoFocus,
}: Props) {
  const clamp = (n: number) => {
    let x = Math.max(min, n)
    if (max !== undefined) x = Math.min(max, x)
    return round(x)
  }
  // An empty field steps from its base (for example the previous set), not from zero.
  const nudge = (dir: 1 | -1) => onChange(clamp((value ?? base ?? 0) + dir * step))
  const tall = size === 'lg'

  return (
    <InputGroup
      className={cn(
        'overflow-hidden rounded-lg border-input bg-card shadow-none dark:bg-card',
        tall ? 'h-14' : 'h-12',
        className,
      )}
    >
      <InputGroupAddon align="inline-start" className="h-full py-0 pl-0 has-[>button]:ml-0">
        <InputGroupButton
          size="icon-sm"
          className={stepButton}
          aria-label={`Decrease ${label}`}
          onClick={() => nudge(-1)}
        >
          <Minus className="size-4" aria-hidden />
        </InputGroupButton>
      </InputGroupAddon>
      <InputGroupInput
        type="number"
        inputMode={inputMode}
        aria-label={label}
        value={value ?? ''}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        autoFocus={autoFocus}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value === '' ? undefined : clamp(Number(e.target.value)))}
        className={cn(
          'h-full min-w-0 px-0 text-center font-condensed font-semibold tabular-nums placeholder:text-muted-foreground/50',
          tall ? 'text-3xl md:text-3xl' : 'text-xl sm:text-2xl md:text-2xl',
        )}
      />
      <InputGroupAddon align="inline-end" className="h-full py-0 pr-0 has-[>button]:mr-0">
        <InputGroupButton
          size="icon-sm"
          className={stepButton}
          aria-label={`Increase ${label}`}
          onClick={() => nudge(1)}
        >
          <Plus className="size-4" aria-hidden />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
