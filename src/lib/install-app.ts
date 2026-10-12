import { useSyncExternalStore } from 'react'

/** Chrome's `beforeinstallprompt` event: not in the DOM typings. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * How Plates can be installed here: the browser's own install dialog (Chrome, Edge, Samsung
 * Internet), Share then Add to Home Screen (iPhone and iPad, which have no install event), or not at
 * all (already installed, or a browser that cannot).
 */
export type InstallWay = 'prompt' | 'ios' | null

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}

// Listening from module load, as the event can fire before React has drawn the menu. No
// preventDefault: the browser's own install bar still shows; this only keeps the event for the menu.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    deferred = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

function installed() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function onApple() {
  // iPadOS reports itself as a Mac; the touch points give it away.
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function currentWay(): InstallWay {
  if (installed()) return null
  if (deferred) return 'prompt'
  return onApple() ? 'ios' : null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The way to install Plates here, and the browser's install dialog when it offers one. */
export function useInstallApp(): { way: InstallWay; prompt: () => Promise<void> } {
  const way = useSyncExternalStore(subscribe, currentWay, () => null)
  return {
    way,
    prompt: async () => {
      if (!deferred) return
      const event = deferred
      await event.prompt()
      await event.userChoice
      // An install event shows its dialog once; the browser sends a new one if it still applies.
      deferred = null
      emit()
    },
  }
}

/** Registers the service worker: the offline page, and what lets browsers offer to install. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
