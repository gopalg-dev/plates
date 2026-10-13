import { Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { readTheme, saveTheme, THEME_OPTIONS, type Theme } from '#/lib/theme'

/**
 * The looks to pick from, inside any dropdown menu: the account menu's Look item and the header button below.
 * The look belongs to the device, not the account, so it is read and saved there.
 */
export function LookRadioGroup() {
  /** Kept on the device, so it is read after mount: the server does not know it. */
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => setTheme(readTheme()), [])
  return (
    <DropdownMenuRadioGroup
      value={theme}
      onValueChange={(v) => {
        const next = THEME_OPTIONS.find((o) => o.value === v)?.value
        if (!next) return
        setTheme(next)
        saveTheme(next)
      }}
    >
      {THEME_OPTIONS.map((o) => (
        <DropdownMenuRadioItem key={o.value} value={o.value} className="text-base">
          {o.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

/** The look as a palette button, for a page header outside the app, where there is no account menu. */
export function LookMenu() {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {/* The trigger swaps the button's data-slot, so the touch-size rule misses it: 44px set here instead. */}
        <Button variant="ghost" size="icon-sm" className="pointer-coarse:size-11" aria-label="Look">
          <Palette aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="text-base">Look</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <LookRadioGroup />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
