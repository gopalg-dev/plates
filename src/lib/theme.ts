/** The look of the app: the slate default that follows the system's dark mode, or one of the others. */
export const THEMES = ['system', 'latte', 'lime', 'dracula', 'fire', 'water', 'forest', 'air', 'sky', 'stone'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_KEY = 'theme'

export interface ThemeOption {
  value: Theme
  label: string
  /** Dark themes add the `.dark` class so the components' dark styles apply. */
  dark: boolean
  /** One of the looks named for the elements, listed in their own submenu. */
  element?: true
}

/** The menu lists each group with the device's own mode first, so the order here is the light-device one. */
export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'Slate', dark: false },
  { value: 'latte', label: 'Catppuccin Latte', dark: false },
  { value: 'lime', label: 'Lime', dark: true },
  { value: 'dracula', label: 'Dracula', dark: true },
  { value: 'air', label: 'Air', dark: false, element: true },
  { value: 'sky', label: 'Sky', dark: false, element: true },
  { value: 'stone', label: 'Stone', dark: false, element: true },
  { value: 'fire', label: 'Fire', dark: true, element: true },
  { value: 'water', label: 'Water', dark: true, element: true },
  { value: 'forest', label: 'Forest', dark: true, element: true },
]

/**
 * Runs before paint so the first frame already has the right look. Reads the saved theme, sets it on
 * `<html data-theme>`, and adds `.dark` for a dark theme, or for the slate default on a dark device. It runs again
 * when another window of the site saves a look (another tab, a demo phone on How it works).
 * `window.__applyTheme` lets the account menu re-run it after a change.
 */
export const THEME_SCRIPT =
  "(function(){try{var light={latte:1,air:1,sky:1,stone:1};var dark={lime:1,dracula:1,fire:1,water:1,forest:1};var m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){var t='system';try{t=localStorage.getItem('theme')||'system'}catch(e){};if(!light[t]&&!dark[t])t='system';var h=document.documentElement;h.dataset.theme=t;h.classList.toggle('dark',!!dark[t]||(t==='system'&&m.matches))};apply();m.addEventListener('change',apply);window.addEventListener('storage',function(e){if(e.key==='theme'||e.key===null)apply()});window.__applyTheme=apply}catch(e){}})();"

declare global {
  interface Window {
    __applyTheme?: () => void
  }
}

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return THEMES.includes(t as Theme) ? (t as Theme) : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Shows a look on this page only, while its menu item has focus (a hover, an arrow key). Nothing is saved and no
 * other window hears of it; `endPreview` puts the saved look back.
 */
export function previewTheme(theme: Theme) {
  const option = THEME_OPTIONS.find((o) => o.value === theme)
  if (!option) return
  const html = document.documentElement
  html.dataset.theme = theme
  const systemDark = theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  html.classList.toggle('dark', option.dark || systemDark)
}

/** Back to the saved look after a preview. */
export function endPreview() {
  window.__applyTheme?.()
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Private mode or blocked storage: the look still applies for this page view.
  }
  window.__applyTheme?.()
}
