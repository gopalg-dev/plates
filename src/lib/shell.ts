import { getShellFn } from '#/server/fns'

/*
 * The shell (who is signed in, and their settings) as the server last answered it, kept on the client for a short
 * while. The app layout asks for it before every screen; with it kept, a move between screens goes straight to the
 * page's own loader and the page's bones show at once, instead of waiting a round trip for a check that every
 * page's own call repeats anyway (the server functions behind the pages answer "sign in" to a session that has
 * ended). Signing out, deleting the account and starting fresh forget it. The server, rendering a fresh visit,
 * always asks.
 */

type Shell = NonNullable<Awaited<ReturnType<typeof getShellFn>>>

let seen: { at: number; shell: Shell } | null = null
const FRESH_MS = 5 * 60 * 1000

/** The kept shell while it is fresh, else the server's answer. Keeping is the layout's call, once its checks pass. */
export async function readShell(): Promise<Shell | null> {
  if (typeof window !== 'undefined' && seen && Date.now() - seen.at < FRESH_MS) return seen.shell
  return getShellFn()
}

/**
 * A shell the layout let through: signed in and set up. Only such a shell is kept, so one that sent the visit to
 * sign-in or setup is never served again after that has been done. The layout also hands over the shell the server
 * rendered the visit with, on hydration, so the first move is free too.
 */
export function rememberShell(shell: Shell) {
  if (typeof window !== 'undefined') seen = { at: Date.now(), shell }
}

export function forgetShell() {
  seen = null
}
