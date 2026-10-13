import { createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PhoneScreen } from '#/components/app/demo-phone'
import { ExercisePictures } from '#/components/app/exercise-thumb'
import { DEMO_SCREENS, DemoScreen } from '#/components/app/guide-demos'
import { pageTitle } from '#/lib/page-title'
import { ContentProvider } from '#/lib/use-content'
import { usePageHydrated } from '#/lib/use-page-hydrated'
import { getPublicContentFn } from '#/server/public-fns'

/**
 * One demo screen, the whole of a phone-sized window: what a `DemoPhone` on How it works shows. Public, never
 * indexed, and on made-up numbers only (see `DemoScreen`).
 */
export const Route = createFileRoute('/demo/$screen')({
  params: {
    parse: ({ screen }) => {
      const found = DEMO_SCREENS.find((s) => s === screen)
      if (!found) throw notFound()
      return { screen: found }
    },
  },
  head: () => ({
    meta: [{ title: pageTitle('Demo') }, { name: 'robots', content: 'noindex' }],
  }),
  loader: () => getPublicContentFn(),
  component: DemoPage,
})

function DemoPage() {
  const { screen } = Route.useParams()
  const content = Route.useLoaderData()
  usePageHydrated()
  // Drawn in the browser only: the made-up history is worked out from today's date, which the server may see as
  // another day.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <PhoneScreen>
      {/* The app's reference content, as its layout provides it. A picture shows, but a tap on one opens nothing. */}
      <ContentProvider content={content}>
        <ExercisePictures pictures={content.library} opens={null}>
          {ready && <DemoScreen screen={screen} />}
        </ExercisePictures>
      </ContentProvider>
    </PhoneScreen>
  )
}
