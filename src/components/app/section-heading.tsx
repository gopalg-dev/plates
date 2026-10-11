import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/** A section title with its icon beside the words. The icon marks the subject; the words still do the job. */
export function SectionHeading({
  id,
  icon: Icon,
  className,
  children,
}: {
  id?: string
  icon: LucideIcon
  className?: string
  children: ReactNode
}) {
  return (
    <h2 id={id} className={cn('flex items-center gap-2 font-condensed text-2xl font-semibold leading-none', className)}>
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      {children}
    </h2>
  )
}
