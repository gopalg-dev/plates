import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { z } from 'zod'
import { currentUser } from './auth'
import { cuesOf, readContent, rowsOf } from './content'

// Server functions anyone may call, signed in or not. They hand out nothing that belongs to an account.
// Routes import this module, so server-only code stays inside `.handler()` callbacks.

/** Where the app is served from, for the one URL that must be absolute: the share preview's picture. */
export const getSiteFn = createServerFn({ method: 'GET' }).handler(() => ({
  origin: getRequestUrl({ xForwardedHost: true }).origin,
}))

/** The split templates and the exercise library, for the demo on How it works: reference content, nobody's data. */
export const getPublicContentFn = createServerFn({ method: 'GET' }).handler(async () => rowsOf(await readContent()))

/** One exercise's cues, when its detail opens: most of the library's weight, so sent only then. */
export const getCuesFn = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(80) }))
  .handler(({ data }) => cuesOf(data.id))

/** What the public guide needs: whether someone is signed in, for its header, and the library's pictures. */
export const getGuideFn = createServerFn({ method: 'GET' }).handler(async () => {
  const [user, { library }] = await Promise.all([currentUser(), readContent()])
  return { signedIn: Boolean(user), pictures: library.map(({ id, name, images }) => ({ id, name, images })) }
})
