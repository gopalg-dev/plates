import { Link } from '@tanstack/react-router'
import { Dumbbell } from 'lucide-react'
import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { imageUrl, type LibraryRow, nameKey } from '#/lib/library'
import { cn } from '#/lib/utils'

/** What a thumb needs from the library: enough to find an exercise's picture by name and open it. */
export type ExercisePicture = Pick<LibraryRow, 'id' | 'name' | 'images'>

/** Where a tap on a thumb goes: the library's view over this page, the Library screen, or nowhere. */
type Opens = 'here' | 'library' | null

interface Pictures {
  find: (name: string) => ExercisePicture | undefined
  opens: Opens
}

const PicturesContext = createContext<Pictures>({ find: () => undefined, opens: null })

/**
 * Hands the thumbs below their pictures. The app layout gives the whole library, opening in place (see
 * `ExerciseDialog`); a page outside the app gives what it loaded and says whether a tap may open anything.
 */
export function ExercisePictures({
  pictures,
  opens,
  children,
}: {
  pictures: ExercisePicture[]
  opens: Opens
  children: ReactNode
}) {
  const value = useMemo(() => {
    const byName = new Map(pictures.map((p) => [nameKey(p.name), p]))
    return { find: (name: string) => byName.get(nameKey(name)), opens }
  }, [pictures, opens])
  return <PicturesContext value={value}>{children}</PicturesContext>
}

/**
 * The library still for an exercise, found by name. A tap opens the library's view of it, where the provider
 * allows: in place through `?exercise=<id>`, or on the Library screen. A quiet tile when the name is not in the
 * library.
 */
export function ExerciseThumb({ name, className }: { name: string; className?: string }) {
  const { find, opens } = useContext(PicturesContext)
  const ex = find(name)
  const tile = cn('block size-10 shrink-0 overflow-hidden rounded-md bg-muted', className)
  if (!ex) {
    return (
      <span aria-hidden className={cn(tile, 'flex items-center justify-center text-muted-foreground')}>
        <Dumbbell className="size-4" />
      </span>
    )
  }
  const picture = (
    <img src={imageUrl(ex)} alt="" loading="lazy" width={40} height={40} className="size-full object-cover" />
  )
  const link = cn(tile, 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50')
  if (opens === 'here') {
    return (
      <Link
        to="."
        search={(prev) => ({ ...prev, exercise: ex.id })}
        state={{ fromRow: true }}
        aria-label={`About ${ex.name}`}
        className={link}
      >
        {picture}
      </Link>
    )
  }
  if (opens === 'library') {
    // Closing the library's view goes back here.
    return (
      <Link
        to="/library"
        search={{ exercise: ex.id }}
        state={{ fromRow: true }}
        aria-label={`About ${ex.name}`}
        className={link}
      >
        {picture}
      </Link>
    )
  }
  return <span className={tile}>{picture}</span>
}
