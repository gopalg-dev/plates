import { CalendarDays, CircleAlert, Flame, Gauge, Scale, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '#/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  compared,
  comparedWeight,
  type HistoryPoint,
  type PeriodDay,
  type PeriodKind,
  type Report,
  toneOf,
} from '#/lib/logic/report'
import { MUSCLE_LABEL } from '#/lib/logic/stats'
import { fmtWeight } from '#/lib/logic/units'
import type { Units } from '#/lib/types'
import { cn } from '#/lib/utils'
import { attentionLines, BestsList, EffortBar, PeriodCalendar, sets, TONE } from './report-parts'
import { SectionHeading } from './section-heading'

/*
 * The report's body, laid out the way the best-regarded training reports are, in the order a lifter asks: did I
 * show up (one big number, the days on a calendar, the run-up as a bar strip with this period in colour), what did
 * I get (tiles with their change), what should I do (needs attention), what went well (bests), where the work went
 * (muscles against the period before), how it felt (effort), and the body last.
 */

const RUN: ChartConfig = {
  past: { label: 'Before', color: 'var(--chart-5)' },
  current: { label: 'This period', color: 'var(--foreground)' },
}
const MUSCLE: ChartConfig = {
  now: { label: 'This period', color: 'var(--foreground)' },
  before: { label: 'Before', color: 'var(--chart-5)' },
}
const WEIGHT: ChartConfig = { weight: { label: 'Bodyweight', color: 'var(--chart-1)' } }

type Metric = 'sessions' | 'sets'
const METRIC_LABEL: Record<Metric, string> = { sessions: 'Sessions', sets: 'Hard sets' }

function Tile({
  value,
  label,
  change,
  tone,
}: {
  value: string
  label: string
  change: string
  tone: keyof typeof TONE
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-condensed text-4xl font-semibold leading-none tabular-nums">{value}</p>
      <p className={cn('mt-2 tabular-nums', TONE[tone])}>{change}</p>
    </div>
  )
}

