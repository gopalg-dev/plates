import { useEffect, useState } from 'react'

/**
 * The clock, read again every `everyMs`. Null on the server and in the first client render, so what is drawn from it
 * never differs between the two: the time only appears once the page is live.
 */
export function useNow(everyMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}
