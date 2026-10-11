import { Link } from '@tanstack/react-router'
import { Dumbbell } from 'lucide-react'
import { findLibraryByName, imageUrl } from '#/lib/library'
import { useContent } from '#/lib/use-content'
import { cn } from '#/lib/utils'

/**
 * The library still for an exercise, found by name. A tap links to the current page with
 * `?exercise=<id>`, which opens the library's view of it in place (see `ExerciseDialog` in the app
 * layout). A quiet tile, and no tap, when the name is not in the library.
 */
export function ExerciseThumb({ name, className }: { name: string; className?: string }) {
  const { library } = useContent()
  const ex = findLibraryByName(library, name)
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
    <Link
      to="."
      search={(prev) => ({ ...prev, exercise: ex.id })}
      state={{ fromRow: true }}
      aria-label={`About ${ex.name}`}
      className={cn(
        'block size-10 shrink-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <img src={imageUrl(ex)} alt="" loading="lazy" width={40} height={40} className="size-full object-cover" />
    </Link>
  )
}