/** The run-up as bars, the period's own in the foreground colour; a chip row picks what the bars count. */
function RunChart({ hist, kind }: { hist: HistoryPoint[]; kind: PeriodKind }) {
  const [metric, setMetric] = useState<Metric>('sessions')
  const data = hist.map((h) => ({ label: h.label, value: h[metric], current: h.current }))
  return (
    <div>
      <ChartContainer
        config={RUN}
        className="aspect-[5/2] w-full sm:max-w-2xl"
        role="img"
        aria-label={`${METRIC_LABEL[metric]}, last ${hist.length} ${kind === 'week' ? 'weeks' : 'months'}: ${hist
          .map((h) => `${h.label} ${h[metric]}`)
          .join(', ')}`}
      >
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
          <Bar dataKey="value" name={METRIC_LABEL[metric]} radius={4} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.current ? 'var(--color-current)' : 'var(--color-past)'} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={metric}
        onValueChange={(v) => v && setMetric(v as Metric)}
        className="mt-3"
        aria-label="What the bars count"
      >
        <ToggleGroupItem value="sessions" className="px-3">
          Sessions
        </ToggleGroupItem>
        <ToggleGroupItem value="sets" className="px-3">
          Hard sets
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

export function ReportDashboard({
  report,
  kind,
  hist,
  days,
  units,
  before,
}: {
  report: Report
  kind: PeriodKind
  hist: HistoryPoint[]
  days: PeriodDay[]
  units: Units
  before: string
}) {
  const { sessions, bodyweight } = report
  const unit = kind === 'week' ? 'week' : 'month'
  const lines = attentionLines(report, kind)
  const muscles = report.muscles.map((m) => ({
    muscle: MUSCLE_LABEL[m.muscle],
    now: sets(m.perWeek),
    before: sets(m.prevPerWeek),
    target: m.target,
  }))
  const weights = hist.flatMap((h) => (h.weight !== undefined ? [{ label: h.label, weight: h.weight }] : []))

  return (
    <div className="mt-8 flex flex-col gap-10">
      {/* Did I show up: one number first, the days it was, and the run-up to it. */}
      <section aria-label="Sessions">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-condensed text-7xl font-semibold leading-none tabular-nums">{sessions.done}</span>
          <span className="text-xl">of {sessions.planned} sessions</span>
        </p>
        <p className={cn('mt-2 tabular-nums', TONE[toneOf(sessions.done, sessions.prev)])}>
          {compared(sessions.done, sessions.prev, before)}
        </p>
        <PeriodCalendar days={days} kind={kind} className="mt-5 flex flex-col gap-3 sm:max-w-md" />
        <div className="mt-8">
          <p className="mb-2 flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            {kind === 'week' ? 'Last 8 weeks' : 'Last 6 months'}
          </p>
          <RunChart hist={hist} kind={kind} />
        </div>
      </section>

      {/* What did I get. */}
      <dl className="grid grid-cols-2 gap-3 sm:max-w-2xl md:grid-cols-3">
        <Tile
          label="Hard sets"
          value={String(report.sets.now)}
          change={compared(report.sets.now, report.sets.prev, before)}
          tone={toneOf(report.sets.now, report.sets.prev)}
        />
        <Tile
          label="New bests"
          value={String(report.bests.length)}
          change={compared(report.bests.length, report.prevBestCount, before)}
          tone={toneOf(report.bests.length, report.prevBestCount)}
        />
        {bodyweight && (
          <Tile
            label="Bodyweight"
            value={fmtWeight(bodyweight.to, units)}
            change={
              bodyweight.from === undefined
                ? 'first weigh-ins'
                : comparedWeight(bodyweight.to, bodyweight.from, units, before)
            }
            tone={bodyweight.from === undefined ? 'same' : toneOf(bodyweight.to, bodyweight.from)}
          />
        )}
      </dl>

      {/* What should I do. */}
      {lines.length > 0 && (
        <section aria-labelledby="attention-h">
          <SectionHeading id="attention-h" icon={CircleAlert}>
            Needs attention
          </SectionHeading>
          <ul className="mt-3 divide-y border-y sm:max-w-2xl">
            {lines.map((line) => (
              <li key={line} className="py-2.5">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* What went well. */}
      <section aria-labelledby="well-h">
        <SectionHeading id="well-h" icon={Trophy}>
          Went well
        </SectionHeading>
        <BestsList report={report} kind={kind} units={units} before={before} className="mt-3 border-y sm:max-w-2xl" />
      </section>

      {/* Where the work went. */}
      <section aria-labelledby="muscles-h">
        <SectionHeading id="muscles-h" icon={Flame}>
          Hard sets{kind === 'month' ? ' a week' : ''} per muscle
        </SectionHeading>
        <ChartContainer
          config={MUSCLE}
          className="mt-4 w-full sm:max-w-2xl"
          style={{ height: muscles.length * 36 + 24 }}
          role="img"
          aria-label={muscles.map((m) => `${m.muscle} ${m.now} of ${m.target}, ${before} ${m.before}`).join('; ')}
        >
          <BarChart data={muscles} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="muscle" width={84} tickLine={false} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="now" fill="var(--color-now)" radius={3} isAnimationActive={false} />
            <Bar dataKey="before" fill="var(--color-before)" radius={3} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
        <ul aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-foreground" />
            This {unit}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={{ background: 'var(--chart-5)' }} />
            {before[0].toUpperCase() + before.slice(1)}
          </li>
        </ul>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
          {muscles.map((m) => (
            <li key={m.muscle}>
              {m.muscle} {m.now} of {m.target}
            </li>
          ))}
        </ul>
      </section>

      {/* How it felt. */}
      <section aria-labelledby="effort-h">
        <SectionHeading id="effort-h" icon={Gauge}>
          Effort
        </SectionHeading>
        <div className="mt-4 sm:max-w-md">
          <EffortBar report={report} kind={kind} before={before} />
        </div>
      </section>

      {/* The body, last. */}
      {weights.length > 1 && (
        <section aria-labelledby="body-h">
          <SectionHeading id="body-h" icon={Scale}>
            Bodyweight
          </SectionHeading>
          <ChartContainer
            config={WEIGHT}
            className="mt-4 aspect-[3/1] w-full sm:max-w-2xl"
            role="img"
            aria-label={weights.map((w) => `${w.label} ${fmtWeight(w.weight, units)}`).join(', ')}
          >
            <LineChart data={weights} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
              <YAxis
                width={40}
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => fmtWeight(Math.round(v * 10) / 10)}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
              <Line
                dataKey="weight"
                type="monotone"
                stroke="var(--color-weight)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-weight)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </section>
      )}
    </div>
  )
}
