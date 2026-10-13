/** The look of the app: the slate default that follows the system's dark mode, or one of four others. */
export const THEMES = ['system', 'chalk', 'pocket', 'dracula', 'latte'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_KEY = 'theme'

export interface ThemeOption {
  value: Theme
  label: string
  /** Dark themes add the `.dark` class so the components' dark styles apply. */
  dark: boolean
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'Slate', dark: false },
  { value: 'chalk', label: 'Chalk', dark: false },
  { value: 'pocket', label: 'Pocket', dark: false },
  { value: 'latte', label: 'Catppuccin Latte', dark: false },
  { value: 'dracula', label: 'Dracula', dark: true },
]

/**
 * Runs before paint so the first frame already has the right look. Reads the saved theme, sets it on
 * `<html data-theme>`, and adds `.dark` for a dark theme, or for the slate default on a dark device. It runs again
 * when another window of the site saves a look (another tab, a demo phone on How it works).
 * `window.__applyTheme` lets the account menu re-run it after a change.
 */
export const THEME_SCRIPT =
  "(function(){try{var light={chalk:1,pocket:1,latte:1};var dark={dracula:1};var m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){var t='system';try{t=localStorage.getItem('theme')||'system'}catch(e){};if(!light[t]&&!dark[t])t='system';var h=document.documentElement;h.dataset.theme=t;h.classList.toggle('dark',!!dark[t]||(t==='system'&&m.matches))};apply();m.addEventListener('change',apply);window.addEventListener('storage',function(e){if(e.key==='theme'||e.key===null)apply()});window.__applyTheme=apply}catch(e){}})();"

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

export function saveTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Private mode or blocked storage: the look still applies for this page view.
  }
  window.__applyTheme?.()
}
