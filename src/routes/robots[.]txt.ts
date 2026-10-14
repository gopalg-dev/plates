import { createFileRoute } from '@tanstack/react-router'
import { getRequestUrl } from '@tanstack/react-start/server'

/** robots.txt, built from the deployed address so the sitemap line is right on any domain. */
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const { origin } = getRequestUrl({ xForwardedHost: true })
        const body = `User-agent: *\nAllow: /\nDisallow: /demo/\nSitemap: ${origin}/sitemap.xml\n`
        return new Response(body, {
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
        })
      },
    },
  },
})
