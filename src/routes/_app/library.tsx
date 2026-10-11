import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useExerciseList } from '#/components/app/exercise-dialog'
import { LibraryList } from '#/components/app/library-list'
import type { LibraryExercise } from '#/lib/library'
import { pageTitle } from '#/lib/page-title'
import { useContent } from '#/lib/use-content'

export const Route = createFileRoute('/_app/library')({
  head: () => ({ meta: [{ title: pageTitle('Library') }] }),
  component: LibraryPage,
})

function LibraryPage() {
  const { library } = useContent()
  const navigate = useNavigate()
  const [visible, setVisible] = useState<LibraryExercise[]>(library)
  // The view is the app's one ExerciseDialog, opened by ?exercise=; this page lends it the filtered list to step through.
  useExerciseList(visible)
  const show = (ex: LibraryExercise) =>
    void navigate({ to: '/library', search: { exercise: ex.id }, state: { fromRow: true } })
  return (
    <div>
      <h1 className="font-condensed text-4xl font-semibold leading-none">Library</h1>
      <div className="mt-6">
        <LibraryList onSelect={show} onResults={setVisible} />
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Pictures and cues from free-exercise-db, public domain (Unlicense).
      </p>
    </div>
  )
}
