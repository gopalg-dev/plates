import { useVirtualizer, useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '#/components/ui/carousel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Input } from '#/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { ScrollArea, ScrollBar } from '#/components/ui/scroll-area'
import { Skeleton } from '#/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  EQUIPMENT,
  EQUIPMENT_LABEL,
  type Equipment,
  FRAME_LABEL,
  FRAMES,
  imageUrl,
  type LibraryRow,
  searchLibrary,
} from '#/lib/library'
import { MUSCLE_LABEL, MUSCLES } from '#/lib/logic/stats'
import { rowTap } from '#/lib/row-tap'
import type { Muscle } from '#/lib/types'
import { useContent } from '#/lib/use-content'
import { useCues } from '#/lib/use-cues'
import { cn } from '#/lib/utils'
import { EditorPanel, PanelFooter } from './editor-panel'

// ---------------------------------------------------------------- list with search and filters

/** A filter tag: a pill that fills in when pressed. One per row is pressed; "All" means no filter. */
const chip =
  'shrink-0 rounded-full px-3 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background'
/** One line of tags inside the scroll area; it must not shrink or wrap. */
const row = 'w-max justify-start py-0.5'

/** A small label over one line of tags that scrolls sideways. */
function TagRow({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <p className="mb-1 text-muted-foreground">{label}</p>
      <ScrollArea className="-mx-4">
        <div className="px-4 pb-2">{children}</div>
        <ScrollBar orientation="horizontal" className="mx-4 h-2" />
      </ScrollArea>
    </div>
  )
}

interface ListProps {
  onSelect: (ex: LibraryRow) => void
  /** What the button on each row says: "Open" on the library page, "Use" in the picker. */
  action?: 'Open' | 'Use'
  /** Focus the search box when the list appears. */
  autoFocus?: boolean
  /** Keep the search box pinned to the top of the scrolling area while the tags and rows scroll under it. */
  stickySearch?: boolean
  /** The rows in view after search and filters, so the detail view can step through them. */
  onResults?: (results: LibraryRow[]) => void
}

