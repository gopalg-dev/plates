import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { PageSkeleton } from './components/app/page-skeletons'
import { routeTree } from './routeTree.gen'

/**
 * Shown when a page outside the app's layout takes longer than a blink to load: a title and a block in the page
 * column. The app's pages each have their own bones (page-skeletons.tsx), set on their routes.
 */
function Pending() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5 md:px-8 md:pt-8">
      <PageSkeleton path="" />
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
