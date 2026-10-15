import { Ruler, Scale } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, useActiveTooltipLabel, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '#/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { longDate, relativeDay, shortDate, signed } from '#/lib/format'
import { paceNote } from '#/lib/logic/goal'
import { daysBetween } from '#/lib/logic/nudges'
import { addDays, type BodyweightTrend } from '#/lib/logic/stats'
import { fmtWeight } from '#/lib/logic/units'
import type { BodyweightLog, Goal, MeasurementLog, Units } from '#/lib/types'
import { cn } from '#/lib/utils'
import { SectionHeading } from './section-heading'

/*
 * The Body tab of Stats, shared by the Stats page and the demo on How it works: bodyweight with its chart, and the
 * tape. The ways to log are passed in, so the demo can leave them out. Change them here and both follow.
 */

interface BodyTabProps {
  bw: BodyweightTrend
  bodyweights: BodyweightLog[]
  measurements: MeasurementLog[]
  units: Units
  lengthUnit: string
  now: Date
  goal: Goal | undefined
  /** The weigh-in button; absent in a demo. */
  logBodyweight?: ReactNode
  /** The tape button; absent in a demo. */
  logMeasurements?: ReactNode
  onPickWeight: (log: BodyweightLog) => void
  onPickTape: (log: MeasurementLog) => void
}

/** The Body tab: the latest weigh-in, its trend and chart, and the tape. */
export function BodyTab({
  bw,
  bodyweights,
  measurements,
  units,
  lengthUnit,
  now,
  goal,
  logBodyweight,
  logMeasurements,
  onPickWeight,
  onPickTape,
}: BodyTabProps) {
  return (
    <div className="mt-6 grid gap-10">
      <section aria-labelledby="bw-h">
        <SectionHeading id="bw-h" icon={Scale}>
          Bodyweight
        </SectionHeading>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-condensed text-6xl font-semibold leading-none tabular-nums">
                {bw.latest !== undefined ? fmtWeight(bw.latest) : '–'}
              </span>
              <span className="text-muted-foreground">{units}</span>
            </div>
            {bw.weekAvg !== undefined ? (
              <p className="mt-2 text-muted-foreground">
                7-day average {fmtWeight(bw.weekAvg, units)}
                {bw.changePct !== undefined
                  ? `, ${signed(bw.changePct, 1)}% vs last week. ${paceNote(bw.changePct, goal)}`
                  : ''}
              </p>
            ) : null}
            {bw.latestDate && (
              <p className="mt-1 text-muted-foreground">Last logged {relativeDay(bw.latestDate, now)}.</p>
            )}
          </div>
          {logBodyweight}
        </div>
        <BodyweightChart logs={bodyweights} units={units} now={now} onPick={onPickWeight} />
      </section>

      <section aria-labelledby="tape-h">
        <SectionHeading id="tape-h" icon={Ruler}>
          Measurements
        </SectionHeading>
        <Measurements logs={measurements} lengthUnit={lengthUnit} now={now} log={logMeasurements} onPick={onPickTape} />
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- bodyweight chart

type Range = '28' | '84' | 'all'

const bwConfig = {
  weight: { label: 'Bodyweight', color: 'var(--chart-1)' },
} satisfies ChartConfig

type ChartRow = { date: string; weight: number; log: BodyweightLog }

interface ChartProps {
  logs: BodyweightLog[]
  units: Units
  now: Date
  /** Called with the weigh-in under a tap or click, or under the keyboard cursor when Enter is pressed. */
  onPick: (log: BodyweightLog) => void
}

function BodyweightChart({ logs, units, now, onPick }: ChartProps) {
  const [range, setRange] = useState<Range>('84')
  const active = useRef<BodyweightLog | null>(null)
  const setActive = useCallback((log: BodyweightLog | null) => {
    active.current = log
  }, [])
  const data = useMemo<ChartRow[]>(() => {
    const since = range === 'all' ? null : addDays(now, -Number(range)).getTime()
    return logs
      .filter((l) => since === null || new Date(l.date).getTime() >= since)
      .map((l) => ({ date: l.date, weight: l.weight, log: l }))
  }, [logs, range, now])

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {data.length === 0 ? 'No weigh-ins in this range.' : `${data.length} ${data.length === 1 ? 'log' : 'logs'}`}
        </p>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={range}
          onValueChange={(v) => v && setRange(v as Range)}
          aria-label="Chart range"
        >
          <ToggleGroupItem value="28">4 weeks</ToggleGroupItem>
          <ToggleGroupItem value="84">12 weeks</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {data.length > 0 && (
        <ChartContainer
          config={bwConfig}
          className="mt-3 aspect-[2/1] w-full md:aspect-[3/1]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && active.current) {
              e.preventDefault()
              onPick(active.current)
            }
          }}
        >
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            // Recharts sets cursor: default inline on its wrapper; the prop wins over it.
            style={{ cursor: 'pointer' }}
            onClick={(state) => {
              const row = data[Number(state.activeTooltipIndex)]
              if (row) onPick(row.log)
            }}
          >
            <ActivePoint rows={data} onChange={setActive} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tickFormatter={(v: string) => shortDate(v)}
            />
            <YAxis
              domain={['dataMin - 1', 'dataMax + 1']}
              width={40}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => fmtWeight(Math.round(v * 10) / 10)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => longDate(String(label))}
                  formatter={(value) => (
                    <span className="font-medium tabular-nums">{fmtWeight(Number(value), units)}</span>
                  )}
                />
              }
            />
            <Line
              dataKey="weight"
              type="monotone"
              stroke="var(--color-weight)"
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--color-weight)' }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  )
}

