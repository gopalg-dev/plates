import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, longDate } from '#/lib/format'
import type { Steps } from '#/lib/logic/progression'
import { noon } from '#/lib/logic/stats'
import type { PlanDay, Units, Workout } from '#/lib/types'
import { draftWorkoutFn, logPastWorkoutFn } from '#/server/fns'
import { SessionEditor } from './session-editor'

/*
 * Logging a session for a day trained without the app: the server drafts the plan day's lifts with their targets
 * (nothing stored), the session editor takes the sets, and Log session stores it dated that day. Today and Stats
 * share the pair below.
 */

/** A draft asked for and not here yet: the plan day it is for, and the local YYYY-MM-DD day it is dated. */
interface Opening {
  day: PlanDay
  at: string
}

/** The draft being filled in, the one on its way, and how to open one for a plan day on a local YYYY-MM-DD day. */
export function useDraftSession() {
  const [draft, setDraft] = useState<Workout | null>(null)
  const [opening, setOpening] = useState<Opening | null>(null)

  async function open(day: PlanDay, at: string) {
    setOpening({ day, at })
    try {
      // Midday on that day, local, so the session lands on the day picked whatever the time zone.
      setDraft(await draftWorkoutFn({ data: { dayId: day.id, at: new Date(noon(at)).toISOString() } }))
    } catch (err) {
      toast.error(errorMessage(err, 'Could not open that day.'))
    } finally {
      setOpening(null)
    }
  }

  return { draft, opening, open, close: () => setDraft(null) }
}

/** The session editor over a draft, open on the day's bones while the draft is fetched: Log session stores it. */
export function PastSessionEditor({
  draft,
  opening,
  units,
  steps,
  onClose,
  onLogged,
}: {
  draft: Workout | null
  opening: Opening | null
  units: Units
  steps?: Steps
  onClose: () => void
  onLogged: () => void | Promise<void>
}) {
  return (
    <SessionEditor
      workout={draft}
      pending={
        opening
          ? { dayName: opening.day.name, dayType: opening.day.type, at: new Date(noon(opening.at)).toISOString() }
          : null
      }
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
