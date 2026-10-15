import { Palette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import {
  endPreview,
  previewTheme,
  readTheme,
  saveTheme,
  THEME_OPTIONS,
  type Theme,
  type ThemeOption,
} from '#/lib/theme'

/** The plain looks sit at the top; the elements follow under a heading of their own. */
const PLAIN = THEME_OPTIONS.filter((o) => !o.element)
const ELEMENTS = THEME_OPTIONS.filter((o) => o.element)

/** A sweep of the pointer across the list must not flash every look: a preview waits this long. */
const PREVIEW_DELAY = 150

/**
 * Within a group, the looks in the device's own mode come first, the others after: a sweep down the list, each row
 * previewing, flips between dark and light once per group. Slate follows the device, so it always leads.
 */
function byDeviceMode(options: ThemeOption[], deviceDark: boolean) {
  const isDark = (o: ThemeOption) => (o.value === 'system' ? deviceDark : o.dark)
  return [...options.filter((o) => isDark(o) === deviceDark), ...options.filter((o) => isDark(o) !== deviceDark)]
}

function useDeviceDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const read = () => setDark(media.matches)
    read()
    media.addEventListener('change', read)
    return () => media.removeEventListener('change', read)
  }, [])
  return dark
}

function LookItem({ option, onPreview, onLeave }: { option: ThemeOption; onPreview: () => void; onLeave: () => void }) {
  return (
    <DropdownMenuRadioItem value={option.value} className="text-base" onFocus={onPreview} onBlur={onLeave}>
      {option.label}
    </DropdownMenuRadioItem>
  )
}

/**
 * The looks to pick from, inside any dropdown menu: the account menu's Look item and the header button below.
 * The look belongs to the device, not the account, so it is read and saved there. A look shows on the page while
 * its item has focus (a hover, an arrow key); when the list closes, the saved look is back.
 */
export function LookRadioGroup() {
  /** Kept on the device, so it is read after mount: the server does not know it. */
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => setTheme(readTheme()), [])
  const deviceDark = useDeviceDark()
  const timer = useRef<number | undefined>(undefined)
  const preview = (t: Theme) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => previewTheme(t), PREVIEW_DELAY)
  }
  const leave = () => window.clearTimeout(timer.current)
  // The list unmounts as it closes, picked from or not: a pending preview is dropped and the saved look applied.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      endPreview()
    },
    [],
  )
  const item = (o: ThemeOption) => (
    <LookItem key={o.value} option={o} onPreview={() => preview(o.value)} onLeave={leave} />
  )
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
      {byDeviceMode(PLAIN, deviceDark).map(item)}
      <DropdownMenuSeparator />
      <DropdownMenuLabel inset className="text-muted-foreground">
        Nature Elements
      </DropdownMenuLabel>
      {byDeviceMode(ELEMENTS, deviceDark).map(item)}
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
        <LookRadioGroup />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
