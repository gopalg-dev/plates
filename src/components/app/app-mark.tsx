import { cn } from '#/lib/utils'

/** The app's mark: the favicon file itself, so there is one drawing of it. Decorative next to the name. */
export function AppMark({ className }: { className?: string }) {
  return (
    <img src="/favicon.svg" alt="" aria-hidden width={24} height={24} className={cn('size-6 shrink-0', className)} />
  )
}

/** The mark and the name, as a header or footer shows them. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-condensed text-lg font-medium leading-none', className)}>
      <AppMark />
      Plates
    </span>
  )
}
