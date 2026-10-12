import { useEffect, useState } from 'react'

/**
 * Chrome on Android lays its autofill bar (passwords, cards, addresses) over the top of the keyboard,
 * and the visual viewport counts only part of it. How much of the bar pokes above the visual viewport,
 * in px, assumed whenever the keyboard is up there: about 30, measured on a phone, plus a little room.
 */
const ANDROID_AUTOFILL_BAR = 32

export interface VisibleViewport {
  /** Height of the part of the screen the user can see, in px. */
  height: number
  /** How far the visible part's bottom sits above where `fixed bottom-0` lands: the keyboard, mostly. */
  bottom: number
  /** The on-screen keyboard is up: the visible part is well short of the tallest it has been. */
  keyboard: boolean
}

/**
 * The part of the screen left visible by the on-screen keyboard, while `active`. Most phones lay the
 * keyboard over the page instead of shrinking it, so a `fixed bottom-0` panel ends up underneath.
 * Null when inactive or before the browser reports a visual viewport.
 */
export function useVisibleViewport(active: boolean): VisibleViewport | null {
  const [visible, setVisible] = useState<VisibleViewport | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    // A zero-size fixed element marks where `fixed bottom-0` lands. Measuring it beats window.innerHeight,
    // which some browsers shrink with the keyboard and some do not.
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none'
    document.body.append(probe)
    const autofillBar = /Android/i.test(navigator.userAgent) ? ANDROID_AUTOFILL_BAR : 0
    let tallest = 0
    const update = () => {
      tallest = Math.max(tallest, vv.height)
      const fixedBottom = probe.getBoundingClientRect().top
      const keyboard = tallest - vv.height > 150
      const bar = keyboard ? autofillBar : 0
      setVisible({
        height: Math.round(vv.height - bar),
        bottom: Math.max(0, Math.round(fixedBottom - vv.offsetTop - vv.height + bar)),
        keyboard,
      })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      probe.remove()
      setVisible(null)
    }
  }, [active])
  return visible
}
