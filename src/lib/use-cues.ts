import { useEffect, useState } from 'react'
import { getCuesFn } from '#/server/public-fns'

/** The cues fetched so far this visit, by exercise id: stepping back to an exercise shows them at once. */
const known = new Map<string, string[]>()

/**
 * An exercise's cues, fetched when its detail opens: the heaviest part of the library, so the app does not carry it
 * for every entry. `null` while they load; an empty list for an id the library does not know, or a fetch that failed.
 */
export function useCues(id: string | undefined): string[] | null {
  const [cues, setCues] = useState<string[] | null>(() => (id ? (known.get(id) ?? null) : null))
  useEffect(() => {
    if (!id) return
    const had = known.get(id)
    if (had) {
      setCues(had)
      return
    }
    setCues(null)
    let current = true
    getCuesFn({ data: { id } })
      .then((fetched) => {
        const list = fetched ?? []
        known.set(id, list)
        if (current) setCues(list)
      })
      .catch(() => {
        if (current) setCues([])
      })
    return () => {
      current = false
    }
  }, [id])
  return cues
}
