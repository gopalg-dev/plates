import { createFileRoute } from '@tanstack/react-router'
import { getRequestUrl } from '@tanstack/react-start/server'

/**
 * The sitemap for search engines, built from the deployed address so it is right on any domain. Only the public
 * pages are listed; the app's own screens sit behind sign-in, the demo screens are noindex, and signup is
 * local-dev only (production signs in with Google, so /signup redirects to /login).
 */
const PAGES = ['/how-it-works', '/login', '/privacy']

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const { origin } = getRequestUrl({ xForwardedHost: true })
        const urls = PAGES.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n')
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
        return new Response(body, {
          headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=86400' },
        })
      },
    },
  },
})
