import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { cn } from '#/lib/utils'

interface Props<T extends { id: string }> {
  /** Stable between the server and the client render: dnd-kit builds its aria ids from it. */
  id: string
  items: T[]
  /** What a row is called on its handle and in the screen-reader announcements. */
  nameOf: (item: T) => string
  /** Saves the new order. The list shows it straight away, then whatever `items` holds once this settles. */
  onReorder: (ids: string[]) => Promise<void>
  /** One row. Put `handle` where the drag grip goes; the rest of the row keeps its own taps. */
  children: (item: T, handle: ReactNode, index: number) => ReactNode
}

/**
 * A vertical list reordered by dragging each row's grip, or from the keyboard: focus a grip, Space to
 * lift, arrows to move, Space to drop, Escape to cancel. Only the grip starts a drag, so a swipe on
 * the rest of the row still scrolls the page.
 */
export function SortableList<T extends { id: string }>({ id, items, nameOf, onReorder, children }: Props<T>) {
  const [pending, setPending] = useState<T[] | null>(null)
  const shown = pending ?? items
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const indexOf = (key: UniqueIdentifier) => shown.findIndex((item) => item.id === key)
  const nameAt = (key: UniqueIdentifier) => {
    const item = shown[indexOf(key)]
    return item ? nameOf(item) : 'The row'
  }
  const place = (key: UniqueIdentifier) => `position ${indexOf(key) + 1} of ${shown.length}`
  // A drag starts over its own row, and that first "over" would talk over "Picked up": stay quiet for it.
  const justPicked = useRef(false)
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      justPicked.current = true
      return `Picked up ${nameAt(active.id)}, ${place(active.id)}.`
    },
    onDragOver: ({ active, over }) => {
      const first = justPicked.current
      justPicked.current = false
      if (!over || (first && over.id === active.id)) return undefined
      return `${nameAt(active.id)} is over ${place(over.id)}.`
    },
    onDragEnd: ({ active, over }) =>
      over ? `${nameAt(active.id)} dropped at ${place(over.id)}.` : `${nameAt(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Move cancelled. ${nameAt(active.id)} stays at ${place(active.id)}.`,
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const next = arrayMove(shown, indexOf(active.id), indexOf(over.id))
    setPending(next)
    try {
      await onReorder(next.map((item) => item.id))
    } finally {
      setPending(null)
    }
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={shown} strategy={verticalListSortingStrategy}>
        {shown.map((item, i) => (
          <SortableRow key={item.id} id={item.id} name={nameOf(item)}>
            {(handle) => children(item, handle, i)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, name, children }: { id: string; name: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Move ${name}`}
      className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 rounded-md bg-background shadow-md')}
    >
      {children(handle)}
    </div>
  )
}
