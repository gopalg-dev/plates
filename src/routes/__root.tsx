import type { ErrorComponentProps } from '@tanstack/react-router'
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '#/components/ui/button'
import { Toaster } from '#/components/ui/sonner'
import { registerServiceWorker } from '#/lib/install-app'
import { THEME_SCRIPT } from '#/lib/theme'
import { getSiteFn } from '#/server/public-fns'
import appCss from '../styles.css?url'

const DESCRIPTION = 'A free gym logbook: pick a split, log sets fast between rests, and watch every lift climb.'

export const Route = createRootRoute({
  // The share preview's picture needs an absolute URL, and only the request knows the host (production or a preview).
  loader: () => getSiteFn(),
  staleTime: Number.POSITIVE_INFINITY,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Plates' },
      { name: 'description', content: DESCRIPTION },
      { name: 'theme-color', content: 'hsl(200 16% 96%)', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: 'hsl(210 23% 14%)', media: '(prefers-color-scheme: dark)' },
      // The card a shared link unfurls into (LinkedIn, WhatsApp, Slack). public/og.png is made by scripts/guide-pictures.spec.ts.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Plates' },
      { property: 'og:title', content: 'Plates' },
      { property: 'og:description', content: DESCRIPTION },
      ...(loaderData
        ? [
            { property: 'og:image', content: `${loaderData.origin}/og.png` },
            { property: 'og:image:width', content: '1200' },
            { property: 'og:image:height', content: '630' },
            { property: 'og:image:alt', content: 'Plates on a phone: a session being logged and a lift chart' },
          ]
        : []),
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/icon-192.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
    scripts: [
      { children: THEME_SCRIPT },
      // Brand identity for search engines: who Plates is and its site, so a brand search can show it in full.
      ...(loaderData
        ? [
            {
              type: 'application/ld+json',
              children: JSON.stringify({
                '@context': 'https://schema.org',
                '@graph': [
                  {
                    '@type': 'Organization',
                    '@id': `${loaderData.origin}/#organization`,
                    name: 'Plates',
                    url: loaderData.origin,
                    logo: `${loaderData.origin}/icon-512.png`,
                  },
                  {
                    '@type': 'WebSite',
                    '@id': `${loaderData.origin}/#website`,
                    name: 'Plates',
                    url: loaderData.origin,
                    description: DESCRIPTION,
                    publisher: { '@id': `${loaderData.origin}/#organization` },
                  },
                ],
              }),
            },
          ]
        : []),
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

/**
 * Marks the document once React runs on the client. The e2e tests wait for it before they click,
 * because a click on server-rendered HTML submits a form natively and reloads the page.
 * (The shell component only renders on the server, so the effect lives here.)
 */
function RootComponent() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true'
    registerServiceWorker()
  }, [])
  return <Outlet />
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-center" />
        <Scripts />
      </body>
    </html>
  )
}

function RootError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : String(error)
  const dbDown = /ECONNREFUSED|Server selection timed out|MongoServerSelectionError|connect/i.test(message)
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-condensed text-3xl font-semibold">
        {dbDown ? 'The database is not running' : 'Something broke'}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {dbDown
          ? 'Start it, then try again. From the project folder:'
          : 'Try again. If it keeps happening, the message below says what failed.'}
      </p>
      {dbDown ? (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-sm">bun run db:up</pre>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{message}</pre>
      )}
      <Button className="mt-6 self-start" onClick={() => router.invalidate()}>
        Try again
      </Button>
    </main>
  )
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-condensed text-3xl font-semibold">That page does not exist</h1>
      <Button asChild className="mt-6 self-start">
        <Link to="/">Go to today</Link>
      </Button>
    </main>
  )
}
