import { redirect } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { currentUser } from './auth'

// Routes import this module, so everything in it must be safe for the client bundle:
// server-only code lives inside `.handler()` and `.server()` callbacks only.

export type { SessionUser } from './auth'

/** Who is signed in, or null. Safe to call from any route. */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(() => currentUser())

/**
 * Server functions behind this middleware get `context.userId`.
 * Without a session the caller is sent to /login; the router follows the redirect on the client.
 */
export const authed = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await currentUser()
  if (!user) throw redirect({ to: '/login' })
  return next({ context: { userId: user.id } })
})