/** Remembers the point under the cursor or the keyboard focus so Enter can open it. Renders nothing. */
function ActivePoint<L>({ rows, onChange }: { rows: { date: string; log: L }[]; onChange: (log: L | null) => void }) {
  const label = useActiveTooltipLabel()
  useEffect(() => {
    onChange(rows.find((r) => r.date === label)?.log ?? null)
  }, [label, rows, onChange])
  return null
}

// ---------------------------------------------------------------- measurements

const TAPE_DAYS = 28
const SITES = ['arm', 'chest', 'waist'] as const

type Site = (typeof SITES)[number]
const SITE_LABEL: Record<Site, string> = { arm: 'Arm', chest: 'Chest', waist: 'Waist' }

/** One colour per site, on the line and on its switch: arm green, chest blue, waist yellow. */
const tapeConfig = {
  arm: { label: 'Arm', color: 'var(--chart-2)' },
  chest: { label: 'Chest', color: 'var(--chart-1)' },
  waist: { label: 'Waist', color: 'var(--chart-3)' },
} satisfies ChartConfig

type TapeRow = { date: string; value: number; log: MeasurementLog }
type TapeRange = '182' | '365' | 'all'

/**
 * One site at a time, in its own centimetres, laid out like the bodyweight chart: a switch picks
 * arm, chest or waist, a range narrows the tapes, and a tap on a point opens that tape.
 */
