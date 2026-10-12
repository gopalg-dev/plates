// Plates' service worker. It caches nothing: every page and every bit of data still comes from the
// network. Its one job is the page shown when a page cannot load because the device is offline, and
// a fetch handler is also what lets the browser offer to install the app.

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plates</title>
    <style>
      body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
        font: 16px/1.5 system-ui, sans-serif; background: #f3f5f6; color: #1b232c; text-align: center; }
      @media (prefers-color-scheme: dark) { body { background: #1b232c; color: #f3f5f6; } }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0 0 20px; opacity: 0.7; }
      button { font: inherit; padding: 10px 20px; border: 0; border-radius: 8px; background: currentColor; }
      button span { color: #f3f5f6; }
      @media (prefers-color-scheme: dark) { button span { color: #1b232c; } }
    </style>
  </head>
  <body>
    <main>
      <h1>You're offline</h1>
      <p>Plates needs a connection to load.</p>
      <button type="button" onclick="location.reload()"><span>Try again</span></button>
    </main>
  </body>
</html>`

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  // Only whole-page loads, and only when the network fails; everything else goes by untouched.
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    ),
  )
})
