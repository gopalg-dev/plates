import { getRequestHeaders } from '@tanstack/react-start/server'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { getDbSync } from './db'
import { claimLegacyData } from './repo'

// This module is server-only. Route files must not import it directly: only server function
// handlers and middleware `.server()` callbacks may, because those are stripped from the client
// bundle. A plain import would drag Better Auth and the MongoDB driver into the browser.

// Google needs OAuth credentials from Google Cloud, with
// `${BETTER_AUTH_URL}/api/auth/callback/google` as an authorised redirect URI.
const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined

/**
 * The password door (sign in with email or username, and Create account) is open only where
 * AUTH_PASSWORD=true: the dev server and the tests. In production the only door is Google, which
 * is what keeps sign-up spam out, and there is no sign-up API to hit.
 */
const passwords = process.env.AUTH_PASSWORD === 'true'

/** What the sign-in page can offer. */
export function authOptions() {
  return { google: google !== undefined, password: passwords }
}

/**
 * Self-hosted Better Auth. Two ways in: Google, or email or username with a password. Sessions
 * live in a cookie (HttpOnly, SameSite=Lax) and in the `session` collection.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(getDbSync()),
  emailAndPassword: {
    enabled: passwords,
    minPasswordLength: 8,
    // No emailed code: an account is usable as soon as it is made. Mail needs a sender domain, and
    // Google sign-in covers the people who want a verified identity.
    requireEmailVerification: false,
  },
  // Google's name and picture refresh on every Google sign-in: an account made before Google was an
  // option (an emailed link, say) picks them up the first time it signs in that way.
  socialProviders: google ? { google: { ...google, overrideUserInfoOnSignIn: true } } : {},
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
      // A Google login attached to an existing email account brings its name and picture with it.
      updateUserInfoOnLink: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // a month
    updateAge: 60 * 60 * 24, // refreshed once a day of use
  },
  databaseHooks: {
    user: {
      create: {
        // The first account on this database inherits the logs made before accounts existed.
        after: async (user) => {
          await claimLegacyData(user.id)
        },
      },
    },
  },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 }), tanstackStartCookies()],
})

export interface SessionUser {
  id: string
  name: string
  email: string
  username: string | null
  /** The picture Google gave, for accounts made with it. */
  image: string | null
}

/** The signed-in user from the request's session cookie, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) return null
  const { user } = session
  return { id: user.id, name: user.name, email: user.email, username: user.username ?? null, image: user.image ?? null }
}
