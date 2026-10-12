import { useCommandState } from 'cmdk'
import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react'
import { Command, CommandGroup, CommandItem, CommandList } from '#/components/ui/command'
import { Input } from '#/components/ui/input'
import { EQUIPMENT_LABEL, imageUrl, type LibraryExercise, searchLibrary } from '#/lib/library'
import { MUSCLE_LABEL } from '#/lib/logic/stats'
import { useContent } from '#/lib/use-content'
import { cn } from '#/lib/utils'

/** How many suggestions show under the box. */
const SUGGESTIONS = 5

interface Props extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: string
  onChange: (name: string) => void
  /** A suggestion was taken: the caller fills in what the library knows about it. */
  onPick: (exercise: LibraryExercise) => void
}

/**
 * The exercise name box. From two letters in, library lifts that match show under it; tap one, or
 * arrow to it and press Enter, to take it. Anything else typed stays as typed, for lifts the library
 * does not have. Enter without arrowing still submits the form.
 *
 * The box is our own input inside cmdk's root, not cmdk's input: cmdk 1.1 refocuses its input by id
 * whenever the highlight moves, and focuses the list when it cannot find it (dip/cmdk#368), which
 * shut the phone keyboard mid-word. The list also takes focus when touched (dip/cmdk#370), so a
 * pointer-down on it is held back.
 */
export function ExerciseNameField({ value, onChange, onPick, ...input }: Props) {
  const { library } = useContent()
  const [focused, setFocused] = useState(false)
  /** The highlighted suggestion. Only arrows set it, so Enter after typing never swaps the name. */
  const [active, setActive] = useState('')
  const arrowed = useRef(false)

  const query = value.trim().toLowerCase()
  const matches = useMemo(() => {
    if (query.length < 2) return []
    const rank = (ex: LibraryExercise) => {
      const name = ex.name.toLowerCase()
      return name.startsWith(query) ? 0 : name.includes(query) ? 1 : 2
    }
    return searchLibrary({ query }, library)
      .map((ex, at) => ({ ex, at, rank: rank(ex) }))
      .sort((a, b) => a.rank - b.rank || a.at - b.at)
      .slice(0, SUGGESTIONS)
      .map(({ ex }) => ex)
  }, [library, query])
  const exact = matches.some((ex) => ex.name.toLowerCase() === query)
  const open = focused && matches.length > 0 && !exact

  function forget() {
    setActive('')
    arrowed.current = false
  }

  function take(ex: LibraryExercise) {
    onChange(ex.name)
    onPick(ex)
    forget()
  }

  /** A press on anything else blurs the box on the way down. */
  const pressing = useRef(false)
  useEffect(() => {
    if (!focused) return
    const down = () => {
      pressing.current = true
    }
    const up = () => {
      pressing.current = false
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
    }
  }, [focused])

  /**
   * Closing the list shrinks the form, and a centred dialog then moves its footer: a press that
   * blurred the box would come up off the button it went down on. So the list waits for the press to
   * finish, and its click to land, before it goes.
   */
  function blurred() {
    const close = () => {
      // Back in the box by the time the press ends: stay open.
      if (document.activeElement?.closest('[cmdk-root]')) return
      setFocused(false)
      forget()
    }
    if (!pressing.current) return close()
    const after = () => {
      document.removeEventListener('pointerup', after, true)
      document.removeEventListener('pointercancel', after, true)
      setTimeout(close, 0)
    }
    document.addEventListener('pointerup', after, true)
    document.addEventListener('pointercancel', after, true)
  }

  return (
    <Command
      shouldFilter={false}
      loop
      value={active}
      onValueChange={(v) => {
        if (arrowed.current) setActive(v)
      }}
      className="h-auto overflow-visible rounded-none bg-transparent text-foreground"
    >
      <NameInput
        {...input}
        value={value}
        open={open}
        highlighted={active !== ''}
        onChange={(v) => {
          onChange(v)
          forget()
        }}
        onFocusChange={(on) => (on ? setFocused(true) : blurred())}
        onArrow={() => {
          arrowed.current = true
        }}
      />
      {open && (
        <CommandList
          onPointerDown={(e) => e.preventDefault()}
          className="mt-1.5 max-h-none rounded-md border bg-popover text-popover-foreground"
        >
          <CommandGroup>
            {matches.map((ex) => (
              <CommandItem
                key={ex.id}
                value={ex.id}
                onSelect={() => take(ex)}
                // cmdk marks the first row as selected on its own; only an arrowed-to row looks it, as only that one takes Enter.
                className={cn(
                  'gap-3 py-1.5 text-base hover:bg-accent',
                  !active && 'data-[selected=true]:bg-transparent data-[selected=true]:text-popover-foreground',
                )}
              >
                <img
                  src={imageUrl(ex)}
                  alt=""
                  loading="lazy"
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-md bg-muted object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{ex.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {MUSCLE_LABEL[ex.muscle]}, {EQUIPMENT_LABEL[ex.equipment].toLowerCase()}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      )}
    </Command>
  )
}

interface InputProps extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: string
  open: boolean
  /** A suggestion is highlighted by the arrows, so Enter takes it. */
  highlighted: boolean
  onChange: (value: string) => void
  onFocusChange: (focused: boolean) => void
  onArrow: () => void
}

/** The text box, wired as a combobox over cmdk's list. Lives inside the root to read its state. */
function NameInput({ value, open, highlighted, onChange, onFocusChange, onArrow, ...input }: InputProps) {
  const selectedId = useCommandState((s) => s.selectedItemId)
  return (
    <Input
      {...input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      role="combobox"
      autoComplete="off"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-activedescendant={open && highlighted ? selectedId : undefined}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      onKeyDown={(e) => {
        if (!open) {
          // Closed, the keys are the form's: Enter saves, and cmdk's root never sees them.
          e.stopPropagation()
          return
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') onArrow()
        else if (e.key === 'Enter' && !highlighted) e.stopPropagation()
      }}
    />
  )
}
