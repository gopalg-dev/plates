import { useEffect } from 'react'

/**
 * Keeps the screen on while `active`, through the Screen Wake Lock API. The browser drops the lock
 * whenever the page leaves the foreground, so it is asked for again when the page comes back. Where
 * the API is missing or refused, nothing happens.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let gone = false
    const request = async () => {
      if (gone || document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        lock = null
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
      lock = null
    }
  }, [active])
}
