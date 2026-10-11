import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { Skeleton } from './components/ui/skeleton'
import { routeTree } from './routeTree.gen'

/** Shown when a page's data takes longer than a blink, in the page's own shape. */
function Pending() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5 md:px-8 md:pt-8" aria-busy="true" aria-live="polite">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="mt-6 h-5 w-64" />
      <Skeleton className="mt-8 h-40 w-full" />
    </div>
  )
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: Pending,
    defaultPendingMs: 300,
    defaultPendingMinMs: 200,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
