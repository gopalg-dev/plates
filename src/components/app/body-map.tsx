import { BACK_FIGURE, FRONT_FIGURE, type BodyFigure } from '#/lib/body-figures'
import { MUSCLE_LABEL } from '#/lib/logic/stats'
import type { Muscle } from '#/lib/types'
import { cn } from '#/lib/utils'

/**
 * Two figures, front and back, with the nine muscles the app tracks drawn as regions and labelled
 * with the week's hard sets against the plan. Each region is coloured by that count: grey when the
 * plan does not call for it, red when it does and nothing is logged yet, green deepening towards
 * the plan's number.
 */

/** The colour of a region: what was done this week against what the plan asks. */
export function regionPaint(
  done: number,
  target: number,
): { fill: string; opacity: number; state: 'off' | 'due' | 'on' } {
  if (done <= 0 && target <= 0) return { fill: 'var(--muted-foreground)', opacity: 0.32, state: 'off' }
  if (done <= 0) return { fill: 'var(--destructive)', opacity: 0.55, state: 'due' }
  const share = target > 0 ? Math.min(1, done / target) : 1
  return { fill: 'var(--success)', opacity: 0.4 + 0.6 * share, state: 'on' }
}

/** The figure's own box; labels sit in the margins either side. */
const FIGURE_W = 1000
const FIGURE_H = 2200
const MARGIN = 720
const VIEWBOX = `${-MARGIN} 0 ${FIGURE_W + 2 * MARGIN} ${FIGURE_H}`

/** Which side a muscle's label sits on, per figure, so labels never collide. */
const LABEL_SIDE: Record<'front' | 'back', Partial<Record<Muscle, 'left' | 'right'>>> = {
  front: { shoulders: 'left', chest: 'right', biceps: 'left', abs: 'right', quads: 'left', triceps: 'right' },
  back: { back: 'right', shoulders: 'left', triceps: 'left', hamstrings: 'right', calves: 'left' },
}

function centroid(points: string): { x: number; y: number } {
  const nums = points.trim().split(/\s+/).map(Number)
  let x = 0
  let y = 0
  for (let i = 0; i < nums.length; i += 2) {
    x += nums[i]
    y += nums[i + 1]
  }
  const n = nums.length / 2
  return { x: x / n, y: y / n }
}

/** Where a label's leader line lands: the middle of the region's outermost polygon on the label's side. */
function anchorOf(polys: string[], side: 'left' | 'right'): { x: number; y: number } {
  const cs = polys.map(centroid)
  return cs.reduce((best, c) => (side === 'left' ? (c.x < best.x ? c : best) : c.x > best.x ? c : best))
}

/** The seams between parts, in the page colour, so the figure reads as a body and not a blob. */
const seam = { stroke: 'var(--background)', strokeWidth: 6, strokeLinejoin: 'round' as const }

interface FigureProps {
  side: 'front' | 'back'
  figure: BodyFigure
  done: Record<Muscle, number>
  target: Record<Muscle, number>
  picked: Muscle | null
  onPick?: (m: Muscle) => void
  className?: string
}

