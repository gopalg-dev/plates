import { ArrowDown, ArrowUp, ListRestart, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { FieldLabel } from '#/components/ui/field'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import type { SplitInfo } from '#/lib/content'
import { WEEK_ORDER, WEEKDAY_LONG, weekdayOf } from '#/lib/logic/schedule'
import { plannedSetsFor } from '#/lib/logic/stats'
import { rowTap } from '#/lib/row-tap'
import { type Exercise, MAX_EXERCISES_PER_DAY, type PlanDay, type Schedule, type Settings } from '#/lib/types'
import { DayIcon } from './day-mark'
import { targetOf } from './exercise-row'
import { ExerciseThumb } from './exercise-thumb'
import { SortableList } from './sortable-list'

/*
 * The pieces of the Plan screen, shared by the Plan page and the demo on How it works: the title, and each day with
 * its exercises. Change them here and both follow.
 */

/** "Plan", and under it the split it came from and how many days it has. */
export function PlanTitle({
  split,
  dayCount,
  schedule,
}: {
  split: Pick<SplitInfo, 'name' | 'days'>
  dayCount: number
  schedule: Schedule
}) {
  return (
    <>
      <h1 className="font-condensed text-4xl font-semibold leading-none">Plan</h1>
      <p className="mt-2 text-muted-foreground">
        {/* A template whose name already says its days ("Push / Pull / Legs, 3 days") is not told twice. */}
        {/\d+ days$/.test(split.name) && split.days === dayCount
          ? split.name
          : `${split.name}, ${dayCount} ${dayCount === 1 ? 'day' : 'days'}`}
        {schedule === 'weekday' ? ' by weekday' : ''}
      </p>
    </>
  )
}

export interface DayProps {
  day: PlanDay
  settings: Settings
  schedule: Schedule
  position: 'first' | 'middle' | 'last'
  onlyDay: boolean
  onEdit: (exercise: Exercise) => void
  onAdd: () => void
  /** The day's exercise ids in the template's order, for Restore default order. */
  defaultOrder: string[]
  onReorder: (order: string[]) => Promise<void>
  onWeekday: (weekday: number) => void
  onRename: () => void
  onMove: (direction: 'up' | 'down') => void
  onRemove: () => void
  /** A session of this day is in progress: the day says so. */
  inProgress?: boolean
}

/** One day of the plan, as an accordion item: its exercises to edit, reorder and add to, and its menu. */
export function DaySection({
  day,
  settings,
  schedule,
  position,
  onlyDay,
  onEdit,
  onAdd,
  defaultOrder,
  onReorder,
  onWeekday,
  onRename,
  onMove,
  onRemove,
  inProgress = false,
}: DayProps) {
  const full = day.exercises.length >= MAX_EXERCISES_PER_DAY
  const sets = day.exercises.reduce((n, e) => n + plannedSetsFor(e.sets, settings.trainingAge), 0)
  const onWeekdays = schedule === 'weekday' && day.weekday !== undefined
  const inDefault = defaultOrder.every((id, i) => day.exercises[i]?.id === id)
  return (
    <AccordionItem value={day.id}>
      <AccordionTrigger className="items-center gap-3 py-4 text-base font-normal hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0">
        <DayIcon type={day.type} className="size-10" />
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="font-condensed text-2xl font-semibold leading-none">{day.name}</span>
            {inProgress && <Badge variant="secondary">In progress</Badge>}
          </span>
          <span className="mt-1 block text-muted-foreground">
            {day.exercises.length} exercises, {sets} sets
            {onWeekdays ? `, ${weekdayOf(day)}s` : ''}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-3 text-base">
        <div className="mb-2 flex items-center justify-end px-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={`${day.name} options`}>
                <MoreHorizontal aria-hidden />
                Day
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={onRename}>
                <Pencil aria-hidden />
                Rename or change kind
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove('up')} disabled={position === 'first'}>
                <ArrowUp aria-hidden />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove('down')} disabled={position === 'last'}>
                <ArrowDown aria-hidden />
                Move down
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onReorder(defaultOrder)} disabled={inDefault}>
                <ListRestart aria-hidden />
                Restore default order
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove} disabled={onlyDay}>
                <Trash2 aria-hidden />
                Remove day
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {schedule === 'weekday' && (
          <div className="mb-3 flex items-center gap-3 px-2">
            <FieldLabel htmlFor={`weekday-${day.id}`} className="text-muted-foreground">
              On
            </FieldLabel>
            <Select value={String(day.weekday ?? 1)} onValueChange={(v) => onWeekday(Number(v))}>
              <SelectTrigger id={`weekday-${day.id}`} size="sm" className="w-36" aria-label={`${day.name} weekday`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_ORDER.map((wd) => (
                  <SelectItem key={wd} value={String(wd)}>
                    {WEEKDAY_LONG[wd]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <ItemGroup>
          <SortableList id={`order-${day.id}`} items={day.exercises} nameOf={(ex) => ex.name} onReorder={onReorder}>
            {(ex, handle, i) => (
              <>
                {i > 0 && <ItemSeparator />}
                <Item size="sm" className="cursor-pointer pr-2 pl-0" onClick={rowTap(() => onEdit(ex)).onClick}>
                  {/* In an ItemMedia, so the grip moves to the top with the photo when a note makes the row tall. */}
                  <ItemMedia>{handle}</ItemMedia>
                  <ItemMedia variant="image">
                    <ExerciseThumb name={ex.name} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-base font-normal">{ex.name}</ItemTitle>
                    {ex.note && <ItemDescription>{ex.note}</ItemDescription>}
                  </ItemContent>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {plannedSetsFor(ex.sets, settings.trainingAge)} × {targetOf(ex)}
                  </span>
                  <ItemActions>
                    {/* Just the pencil on phones, where the row is short of room; the word comes back from 768px. */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="max-md:size-8 max-md:has-[>svg]:px-0"
                      aria-label={`Edit ${ex.name}`}
                      onClick={() => onEdit(ex)}
                    >
                      <Pencil aria-hidden />
                      <span className="max-md:sr-only">Edit</span>
                    </Button>
                  </ItemActions>
                </Item>
              </>
            )}
          </SortableList>
        </ItemGroup>
        <div className="mt-2 flex items-center justify-between gap-3 px-2">
          <span className="text-sm text-muted-foreground">
            {day.exercises.length} of {MAX_EXERCISES_PER_DAY} exercises
          </span>
          <Button variant="ghost" size="sm" aria-label={`Add exercise to ${day.name}`} onClick={onAdd} disabled={full}>
            <Plus aria-hidden />
            Add exercise
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
