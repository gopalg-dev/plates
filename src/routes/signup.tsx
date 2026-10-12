import { Link, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { AuthFrame, authInput } from '#/components/app/auth-frame'
import { Button } from '#/components/ui/button'
import { PasswordInput } from '#/components/app/password-input'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { getAuthOptionsFn } from '#/server/fns'
import { getSessionFn } from '#/server/session'
import { pageTitle } from '#/lib/page-title'

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: pageTitle('Create an account') }] }),
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/' })
    // Without the password door there is nothing to create here: Google makes the account.
    if (!(await getAuthOptionsFn()).password) throw redirect({ to: '/login' })
  },
  component: SignupPage,
})

const USERNAME = /^[a-zA-Z0-9_.]{3,30}$/

type Errors = { username?: string; password?: string }

/** Username, email and password; the account is signed in as soon as it is made, and setup follows. */
function SignupPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = username.trim()
    const next: Errors = {}
    if (!USERNAME.test(name)) next.username = 'Use 3 to 30 letters, numbers, dots or underscores.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    setErrors(next)
    if (next.username || next.password) return
    setBusy(true)
    const res = await authClient.signUp.email({ email: email.trim(), password, name, username: name })
    if (res.error) {
      toast.error(res.error.message ?? 'Could not create the account.')
      setBusy(false)
      return
    }
    // Signing up signs the account in; a second sign-in only matters if the server did not.
    if (!(await authClient.getSession()).data) await authClient.signIn.email({ email: email.trim(), password })
    await router.invalidate()
    await navigate({ to: '/' })
  }

  return (
    <AuthFrame
      title="Create your account"
      intro="One account, every device. Setup takes three questions after this."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
          {' · '}
          <Link to="/privacy" className="text-foreground underline-offset-4 hover:underline">
            Privacy
          </Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <FieldGroup className="gap-6">
          <Field data-invalid={errors.username ? true : undefined}>
            <FieldLabel htmlFor="signup-username">Username</FieldLabel>
            <Input
              id="signup-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alex"
              aria-invalid={errors.username ? true : undefined}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              required
              className={authInput}
            />
            <FieldDescription>Letters, numbers, dots or underscores. You sign in with it.</FieldDescription>
            <FieldError>{errors.username}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="signup-email">Email</FieldLabel>
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className={authInput}
            />
          </Field>
          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor="signup-password">Password</FieldLabel>
            <PasswordInput
              id="signup-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              aria-invalid={errors.password ? true : undefined}
              autoComplete="new-password"
              required
              className={authInput}
            />
            <FieldError>{errors.password}</FieldError>
          </Field>
          <Button type="submit" size="lg" className="mt-2 h-12 text-base" disabled={busy}>
            {busy ? 'Creating the account' : 'Create account'}
          </Button>
        </FieldGroup>
      </form>
    </AuthFrame>
  )
}