function Figure({ side, figure, done, target, picked, onPick, className }: FigureProps) {
  const muscles = Object.keys(figure.regions) as Muscle[]
  // Labels keep a minimum gap down each side: a crowded side nudges later labels down.
  const placed = new Map<Muscle, { lx: number; ly: number; ax: number; ay: number; sideOf: 'left' | 'right' }>()
  for (const s of ['left', 'right'] as const) {
    let lastY = -Infinity
    const onSide = muscles
      .filter((m) => LABEL_SIDE[side][m] === s)
      .map((m) => ({ m, a: anchorOf(figure.regions[m]!, s) }))
      .sort((p, q) => p.a.y - q.a.y)
    for (const { m, a } of onSide) {
      const ly = Math.max(a.y, lastY + 230)
      lastY = ly
      placed.set(m, { lx: s === 'left' ? -MARGIN + 20 : FIGURE_W + MARGIN - 20, ly, ax: a.x, ay: a.y, sideOf: s })
    }
  }
  return (
    <figure className={cn('flex w-full flex-col items-center gap-2', className)}>
      <svg
        viewBox={VIEWBOX}
        className="h-auto w-full max-w-[22rem]"
        role="group"
        aria-label={side === 'front' ? 'Front' : 'Back'}
      >
        {figure.body.map((points) => (
          <polygon key={points} points={points} fill="var(--muted-foreground)" fillOpacity={0.2} {...seam} />
        ))}
        {muscles.map((m) => {
          const paint = regionPaint(done[m], target[m])
          const label = `${MUSCLE_LABEL[m]}: ${done[m]} of ${target[m]} sets`
          const isPicked = picked === m
          const at = placed.get(m)
          return (
            <g
              key={m}
              role={onPick ? 'button' : undefined}
              tabIndex={onPick ? 0 : undefined}
              aria-label={label}
              aria-pressed={onPick ? isPicked : undefined}
              className={cn(onPick && 'cursor-pointer outline-none')}
              onClick={() => onPick?.(m)}
              onKeyDown={(e) => {
                if (onPick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onPick(m)
                }
              }}
            >
              {figure.regions[m]!.map((points) => (
                <polygon
                  key={points}
                  points={points}
                  fill={paint.fill}
                  fillOpacity={paint.opacity}
                  {...seam}
                  stroke={isPicked ? 'var(--foreground)' : seam.stroke}
                  strokeWidth={isPicked ? 12 : seam.strokeWidth}
                />
              ))}
              {at && (
                <>
                  <line
                    x1={at.sideOf === 'left' ? at.lx + 420 : at.lx - 420}
                    y1={at.ly - 20}
                    x2={at.ax}
                    y2={at.ay}
                    stroke="var(--muted-foreground)"
                    strokeWidth={4}
                    strokeOpacity={0.6}
                  />
                  <text
                    x={at.lx}
                    y={at.ly - 40}
                    textAnchor={at.sideOf === 'left' ? 'start' : 'end'}
                    fontSize={104}
                    fontWeight={isPicked ? 600 : 500}
                    fill="var(--foreground)"
                  >
                    {MUSCLE_LABEL[m]}
                  </text>
                  <text
                    x={at.lx}
                    y={at.ly + 60}
                    textAnchor={at.sideOf === 'left' ? 'start' : 'end'}
                    fontSize={96}
                    fill={paint.state === 'due' ? 'var(--destructive)' : 'var(--muted-foreground)'}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {done[m]} of {target[m]}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {side === 'front' ? 'Front' : 'Back'}
      </figcaption>
    </figure>
  )
}

export interface BodyMapProps {
  done: Record<Muscle, number>
  target: Record<Muscle, number>
  picked: Muscle | null
  onPick: (m: Muscle) => void
  className?: string
}

/** Front and back, side by side where there is room; a tap on a muscle picks it. */
export function BodyMap({ done, target, picked, onPick, className }: BodyMapProps) {
  return (
    <div className={cn('grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2', className)}>
      <Figure side="front" figure={FRONT_FIGURE} done={done} target={target} picked={picked} onPick={onPick} />
      <Figure side="back" figure={BACK_FIGURE} done={done} target={target} picked={picked} onPick={onPick} />
    </div>
  )
}

const LEGEND: { state: 'on' | 'due' | 'off'; label: string }[] = [
  { state: 'on', label: 'Trained' },
  { state: 'due', label: 'Planned, not yet' },
  { state: 'off', label: 'Not in the plan' },
]

/** Three swatches that say what the colours mean. */
export function BodyMapLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground', className)}>
      {LEGEND.map(({ state, label }) => {
        const paint = state === 'on' ? regionPaint(1, 1) : state === 'due' ? regionPaint(0, 1) : regionPaint(0, 0)
        return (
          <li key={state} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: paint.fill, opacity: paint.opacity }}
              aria-hidden
            />
            {label}
          </li>
        )
      })}
    </ul>
  )
}
