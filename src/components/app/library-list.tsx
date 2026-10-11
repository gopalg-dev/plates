import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '#/components/ui/button'
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
import { ScrollArea, ScrollBar } from '#/components/ui/scroll-area'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '#/components/ui/item'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  EQUIPMENT,
  EQUIPMENT_LABEL,
  imageUrl,
  searchLibrary,
  type Equipment,
  type LibraryExercise,
} from '#/lib/library'
import { MUSCLES, MUSCLE_LABEL } from '#/lib/logic/stats'
import type { Muscle } from '#/lib/types'
import { rowTap } from '#/lib/row-tap'
import { useContent } from '#/lib/use-content'
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
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <ScrollArea className="-mx-4">
        <div className="px-4 pb-2">{children}</div>
        <ScrollBar orientation="horizontal" className="mx-4 h-2" />
      </ScrollArea>
    </div>
  )
}

interface ListProps {
  onSelect: (ex: LibraryExercise) => void
  /** What the button on each row says: "Open" on the library page, "Use" in the picker. */
  action?: 'Open' | 'Use'
  /** Focus the search box when the list appears. */
  autoFocus?: boolean
  /** The rows in view after search and filters, so the detail view can step through them. */
  onResults?: (results: LibraryExercise[]) => void
}

export function LibraryList({ onSelect, action = 'Open', autoFocus, onResults }: ListProps) {
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
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, muscle or equipment"
        aria-label="Search the library"
        autoFocus={autoFocus}
        className="h-11 text-base"
      />
      <TagRow label="Muscle" className="mt-3">
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
          <p className="mt-3 text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
          </p>
          <ItemGroup className="mt-1 border-y">
            {results.map((ex, i) => (
              <div key={ex.id}>
                {i > 0 && <ItemSeparator />}
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
              </div>
            ))}
          </ItemGroup>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- one exercise

interface DetailProps {
  exercise: LibraryExercise | null
  onClose: () => void
  /** Rendered under the cues, for a "Use this" button. */
  action?: ReactNode
  /** The list the exercise came from. Given, the view gets Previous and Next. */
  among?: LibraryExercise[]
  onStep?: (ex: LibraryExercise) => void
}

function describe(ex: LibraryExercise): string {
  const level = ex.level[0].toUpperCase() + ex.level.slice(1)
  return `${MUSCLE_LABEL[ex.muscle]}. ${EQUIPMENT_LABEL[ex.equipment]}. ${level}.`
}

/** Picture and cues for one exercise, in a bottom drawer on phones and a dialog from tablets up. */
export function LibraryDetail({ exercise, onClose, action, among, onStep }: DetailProps) {
  const at = exercise && among ? among.findIndex((e) => e.id === exercise.id) : -1
  const prev = at > 0 ? among![at - 1] : undefined
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
            <img
              src={imageUrl(exercise)}
              alt={`${exercise.name}, starting position`}
              className="max-h-56 w-full rounded-lg bg-muted object-cover md:max-h-none md:aspect-square"
            />
            {/* A fixed height from tablets up, so the dialog does not jump between exercises. */}
            <div className="md:h-64 md:overflow-y-auto md:scrollbar-none">
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm md:mt-0">
                {exercise.cues.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
              <p className="mt-4 text-sm text-muted-foreground">Works: {exercise.muscles.join(', ')}.</p>
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
              <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">
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
  onPick: (ex: LibraryExercise) => void
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto scrollbar-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pick from library</DialogTitle>
          <DialogDescription className="sr-only">Search, then use an exercise.</DialogDescription>
        </DialogHeader>
        <LibraryList
          autoFocus
          action="Use"
          onSelect={(ex) => {
            onPick(ex)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
