import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, FileChartColumn, Scale, TrendingDown, X } from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import type { Alert } from '#/lib/logic/alerts'
import { cn } from '#/lib/utils'

/*
 * The Today alerts as a slideshow: one card at a time, the rest behind dots. Swipe left or right (finger or
 * cursor) or use the arrows to move between them; each card carries its own action, and a × dismisses it. One card
 * tall, so a handful of alerts never push the session off the screen, and the count keeps them from going unseen.
 */

const ICON: Record<Alert['kind'], typeof TrendingDown> = {
  stall: TrendingDown,
  weight: Scale,
  review: FileChartColumn,
}
/** What the action button on each kind of alert says. */
const ACTION: Record<Alert['kind'], string> = {
  stall: 'Swap on Plan',
  weight: 'See weight',
  review: 'See report',
}
/** How far along the card must be dragged to move to the next: a fifth of its width. */
const THRESHOLD = 0.2

export function AlertDeck({
  alerts,
  onDismiss,
  onAction,
}: {
  alerts: Alert[]
  onDismiss: (key: string) => void
  /** Given, the action is a button calling this instead of a link; the demo uses it to stay in its own window. */
  onAction?: (alert: Alert) => void
}) {
  const [index, setIndex] = useState(0)
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; w: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const count = alerts.length
  const at = Math.min(index, Math.max(0, count - 1))
  if (count === 0) return null

  const offset = (dx = 0) => `translateX(${-at * (viewport.current?.clientWidth ?? 0) + dx}px)`
  const go = (to: number) => setIndex(Math.max(0, Math.min(count - 1, to)))

  function start(e: ReactPointerEvent<HTMLDivElement>) {
    if (count <= 1 || (e.target as HTMLElement).closest('a, button')) return
    drag.current = { x: e.clientX, w: viewport.current?.clientWidth ?? 0 }
    setDragging(true)
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || !track.current) return
    let dx = e.clientX - drag.current.x
    // Resist at the ends, so the strip never drags past the first or last card.
    if ((at === 0 && dx > 0) || (at === count - 1 && dx < 0)) dx *= 0.3
    track.current.style.transform = offset(dx)
  }
  function end(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    drag.current = null
    setDragging(false)
    const dx = e.clientX - d.x
    if (Math.abs(dx) > d.w * THRESHOLD) go(dx < 0 ? at + 1 : at - 1)
    else if (track.current) track.current.style.transform = offset(0)
  }

  function dismiss(i: number) {
    if (i <= at && at > 0) setIndex(at - 1)
    onDismiss(alerts[i].key)
  }

  return (
    <section aria-label="Needs a look" className="mt-5">
      <div
        ref={viewport}
        className="overflow-hidden rounded-xl"
        style={{ touchAction: 'pan-y', cursor: count > 1 ? (dragging ? 'grabbing' : 'grab') : undefined }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div
          ref={track}
          className={cn(
            'flex',
            !dragging && 'transition-transform duration-300 ease-out motion-reduce:transition-none',
          )}
          style={{ transform: offset(0) }}
        >
          {alerts.map((a, i) => {
            const Icon = ICON[a.kind]
            const active = i === at
            return (
              <div key={a.key} className="w-full shrink-0 px-px">
                <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <Icon
                      className={cn(
                        'mt-0.5 size-5 shrink-0',
                        a.kind === 'stall' ? 'text-destructive' : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{a.title}</p>
                      <p className="mt-0.5 text-muted-foreground">{a.detail}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="-mt-1 -mr-1 shrink-0 text-muted-foreground pointer-coarse:size-9"
                      aria-label={`Dismiss: ${a.title}`}
                      tabIndex={active ? undefined : -1}
                      onClick={() => dismiss(i)}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                  {onAction ? (
                    <Button
                      size="sm"
                      className="w-full sm:w-auto sm:self-end sm:px-5"
                      tabIndex={active ? undefined : -1}
                      onClick={() => onAction(a)}
                    >
                      {ACTION[a.kind]}
                    </Button>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      className="w-full sm:w-auto sm:self-end sm:px-5"
                      tabIndex={active ? undefined : -1}
                    >
                      <Link to={a.to}>{ACTION[a.kind]}</Link>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {count > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous alert"
            disabled={at === 0}
            onClick={() => go(at - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <div className="flex gap-1.5" aria-hidden>
            {alerts.map((a) => (
              <span
                key={a.key}
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  a.key === alerts[at].key ? 'bg-foreground' : 'bg-border',
                )}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next alert"
            disabled={at === count - 1}
            onClick={() => go(at + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
    </section>
  )
}
