import { Link, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuthFrame, authInput } from '#/components/app/auth-frame'
import { Button } from '#/components/ui/button'
import { PasswordInput } from '#/components/app/password-input'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '#/components/ui/input-otp'
import { authClient } from '#/lib/auth-client'
import { getSessionFn } from '#/server/session'
import { pageTitle } from '#/lib/page-title'

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: pageTitle('Create an account') }] }),
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/' })
  },
  component: SignupPage,
})

const USERNAME = /^[a-zA-Z0-9_.]{3,30}$/
const CODE_LENGTH = 6
const RESEND_SECONDS = 30

type Errors = { username?: string; password?: string }

function SignupPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  /** After the account is made, the address has to type back the emailed code before it is usable. */
  const [awaitingCode, setAwaitingCode] = useState(false)

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
    setBusy(false)
    if (res.error) {
      toast.error(res.error.message ?? 'Could not create the account.')
      return
    }
    setAwaitingCode(true)
  }

  if (awaitingCode) {
    return (
      <AuthFrame
        title="Check your email"
        intro={
          <>
            The code went to <span className="text-foreground">{email.trim()}</span>.
          </>
        }
        footer={
          <Button variant="link" className="h-auto px-0 text-muted-foreground" onClick={() => setAwaitingCode(false)}>
            Wrong address? Go back
          </Button>
        }
      >
        <CodeForm email={email.trim()} password={password} />
      </AuthFrame>
    )
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
            <FieldDescription>A code goes there to confirm it is yours.</FieldDescription>
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

/** The six boxes for the emailed code. A right code verifies the address and signs the account in. */
function CodeForm({ email, password }: { email: string; password: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Seconds until another code can be asked for; the first one was just sent. */
  const [wait, setWait] = useState(RESEND_SECONDS)
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < CODE_LENGTH) return
    setBusy(true)
    setError(null)
    const res = await authClient.emailOtp.verifyEmail({ email, otp: code })
    if (res.error) {
      setError(res.error.message ?? 'That code did not work.')
      setBusy(false)
      return
    }
    // Verifying signs the account in; a second sign-in only matters if the server did not.
    if (!(await authClient.getSession()).data) await authClient.signIn.email({ email, password })
    await router.invalidate()
    await navigate({ to: '/' })
  }

  async function resend() {
    setBusy(true)
    setError(null)
    // Sent in the foreground, so a refused mail (an unverified sender domain, say) shows up here.
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })
    setBusy(false)
    if (res.error) {
      setError(res.error.message ?? 'Could not send a new code.')
      return
    }
    setWait(RESEND_SECONDS)
    toast.success('A new code is on its way')
  }

  return (
    <form onSubmit={verify}>
      <FieldGroup className="gap-6">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="signup-code">Code</FieldLabel>
          <InputOTP
            id="signup-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={setCode}
            autoFocus
            inputMode="numeric"
            aria-label="Verification code"
            aria-invalid={error ? true : undefined}
            containerClassName="justify-start"
          >
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <InputOTPSlot key={i} index={i} className="size-12 font-condensed text-xl font-semibold" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <FieldError>{error}</FieldError>
        </Field>
        <Button type="submit" size="lg" className="h-12 text-base" disabled={busy || code.length < CODE_LENGTH}>
          {busy ? 'Checking' : 'Verify'}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto self-start px-0 text-muted-foreground"
          onClick={resend}
          disabled={busy || wait > 0}
        >
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </Button>
      </FieldGroup>
    </form>
  )
}
