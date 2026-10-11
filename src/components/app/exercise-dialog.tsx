import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { findLibrary } from '#/lib/library'
import { useContent } from '#/lib/use-content'
import { LibraryDetail } from './library-list'

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** Set by a row's picture when it opens the view: the entry was pushed, so closing can go back. */
    fromRow?: boolean
  }
}

/**
 * The library's view of one exercise, over whatever screen is open, driven by `?exercise=<id>` in
 * the URL. One instance lives in the app layout; any row opens it by linking to the current page
 * with that param. A reload or a shared link reopens it. An id the library does not know shows
 * nothing.
 */
export function ExerciseDialog() {
  const { exercise } = useSearch({ strict: false }) as { exercise?: string }
  const { state } = useLocation()
  const navigate = useNavigate()
  const { library } = useContent()
  const ex = exercise ? findLibrary(library, exercise) : undefined
  const close = () => {
    // Opened from a row here, the entry was pushed: back is the entry before it, with no param.
    // Landed on by reload or a link, there is nothing before: drop the param in place.
    if (state.fromRow) window.history.back()
    else void navigate({ to: '.', search: (prev) => ({ ...prev, exercise: undefined }), replace: true })
  }
  return <LibraryDetail exercise={ex ?? null} onClose={close} />
}
