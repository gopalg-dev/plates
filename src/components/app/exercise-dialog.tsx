import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { findLibrary, type LibraryExercise } from '#/lib/library'
import { useContent } from '#/lib/use-content'
import { LibraryDetail } from './library-list'

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** Set by a row that opens the view: the entry was pushed, so closing can go back. */
    fromRow?: boolean
  }
}

/** The list the view steps through with Previous and Next. A page publishes its own while it is open. */
const ListContext = createContext<{
  among: LibraryExercise[] | null
  setAmong: (list: LibraryExercise[] | null) => void
}>({ among: null, setAmong: () => {} })

export function ExerciseListProvider({ children }: { children: ReactNode }) {
  const [among, setAmong] = useState<LibraryExercise[] | null>(null)
  return <ListContext.Provider value={{ among, setAmong }}>{children}</ListContext.Provider>
}

/** For a page that lists exercises: the view then has Previous and Next through `list`, until the page leaves. */
export function useExerciseList(list: LibraryExercise[]) {
  const { setAmong } = useContext(ListContext)
  useEffect(() => {
    setAmong(list)
    return () => setAmong(null)
  }, [list, setAmong])
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
  const { among } = useContext(ListContext)
  const ex = exercise ? findLibrary(library, exercise) : undefined
  const close = () => {
    // Opened from a row here, the entry was pushed: back is the entry before it, with no param.
    // Landed on by reload or a link, there is nothing before: drop the param in place.
    if (state.fromRow) window.history.back()
    else void navigate({ to: '.', search: (prev) => ({ ...prev, exercise: undefined }), replace: true })
  }
  // Previous and Next swap the id in place, so stepping through a list does not grow the history.
  const step = (next: LibraryExercise) =>
    void navigate({ to: '.', search: (prev) => ({ ...prev, exercise: next.id }), replace: true })
  return <LibraryDetail exercise={ex ?? null} among={among ?? undefined} onStep={step} onClose={close} />
}
