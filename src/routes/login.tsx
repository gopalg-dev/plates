import { createFileRoute, Link, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { AuthFrame, authInput } from '#/components/app/auth-frame'
import { PasswordInput } from '#/components/app/password-input'
import { Button } from '#/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { pageTitle } from '#/lib/page-title'
import { getAuthOptionsFn } from '#/server/fns'
import { getSessionFn } from '#/server/session'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
  // A Google sign-in that did not go through lands here with ?error=…, and the page says so.
  validateSearch: (search: Record<string, unknown>): { error?: string; deleted?: boolean } => ({
    ...(typeof search.error === 'string' && search.error ? { error: search.error } : {}),
    ...(search.deleted === true || search.deleted === 'true' ? { deleted: true } : {}),
  }),
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/' })
  },
  loader: () => getAuthOptionsFn(),
  component: LoginPage,
})

function LoginPage() {
  const { google, password } = Route.useLoaderData()
  const { error, deleted } = Route.useSearch()

  return (
    <AuthFrame
      title="Sign in"
      intro="A gym logbook for the time between sets."
      footer={
        <>
          {password && (
            <>
              New here?{' '}
              <Link to="/signup" className="text-foreground underline-offset-4 hover:underline">
                Create an account
              </Link>
              {' · '}
            </>
          )}
          <Link to="/privacy" className="text-foreground underline-offset-4 hover:underline">
            Privacy
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        {deleted && (
          <p role="status" className="rounded-lg border px-4 py-3 text-sm">
            Your account and all of its data are deleted.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
            That sign-in did not go through. Try again.
          </p>
        )}
        {google && <GoogleButton />}
        {google && password && <FieldSeparator>or</FieldSeparator>}
        {password && <PasswordForm />}
      </div>
    </AuthFrame>
  )
}

// ---------------------------------------------------------------- google

function GoogleButton() {
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    const res = await authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/login' })
    if (res.error) {
      toast.error(res.error.message ?? 'Could not start Google sign-in.')
      setBusy(false)
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-12 rounded-lg bg-card text-base dark:bg-card"
      onClick={go}
      disabled={busy}
    >
      <GoogleMark />
      Continue with Google
    </Button>
  )
}

/** The four-colour G, drawn inline so no icon package is needed. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z"
      />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l3.9-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l3.9 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  )
}

// ---------------------------------------------------------------- password

function PasswordForm() {
  const navigate = useNavigate()
  const router = useRouter()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  /** The last failure, shown under the fields instead of in a toast that floats away. */
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const who = id.trim()
    if (!who || !password) return
    setBusy(true)
    setError(null)
    const res = who.includes('@')
      ? await authClient.signIn.email({ email: who, password })
      : await authClient.signIn.username({ username: who, password })
    if (res.error) {
      setError(
        res.error.status === 401 ? 'Wrong email, username or password.' : (res.error.message ?? 'Could not sign in.'),
      )
      setBusy(false)
      return
    }
    await router.invalidate()
    await navigate({ to: '/' })
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup className="gap-6">
        <Field>
          <FieldLabel htmlFor="login-id">Email or username</FieldLabel>
          <Input
            id="login-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="alex or you@example.com"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className={authInput}
          />
        </Field>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            required
            className={authInput}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
          {busy ? 'Signing in' : 'Sign in'}
        </Button>
      </FieldGroup>
    </form>
  )
}