function MeasurementsChart({
  logs,
  lengthUnit,
  now,
  onPick,
  action,
}: {
  logs: MeasurementLog[]
  lengthUnit: string
  now: Date
  onPick: (log: MeasurementLog) => void
  /** The "Log measurements" button, on the same row as the site switch. */
  action: ReactNode
}) {
  const [site, setSite] = useState<Site>('arm')
  const [range, setRange] = useState<TapeRange>('365')
  const active = useRef<MeasurementLog | null>(null)
  const setActive = useCallback((log: MeasurementLog | null) => {
    active.current = log
  }, [])
  const data = useMemo<TapeRow[]>(() => {
    const since = range === 'all' ? null : addDays(now, -Number(range)).getTime()
    return logs
      .filter((l) => since === null || new Date(l.date).getTime() >= since)
      .flatMap((l) => {
        const value = l[site]
        return value === undefined ? [] : [{ date: l.date, value, log: l }]
      })
  }, [logs, range, site, now])
  const first = data[0]
  const last = data[data.length - 1]
  const summary =
    first && last ? `${SITE_LABEL[site]} ${first.value} to ${last.value} ${lengthUnit} over ${data.length} tapes.` : ''

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={site}
          onValueChange={(v) => v && setSite(v as Site)}
          aria-label="Tape site"
          className="w-full max-w-xs"
        >
          {SITES.map((s) => (
            <ToggleGroupItem key={s} value={s} className="flex-1 gap-2">
              <span aria-hidden className="size-2 rounded-full" style={{ background: tapeConfig[s].color }} />
              {SITE_LABEL[s]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {action}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {data.length === 0 ? 'No tapes in this range.' : `${data.length} ${data.length === 1 ? 'tape' : 'tapes'}`}
        </p>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={range}
          onValueChange={(v) => v && setRange(v as TapeRange)}
          aria-label="Tape chart range"
        >
          <ToggleGroupItem value="182">6 months</ToggleGroupItem>
          <ToggleGroupItem value="365">1 year</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {data.length > 0 && (
        <ChartContainer
          config={tapeConfig}
          className="mt-3 aspect-[2/1] w-full md:aspect-[3/1]"
          role="img"
          aria-label={summary}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && active.current) {
              e.preventDefault()
              onPick(active.current)
            }
          }}
        >
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            style={{ cursor: 'pointer' }}
            onClick={(state) => {
              const row = data[Number(state.activeTooltipIndex)]
              if (row) onPick(row.log)
            }}
          >
            <ActivePoint rows={data} onChange={setActive} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tickFormatter={(v: string) => shortDate(v)}
            />
            <YAxis
              domain={['dataMin - 1', 'dataMax + 1']}
              width={40}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => String(Math.round(v * 10) / 10)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => longDate(String(label))}
                  formatter={(value) => (
                    <span className="font-medium tabular-nums">
                      {Number(value)} {lengthUnit}
                    </span>
                  )}
                />
              }
            />
            <Line
              dataKey="value"
              name={SITE_LABEL[site]}
              type="monotone"
              stroke={`var(--color-${site})`}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0, fill: `var(--color-${site})` }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  )
}

function Measurements({
  logs,
  lengthUnit,
  now,
  log,
  onPick,
}: {
  logs: MeasurementLog[]
  lengthUnit: string
  now: Date
  /** The tape button; absent in a demo. */
  log?: ReactNode
  /** Called with the tape under a tap on the chart, or under the keyboard cursor when Enter is pressed. */
  onPick: (log: MeasurementLog) => void
}) {
  const last = logs.at(-1)
  const prev = logs.at(-2)
  if (!last) {
    return (
      <div className="mt-3">
        <p className="text-muted-foreground">
          No tape yet. Arm, chest and waist set the baseline. Then every {TAPE_DAYS} days.
        </p>
        <div className="mt-3">{log}</div>
      </div>
    )
  }
  const due = addDays(new Date(last.date), TAPE_DAYS)
  const overdue = due.getTime() <= now.getTime()
  const ago = daysBetween(last.date, now)
  return (
    <div className="mt-3">
      <dl className="grid grid-cols-3 gap-3">
        {SITES.map((site) => {
          const value = last[site]
          const before = prev?.[site]
          const delta = value !== undefined && before !== undefined ? value - before : undefined
          const good = delta !== undefined && (site === 'waist' ? delta < 0 : delta > 0)
          return (
            <div key={site}>
              <dt className="text-muted-foreground capitalize">{site}</dt>
              <dd className="font-condensed text-3xl font-semibold leading-none tabular-nums">
                {value ?? '–'}
                <span className="ml-1 font-normal text-muted-foreground">{lengthUnit}</span>
              </dd>
              {delta !== undefined && (
                <dd className={cn('mt-1 tabular-nums', good ? 'text-success' : 'text-muted-foreground')}>
                  {signed(delta, 1)} vs last
                </dd>
              )}
            </div>
          )
        })}
      </dl>
      <p className="mt-3 text-muted-foreground">
        Last measured {longDate(last.date)}, {ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}.{' '}
        {overdue ? 'Tape day is due now.' : `Next tape day ${longDate(due.toISOString())}.`}
      </p>
      <MeasurementsChart logs={logs} lengthUnit={lengthUnit} now={now} onPick={onPick} action={log} />
    </div>
  )
}
