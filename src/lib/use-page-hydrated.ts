import { useEffect } from 'react'

/**
 * Marks the document once this page's React tree is mounted. The root marks `data-hydrated` when
 * it hydrates, but a route's own component can follow a beat later (its chunk, its data), and a
 * field typed in that gap is wiped by React's first render. The e2e tests wait for this mark
 * before they type or tap. Every page that the tests drive calls it; it clears on unmount so a
 * navigation waits for the next page's own mark.
 */
export function usePageHydrated() {
  useEffect(() => {
    document.documentElement.dataset.pageHydrated = 'true'
    return () => {
      delete document.documentElement.dataset.pageHydrated
    }
  }, [])
}