export function LibraryList({ onSelect, action = 'Open', autoFocus, stickySearch, onResults }: ListProps) {
  const { library } = useContent()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | 'any'>('any')
  const [equipment, setEquipment] = useState<Equipment | 'any'>('any')
  const results = useMemo(
    () =>
      searchLibrary(
        {
          query,
          muscle: muscle === 'any' ? undefined : muscle,
          equipment: equipment === 'any' ? undefined : equipment,
        },
        library,
      ),
    [library, query, muscle, equipment],
  )
  useEffect(() => {
    onResults?.(results)
  }, [results, onResults])

  return (
    // min-w-0: inside a dialog this is a grid item, and the scrolling tag rows must not set its width.
    <div className="min-w-0">
      {/* Sticky: pt-1 and the side margin leave room for the focus ring, which the background would cover. */}
      <div className={cn('pb-3', stickySearch && 'sticky top-0 z-10 -mx-1 bg-background px-1 pt-1')}>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, muscle or equipment"
          aria-label="Search the library"
          autoFocus={autoFocus}
          className="h-11 text-base"
        />
      </div>
      <TagRow label="Muscle">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={2}
          value={muscle}
          onValueChange={(v) => v && setMuscle(v as Muscle | 'any')}
          aria-label="Muscle"
          className={row}
        >
          <ToggleGroupItem value="any" className={chip}>
            All
          </ToggleGroupItem>
          {MUSCLES.map((m) => (
            <ToggleGroupItem key={m} value={m} className={chip}>
              {MUSCLE_LABEL[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </TagRow>
      <TagRow label="Equipment" className="mt-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={2}
          value={equipment}
          onValueChange={(v) => v && setEquipment(v as Equipment | 'any')}
          aria-label="Equipment"
          className={row}
        >
          <ToggleGroupItem value="any" className={chip}>
            All
          </ToggleGroupItem>
          {EQUIPMENT.map((e) => (
            <ToggleGroupItem key={e} value={e} className={chip}>
              {EQUIPMENT_LABEL[e]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </TagRow>
      {results.length === 0 ? (
        <Empty className="mt-4 border border-dashed py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nothing matches</EmptyTitle>
            <EmptyDescription>Try fewer words, or clear a filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="mt-3 text-muted-foreground">
            {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
          </p>
          <Rows results={results} action={action} onSelect={onSelect} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the rows, only those in view

/** A row's height: the thumbnail and its padding, plus the line above every row but the first. */
const ROW = 81

interface RowsProps {
  results: LibraryRow[]
  action: 'Open' | 'Use'
  onSelect: (ex: LibraryRow) => void
}

/** The nearest ancestor that scrolls (a dialog or a drawer), or null when the page itself does. */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

/**
 * Only the rows in view are drawn (TanStack Virtual), so a long list costs what a short one does. The list scrolls
 * with the page on the Library screen and inside the panel in Pick from library and Swap; which it is, the list
 * finds out from its ancestors once mounted, then hands the matching virtualizer the rows. Until then, and until
 * the virtualizer has measured, the first rows are drawn as they are: the server's HTML and the first frame show
 * rows, not a count over nothing.
 */
function Rows(props: RowsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [scroller, setScroller] = useState<HTMLElement | null>()
  useLayoutEffect(() => {
    if (ref.current) setScroller(scrollParentOf(ref.current))
  }, [])
  return (
    <div ref={ref}>
      {scroller === undefined ? (
        <FirstRows {...props} />
      ) : scroller ? (
        <PanelRows scroller={scroller} {...props} />
      ) : (
        <WindowRows {...props} />
      )}
    </div>
  )
}

/** As many rows as a tall screen shows before any scrolling. */
const FIRST = 12

function FirstRows({ results, action, onSelect }: RowsProps) {
  return (
    <ItemGroup className="mt-1 divide-y border-y">
      {results.slice(0, FIRST).map((ex) => (
        <ExerciseItem key={ex.id} ex={ex} action={action} onSelect={onSelect} />
      ))}
    </ItemGroup>
  )
}

function ExerciseItem({ ex, action, onSelect }: { ex: LibraryRow } & Pick<RowsProps, 'action' | 'onSelect'>) {
  return (
    <Item
      size="sm"
      className={cn('px-1', rowTap(() => onSelect(ex)).className)}
      onClick={rowTap(() => onSelect(ex)).onClick}
    >
      <ItemMedia variant="image" className="size-14 rounded-md bg-muted">
        <img src={imageUrl(ex)} alt="" loading="lazy" width={56} height={56} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{ex.name}</ItemTitle>
        <ItemDescription>
          {MUSCLE_LABEL[ex.muscle]}, {EQUIPMENT_LABEL[ex.equipment].toLowerCase()}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          type="button"
          variant={action === 'Use' ? 'secondary' : 'outline'}
          size="sm"
          aria-label={`${action} ${ex.name}`}
          onClick={() => onSelect(ex)}
        >
          {action}
        </Button>
      </ItemActions>
    </Item>
  )
}

function WindowRows(props: RowsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  // Where the list starts on the page: the search box, the tags and the count sit above it.
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = listRef.current
    if (el) setTop(el.getBoundingClientRect().top + window.scrollY)
  }, [])
  const virtualizer = useWindowVirtualizer({
    count: props.results.length,
    estimateSize: () => ROW,
    overscan: 6,
    scrollMargin: top,
  })
  return <RowList listRef={listRef} virtualizer={virtualizer} {...props} />
}

function PanelRows({ scroller, ...props }: RowsProps & { scroller: HTMLElement }) {
  const listRef = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = listRef.current
    if (el) setTop(el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop)
  }, [scroller])
  const virtualizer = useVirtualizer({
    count: props.results.length,
    getScrollElement: () => scroller,
    estimateSize: () => ROW,
    overscan: 6,
    scrollMargin: top,
  })
  return <RowList listRef={listRef} virtualizer={virtualizer} {...props} />
}

function RowList({
  listRef,
  virtualizer,
  results,
  action,
  onSelect,
}: RowsProps & {
  listRef: RefObject<HTMLDivElement | null>
  virtualizer: Virtualizer<Window, Element> | Virtualizer<HTMLElement, Element>
}) {
  const items = virtualizer.getVirtualItems()
  if (items.length === 0 && results.length > 0) {
    return (
      <div ref={listRef}>
        <FirstRows results={results} action={action} onSelect={onSelect} />
      </div>
    )
  }
  return (
    <ItemGroup ref={listRef} className="relative mt-1 border-y" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((item) => {
        const ex = results[item.index]
        return (
          <div
            key={ex.id}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className={cn('absolute inset-x-0 top-0', item.index > 0 && 'border-t')}
            style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
          >
            <ExerciseItem ex={ex} action={action} onSelect={onSelect} />
          </div>
        )
      })}
    </ItemGroup>
  )
}

// ---------------------------------------------------------------- one exercise

interface DetailProps {
  exercise: LibraryRow | null
  onClose: () => void
  /** Rendered under the cues, for a "Use this" button. */
  action?: ReactNode
  /** The list the exercise came from. Given, the view gets Previous and Next. */
  among?: LibraryRow[]
  onStep?: (ex: LibraryRow) => void
}

/**
 * The source's two photographs, the start and the end of the movement: a swipe, a drag or the arrows step between
 * them. The drawer must not take the swipe for a pull-down.
 */
function Pictures({ exercise }: { exercise: LibraryRow }) {
  const [api, setApi] = useState<CarouselApi>()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!api) return
    const sync = () => setFrame(api.selectedScrollSnap())
    sync()
    api.on('select', sync)
    return () => {
      api.off('select', sync)
    }
  }, [api])
  return (
    <Carousel data-vaul-no-drag setApi={setApi} className="overflow-hidden rounded-lg bg-muted">
      <CarouselContent className="ml-0">
        {FRAMES.map((f) => (
          <CarouselItem key={f} className="pl-0">
            <img
              src={imageUrl(exercise, f)}
              alt={`${exercise.name}, ${FRAME_LABEL[f]}`}
              className="max-h-56 w-full object-cover md:max-h-none md:aspect-square"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious aria-label="Previous picture" className="left-2" />
      <CarouselNext aria-label="Next picture" className="right-2" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {FRAMES.map((f, i) => (
          <span
            key={f}
            className={cn(
              'size-2 rounded-full border border-background/60 bg-foreground/70',
              i !== frame && 'opacity-40',
            )}
          />
        ))}
      </div>
    </Carousel>
  )
}

function describe(ex: LibraryRow): string {
  const level = ex.level[0].toUpperCase() + ex.level.slice(1)
  return `${MUSCLE_LABEL[ex.muscle]}. ${EQUIPMENT_LABEL[ex.equipment]}. ${level}.`
}

/**
 * Pictures and cues for one exercise, in a bottom drawer on phones and a dialog from tablets up. The cues are fetched
 * as it opens; lines stand in for them meanwhile.
 */
export function LibraryDetail({ exercise, onClose, action, among, onStep }: DetailProps) {
  const cues = useCues(exercise?.id)
  const at = exercise && among ? among.findIndex((e) => e.id === exercise.id) : -1
  const prev = among && at > 0 ? among[at - 1] : undefined
  const next = among && at >= 0 && at < among.length - 1 ? among[at + 1] : undefined
  return (
    <EditorPanel
      open={exercise !== null}
      onClose={onClose}
      title={exercise?.name ?? ''}
      description={exercise ? describe(exercise) : ''}
      width="lg"
    >
      {exercise && (
        <div className="px-4 pb-4">
          <div className="md:grid md:grid-cols-[16rem_1fr] md:items-start md:gap-5">
            {/* Keyed, so the next exercise opens on its start position. */}
            <Pictures key={exercise.id} exercise={exercise} />
            {/* A fixed height from tablets up, so the dialog does not jump between exercises. */}
            <div className="md:h-64 md:overflow-y-auto md:scrollbar-none">
              {cues === null ? (
                <div className="mt-4 flex flex-col gap-3 md:mt-0" aria-busy="true">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : (
                <ol className="mt-4 list-decimal space-y-2 pl-5 md:mt-0">
                  {cues.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
              )}
              <p className="mt-4 text-muted-foreground">Works: {exercise.muscles.join(', ')}.</p>
            </div>
          </div>
          {action && <div className="mt-5">{action}</div>}
          {among && onStep && (
            <PanelFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!prev}
                aria-label={prev ? `Previous, ${prev.name}` : 'Previous'}
                onClick={() => prev && onStep(prev)}
              >
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <span className="flex-1 text-center tabular-nums text-muted-foreground">
                {at + 1} of {among.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!next}
                aria-label={next ? `Next, ${next.name}` : 'Next'}
                onClick={() => next && onStep(next)}
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            </PanelFooter>
          )}
        </div>
      )}
    </EditorPanel>
  )
}

// ---------------------------------------------------------------- picker

interface PickerProps {
  onPick: (ex: LibraryRow) => void
  trigger?: ReactNode
}

/** "Pick from library": a searchable dialog; tapping an exercise hands it back and closes. */
export function LibraryPicker({ onPick, trigger }: PickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
            <BookOpen aria-hidden />
            Pick from library
          </Button>
        )}
      </DialogTrigger>
      {/* The title and the close button stay put; the search, tags and list scroll beneath them. */}
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle>Pick from library</DialogTitle>
          <DialogDescription className="sr-only">Search, then use an exercise.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-6 pb-6">
          <LibraryList
            autoFocus
            stickySearch
            action="Use"
            onSelect={(ex) => {
              onPick(ex)
              setOpen(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
