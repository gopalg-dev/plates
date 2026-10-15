import { useLocation } from '@tanstack/react-router'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'

/*
 * What a page looks like before its data is here: the same bones, grey. The router shows a page's own while its
 * loader runs (after 300 ms, for at least 200 ms), and the app layout shows the one for the path while the content
 * itself loads, so the Library page, which has no loader, still comes up in its own shape. Nothing here says
 * "loading": the shape says it, and `aria-busy` says it to a screen reader.
 */

/** The page title: `text-4xl leading-none`, 36px tall. */
function Title({ className }: { className: string }) {
  return <Skeleton className={cn('h-9', className)} />
}

/** A line of body text, 20px tall at the base size. */
function Line({ className }: { className: string }) {
  return <Skeleton className={cn('h-5', className)} />
}

/** A list row with a picture or an icon on the left, two lines, and something at the right edge. */
function Row({ media, right }: { media: string; right?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1 py-3">
      <Skeleton className={cn('shrink-0', media)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Line className="w-2/5 max-w-40" />
        <Skeleton className="h-4 w-1/3 max-w-28" />
      </div>
      {right && <Skeleton className={right} />}
    </div>
  )
}

function Rows({ count, media, right }: { count: number; media: string; right?: string }) {
  return (
    <div className="divide-y border-y">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the rows are identical placeholders with no identity of their own
        <Row key={i} media={media} right={right} />
      ))}
    </div>
  )
}

/** A row of filter pills, as the library's tag rows. */
function Pills({ count }: { count: number }) {
  return (
    <div className="flex gap-2 overflow-hidden py-0.5">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders
        <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
      ))}
    </div>
  )
}

function Today() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Line className="w-40" />
          <div className="mt-1 flex items-center gap-3">
            <Skeleton className="size-11 rounded-xl" />
            <Title className="w-36" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Skeleton className="h-9 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <Line className="mt-3 w-44" />
      <Skeleton className="mt-5 h-32 w-full rounded-lg" />
      <div className="mt-5">
        <Rows count={5} media="size-10 rounded-md" right="h-4 w-14" />
      </div>
      <Skeleton className="mt-6 h-12 w-full rounded-md" />
    </>
  )
}

function Plan() {
  return (
    <>
      <Title className="w-24" />
      <Line className="mt-2 w-56" />
      <div className="mt-6 divide-y border-t">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders
          <div key={i} className="flex items-center gap-3 py-4">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="size-5 rounded" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-9 w-28 rounded-md" />
    </>
  )
}

function Import() {
  return (
    <>
      <Line className="w-14" />
      <Title className="mt-3 w-72 max-w-full" />
      <Line className="mt-2 w-full" />
      <Line className="mt-1 w-4/5" />
      <div className="mt-6 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full rounded-md sm:w-72" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <Skeleton className="mt-6 h-9 w-32 rounded-md" />
    </>
  )
}

function Stats() {
  return (
    <>
      <Title className="w-20" />
      <div className="mt-6 flex gap-0.5">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
      <div className="mt-6 flex items-center gap-2">
        <Skeleton className="size-5 rounded" />
        <Skeleton className="h-6 w-28" />
      </div>
      <Skeleton className="mt-3 h-56 w-full rounded-lg" />
      <div className="mt-10 flex items-center gap-2">
        <Skeleton className="size-5 rounded" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="mt-3">
        <Rows count={3} media="size-8 rounded-md" right="h-4 w-16" />
      </div>
    </>
  )
}

function Report() {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <Title className="w-24" />
        <Skeleton className="size-8 rounded-md" />
      </div>
      <div className="mt-6 flex items-center gap-2">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="mt-8 flex items-baseline gap-3">
        <Skeleton className="h-12 w-16" />
        <Line className="w-40" />
      </div>
      <Skeleton className="mt-3 h-24 w-full rounded-lg" />
      <Skeleton className="mt-10 h-40 w-full rounded-lg" />
      <Skeleton className="mt-10 h-40 w-full rounded-lg" />
    </>
  )
}

function Library() {
  return (
    <>
      <Title className="w-24" />
      <Skeleton className="mt-6 h-11 w-full rounded-md" />
      <Line className="mt-3 w-16" />
      <div className="mt-1">
        <Pills count={7} />
      </div>
      <Line className="mt-3 w-24" />
      <div className="mt-1">
        <Pills count={6} />
      </div>
      <Line className="mt-3 w-28" />
      <div className="mt-1">
        <Rows count={6} media="size-14 rounded-md" right="h-8 w-16 rounded-md" />
      </div>
    </>
  )
}

function Settings() {
  return (
    <>
      <Title className="w-28" />
      <div className="mt-8 flex flex-col gap-10">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders
          <div key={i}>
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded" />
              <Skeleton className="h-7 w-32" />
            </div>
            <Skeleton className="mt-3 h-9 w-full max-w-xs rounded-md" />
            <Line className="mt-2 w-3/5" />
          </div>
        ))}
      </div>
    </>
  )
}

/** A page whose shape is not drawn here: a title and a block. */
function Plain() {
  return (
    <>
      <Title className="w-32" />
      <Line className="mt-6 w-64" />
      <Skeleton className="mt-8 h-40 w-full rounded-lg" />
    </>
  )
}

const PAGES: [RegExp, () => React.JSX.Element][] = [
  [/^\/?$/, Today],
  [/^\/plan\/import\/?$/, Import],
  [/^\/plan\/?$/, Plan],
  [/^\/stats\/?$/, Stats],
  [/^\/report\/?$/, Report],
  [/^\/library\/?$/, Library],
  [/^\/settings\/?$/, Settings],
]

/** The bones of the page at `path`. */
export function PageSkeleton({ path }: { path: string }) {
  const Page = PAGES.find(([re]) => re.test(path))?.[1] ?? Plain
  return (
    <div aria-busy="true" aria-live="polite">
      <Page />
    </div>
  )
}

/** For a route's `pendingComponent`: the bones of the page being gone to. */
export function PendingPage() {
  const { pathname } = useLocation()
  return <PageSkeleton path={pathname} />
}
