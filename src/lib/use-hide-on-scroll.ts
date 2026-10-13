import { useEffect, useState } from 'react'

/** How far the page must move one way before the header follows: a finger's jitter is less. */
const THRESHOLD = 8

/**
 * True while the page scrolls down past `offset`, false again as soon as it scrolls up or nears the top: a header
 * that steps aside for reading and comes back the moment you head up, as Google's pages do. Moves smaller than
 * `THRESHOLD` add up until they pass it, so a slow scroll still counts and a shaky thumb does not flicker it.
 */
export function useHideOnScroll(offset: number): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        if (y <= offset) setHidden(false)
        else if (y - last > THRESHOLD) setHidden(true)
        else if (last - y > THRESHOLD) setHidden(false)
        else return
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [offset])
  return hidden
}
