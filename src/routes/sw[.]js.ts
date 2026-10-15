import { createFileRoute } from '@tanstack/react-router'
import { THEME_SCRIPT } from '#/lib/theme'

/*
 * Plates' service worker, at /sw.js. Served by the app rather than from `public/`, so the offline page can run the
 * same theme script as every other page. Every page and every bit of data still comes from the network: the worker
 * keeps only the look (the built stylesheet and the font files, under their hashed names, as pages request them) so
 * the one page it draws, shown when a page cannot load because the device is offline, comes in the saved look and
 * the app's own type. A fetch handler is also what lets the browser offer to install the app.
 */

/** With the stylesheet cached, the app's tokens draw it; without (a first visit, or dev), the slate look's values. */
const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plates</title>
    <script>${THEME_SCRIPT}</script>
    <!--look-->
    <style>
      body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px; text-align: center;
        font: 16px/1.5 var(--app-font-sans, ui-sans-serif, system-ui, sans-serif);
        background: var(--background, #f3f5f6); color: var(--foreground, #1b232c); }
      h1 { margin: 0 0 8px; font: 600 28px/1.1 var(--app-font-condensed, ui-sans-serif, system-ui, sans-serif); }
      p { margin: 0 0 20px; color: var(--muted-foreground, #5f6b78); }
      button { font: inherit; font-weight: 500; padding: 10px 20px; border: 0;
        border-radius: calc(var(--radius, 0.5rem) - 2px);
        background: var(--primary, #1b232c); color: var(--primary-foreground, #f3f5f6); }
      @media (prefers-color-scheme: dark) {
        body { background: var(--background, #1b232c); color: var(--foreground, #f3f5f6); }
        p { color: var(--muted-foreground, #9aa7b3); }
        button { background: var(--primary, #f3f5f6); color: var(--primary-foreground, #1b232c); }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>You're offline</h1>
      <p>Plates needs a connection to load.</p>
      <button type="button" onclick="location.reload()">Try again</button>
    </main>
  </body>
</html>`

/** The worker itself. Plain script, no backticks: it is sent as text, after the page above as a string constant. */
const WORKER = `
const LOOK = 'plates-look-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== LOOK).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  ),
)

/** The built stylesheet and the font files: hashed names, so a copy never goes stale. */
function isLook(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/assets/') && /\\.(css|woff2?|ttf)$/.test(url.pathname)
}

/** From the network, keeping a copy; a new stylesheet (a new deploy) replaces the old one. Offline, the copy. */
async function lookAsset(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(LOOK)
      if (request.url.endsWith('.css')) {
        for (const old of await cache.keys()) if (old.url.endsWith('.css') && old.url !== request.url) await cache.delete(old)
      }
      await cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const copy = await caches.match(request)
    if (copy) return copy
    throw err
  }
}

/** The offline page, linking whatever stylesheet is kept so it comes in the saved look. */
async function offlinePage() {
  const cache = await caches.open(LOOK)
  const links = (await cache.keys())
    .filter((r) => r.url.endsWith('.css'))
    .map((r) => '<link rel="stylesheet" href="' + new URL(r.url).pathname + '">')
    .join('')
  return new Response(OFFLINE_PAGE.replace('<!--look-->', links), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

self.addEventListener('fetch', (event) => {
  // Whole-page loads, only when the network fails; the look's files, kept as they pass; everything else untouched.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(offlinePage))
  } else if (isLook(new URL(event.request.url))) {
    event.respondWith(lookAsset(event.request))
  }
})
`

export const Route = createFileRoute('/sw.js')({
  server: {
    handlers: {
      GET: () =>
        new Response(`const OFFLINE_PAGE = ${JSON.stringify(OFFLINE_PAGE)}\n${WORKER}`, {
          // Browsers compare the worker byte for byte on each check: never an old copy from a cache in between.
          headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' },
        }),
    },
  },
})
