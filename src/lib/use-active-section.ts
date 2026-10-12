import { useEffect, useState } from 'react'

/** How far below the top of the window a section's top counts as reached, in px. */
const READ_LINE = 96

/**
 * The id of the section being read: the last one whose top has passed the read line. At the bottom of the page it is
 * the last section, since short ones at the end never reach the line. The window is what scrolls: the app layout has
 * no scrolling box of its own. Pass a stable array (a module constant or a memo).
 */
export function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0])
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) return setActive(ids[ids.length - 1])
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= READ_LINE) current = id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids])
  return active
}
