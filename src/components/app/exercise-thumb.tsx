import { Dumbbell } from 'lucide-react'
import { findLibraryByName, imageUrl } from '#/lib/library'
import { useContent } from '#/lib/use-content'
import { cn } from '#/lib/utils'

/** The library still for an exercise, found by name. A quiet tile when the name is not in the library. */
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
    <img
      src={imageUrl(ex)}
      alt=""
      loading="lazy"
      width={40}
      height={40}
      className={cn('size-10 shrink-0 rounded-md bg-muted object-cover', className)}
    />
  )
}
