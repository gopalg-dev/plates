import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, longDate } from '#/lib/format'
import type { Steps } from '#/lib/logic/progression'
import { noon } from '#/lib/logic/stats'
import type { Units, Workout } from '#/lib/types'
import { draftWorkoutFn, logPastWorkoutFn } from '#/server/fns'
import { SessionEditor } from './session-editor'

/*
 * Logging a session for a day trained without the app: the server drafts the plan day's lifts with their targets
 * (nothing stored), the session editor takes the sets, and Log session stores it dated that day. Today and Stats
 * share the pair below.
 */

/** The draft being filled in, and how to open one for a plan day on a local YYYY-MM-DD day. */
export function useDraftSession() {
  const [draft, setDraft] = useState<Workout | null>(null)

  async function open(dayId: string, day: string) {
    try {
      // Midday on that day, local, so the session lands on the day picked whatever the time zone.
      setDraft(await draftWorkoutFn({ data: { dayId, at: new Date(noon(day)).toISOString() } }))
    } catch (err) {
      toast.error(errorMessage(err, 'Could not open that day.'))
    }
  }

  return { draft, open, close: () => setDraft(null) }
}

/** The session editor over a draft: Log session stores it. */
export function PastSessionEditor({
  draft,
  units,
  steps,
  onClose,
  onLogged,
}: {
  draft: Workout | null
  units: Units
  steps?: Steps
  onClose: () => void
  onLogged: () => void | Promise<void>
}) {
  return (
    <SessionEditor
      workout={draft}
      units={units}
      steps={steps}
      onClose={onClose}
      onSaved={onLogged}
      log={{
        onSave: async (changes) => {
          if (!draft) return
          await logPastWorkoutFn({ data: { dayId: draft.dayId, at: draft.startedAt, changes } })
          toast.success(`${draft.dayName} logged for ${longDate(draft.startedAt)}`)
        },
      }}
    />
  )
}
