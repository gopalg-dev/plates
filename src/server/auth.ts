import { getRequestHeaders } from '@tanstack/react-start/server'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { emailOTP, magicLink, username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { getDbSync } from './db'
import { sendMail } from './mail'
import { codeMail, signInMail } from './mail-templates'
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

const LINK_MINUTES = 15
const CODE_MINUTES = 10

/** What the sign-in page can offer. Email links always work: without a mail provider they go to the outbox. */
export function authOptions() {
  return { google: google !== undefined }
}


/**
 * Self-hosted Better Auth. Three ways in: an emailed sign-in link, Google, or email or username
 * with a password. Sessions live in a cookie (HttpOnly, SameSite=Lax) and in the `session` collection.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(getDbSync()),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // A password account is usable once the address has typed back the emailed code.
    requireEmailVerification: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  socialProviders: google ? { google } : {},
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
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    // Sign-up sends a six-digit code; the account is not usable until it is typed back.
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * CODE_MINUTES,
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp }) => {
        await sendMail({ to: email, ...codeMail(otp, CODE_MINUTES), code: otp })
      },
    }),
    magicLink({
      expiresIn: 60 * LINK_MINUTES,
      sendMagicLink: async ({ email, url }) => {
        await sendMail({ to: email, ...signInMail(url, LINK_MINUTES), link: url })
      },
    }),
    tanstackStartCookies(),
  ],
})

export interface SessionUser {
  id: string
  name: string
  email: string
  username: string | null
}

/** The signed-in user from the request's session cookie, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) return null
  const { user } = session
  return { id: user.id, name: user.name, email: user.email, username: user.username ?? null }
}
