import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { LibraryDetail, LibraryList } from '#/components/app/library-list'
import type { LibraryExercise } from '#/lib/library'
import { pageTitle } from '#/lib/page-title'
import { useContent } from '#/lib/use-content'

export const Route = createFileRoute('/_app/library')({
  head: () => ({ meta: [{ title: pageTitle('Library') }] }),
  component: LibraryPage,
})

function LibraryPage() {
  const { library } = useContent()
  const [selected, setSelected] = useState<LibraryExercise | null>(null)
  const [visible, setVisible] = useState<LibraryExercise[]>(library)
  return (
    <div>
      <h1 className="font-condensed text-4xl font-semibold leading-none">Library</h1>
      <div className="mt-6">
        <LibraryList onSelect={setSelected} onResults={setVisible} />
      </div>
      <LibraryDetail exercise={selected} among={visible} onStep={setSelected} onClose={() => setSelected(null)} />
      <p className="mt-8 text-xs text-muted-foreground">
        Pictures and cues from free-exercise-db, public domain (Unlicense).
      </p>
    </div>
  )
}
