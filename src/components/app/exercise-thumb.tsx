import { Dumbbell } from 'lucide-react'
import { useState } from 'react'
import { findLibraryByName, imageUrl } from '#/lib/library'
import { useContent } from '#/lib/use-content'
import { cn } from '#/lib/utils'
import { LibraryDetail } from './library-list'

/**
 * The library still for an exercise, found by name. A tap opens the library's view of it (picture,
 * cues, what it works) in place, over whatever page the row is on. A quiet tile, and no tap, when
 * the name is not in the library.
 */
export function ExerciseThumb({ name, className }: { name: string; className?: string }) {
  const { library } = useContent()
  const ex = findLibraryByName(library, name)
  const [open, setOpen] = useState(false)
  if (!ex) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground',
          className,
        )}
      >
        <Dumbbell className="size-4" />
      </span>
    )
  }
  return (
    <>
      <button
        type="button"
        aria-label={`About ${ex.name}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          'size-10 shrink-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
      >
        <img src={imageUrl(ex)} alt="" loading="lazy" width={40} height={40} className="size-full object-cover" />
      </button>
      {/* The panel is portaled, but its React events still bubble to the row: a tap inside it must not count as a row tap. */}
      <span className="contents" onClick={(e) => e.stopPropagation()}>
        <LibraryDetail exercise={open ? ex : null} onClose={() => setOpen(false)} />
      </span>
    </>
  )
}
