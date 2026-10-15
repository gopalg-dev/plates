import { useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '#/lib/format'
import { authClient } from './auth-client'

/** Ends the session and returns to the sign-in page. */
export function useSignOut() {
  const router = useRouter()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    try {
      await authClient.signOut()
      await router.invalidate()
      // The home page, which is How it works once signed out.
      await navigate({ to: '/' })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not sign out.'))
      setBusy(false)
    }
  }

  return { signOut, busy }
}
