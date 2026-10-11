import { emailOTPClient, magicLinkClient, usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/** Talks to /api/auth on the same origin. */
export const authClient = createAuthClient({
  plugins: [usernameClient(), magicLinkClient(), emailOTPClient()],
})
