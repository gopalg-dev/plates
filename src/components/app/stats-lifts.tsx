import { TrendingUp, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '#/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { TabsContent } from '#/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { relativeDay, shortDate, signed } from '#/lib/format'
import { dayKey, keyTime, noon, type PR, startOfWeek, type WeeklyPoint, weeklyStrength } from '#/lib/logic/stats'
import { liftTrend, TREND_LABEL, TRENDS, type Trend } from '#/lib/logic/trend'
import { fmtWeight } from '#/lib/logic/units'
import type { DayType, Exercise, LoadType, Plan, Units, Workout } from '#/lib/types'
import { cn } from '#/lib/utils'
import { dayColourVar } from './day-mark'
import { SectionHeading } from './section-heading'

/*
 * The Lifts tab of Stats, shared by the Stats page and the demo on How it works: each lift week by week, and the
 * recent bests. `liftsFrom` turns a plan and its sessions into the lifts it shows. Change them here and both follow.
 */

/** A lift's trend as shown beside the lift picker; nothing while it is unknown. */
function trendLabelOf(trend: Trend | undefined): string {
  return trend ? TREND_LABEL[trend] : ''
}

/** An exercise with the type of the day it sits on, which gives its chart line the day's plate colour. */
type Lift = Pick<Exercise, 'id' | 'name' | 'loadType'> & { type: DayType }
type SetLike = Pick<WeeklyPoint, 'weight' | 'reps' | 'seconds'>
interface LiftData {
  ex: Lift
  weeks: WeeklyPoint[]
}

function setText(loadType: LoadType, p: SetLike, units: Units): string {
  if (loadType === 'weight') return `${fmtWeight(p.weight, units)} × ${p.reps}`
  if (loadType === 'bodyweight') return `${p.reps} reps`
  return `${p.seconds} s`
}

/** The number the chart plots: weight for weighted lifts, reps or seconds otherwise. */
function liftValue(loadType: LoadType, p: SetLike): number {
  if (loadType === 'weight') return p.weight
  if (loadType === 'bodyweight') return p.reps
  return p.seconds
}

/** The big figure and what follows it: "62.5" + "kg × 7", "8" + "reps", "45" + "s". */
function bigSet(loadType: LoadType, p: SetLike, units: Units): { value: string; unit: string } {
  if (loadType === 'weight') return { value: fmtWeight(p.weight), unit: `${units} × ${p.reps}` }
  if (loadType === 'bodyweight') return { value: String(p.reps), unit: p.reps === 1 ? 'rep' : 'reps' }
  return { value: String(p.seconds), unit: 's' }
}

function repsText(n: number): string {
  return `${signed(n, 0)} ${Math.abs(n) === 1 ? 'rep' : 'reps'}`
}

/** How `to` compares with `from`: the weight first, then the reps when the weight held. */
function changeOf(loadType: LoadType, from: SetLike, to: SetLike, units: Units): { text: string; up: boolean } {
  if (loadType === 'weight') {
    const dw = to.weight - from.weight
    if (dw !== 0) return { text: `${signed(dw, 1)} ${units}`, up: dw > 0 }
    const dr = to.reps - from.reps
    if (dr !== 0) return { text: repsText(dr), up: dr > 0 }
    return { text: 'same', up: false }
  }
  if (loadType === 'bodyweight') {
    const dr = to.reps - from.reps
    return dr === 0 ? { text: 'same', up: false } : { text: repsText(dr), up: dr > 0 }
  }
  const ds = to.seconds - from.seconds
  return ds === 0 ? { text: 'same', up: false } : { text: `${signed(ds, 0)} s`, up: ds > 0 }
}

/** "This week", "Last week", "3 weeks ago": the week of `key` counted back from the week of `now`. */
function weekLabel(key: string, now: Date): string {
  const ago = Math.round((keyTime(dayKey(startOfWeek(now))) - keyTime(key)) / (7 * 86_400_000))
  if (ago <= 0) return 'This week'
  if (ago === 1) return 'Last week'
  return `${ago} weeks ago`
}

/** Every lift with logged weeks: the first lift of each day, then the rest of the plan, then lifts since dropped. */
export function liftsFrom(plan: Plan, workouts: Workout[]): LiftData[] {
  const seen = new Set<string>()
  const planned: Lift[] = plan.days.flatMap((d) => d.exercises.map((e) => ({ ...e, type: d.type })))
  const keyFirst: Lift[] = plan.days
    .filter((d) => d.exercises.length > 0)
    .map((d) => ({ ...d.exercises[0], type: d.type }))
  const lifts: LiftData[] = []
  // Plan order first, then anything logged under an exercise that has since left the plan.
  const logged: Lift[] = workouts.flatMap((w) =>
    w.entries.map((e) => ({
      id: e.exerciseId,
      name: e.name,
      loadType: e.loadType,
      type: w.dayType,
    })),
  )
  for (const ex of [...keyFirst, ...planned, ...logged]) {
    if (seen.has(ex.id)) continue
    seen.add(ex.id)
    const weeks = weeklyStrength(workouts, ex.id)
    if (weeks.length > 0) lifts.push({ ex, weeks })
  }
  return lifts
}

/** The Lifts tab: a lift picked and followed week by week, and the bests of the last two weeks. */
export function LiftsTab({ lifts, prs, units, now }: { lifts: LiftData[]; prs: PR[]; units: Units; now: Date }) {
  return (
    <TabsContent value="lifts" className="mt-6 grid gap-10">
      <section aria-labelledby="strength-h">
        <SectionHeading id="strength-h" icon={TrendingUp}>
          Strength
        </SectionHeading>
        {lifts.length === 0 ? (
          <p className="mt-3 text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <StrengthPanel lifts={lifts} units={units} now={now} />
        )}
      </section>

      <section aria-labelledby="pr-h">
        <SectionHeading id="pr-h" icon={Trophy}>
          Recent bests
        </SectionHeading>
        {prs.length === 0 ? (
          <p className="mt-3 text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y border-y">
            {prs.slice(0, 8).map((pr) => (
              <li key={`${pr.exerciseId}-${pr.date}`} className="flex items-baseline gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate">{pr.name}</span>
                <span className="tabular-nums">{setText(pr.loadType, pr, units)}</span>
                <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                  {relativeDay(pr.date, now)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </TabsContent>
  )
}

// ---------------------------------------------------------------- strength

/** Pick a lift, see it week by week. */
/** A filter chip: a pill that fills in when pressed. */
const chip =
  'shrink-0 rounded-full px-3 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background'

function StrengthPanel({ lifts, units, now }: { lifts: LiftData[]; units: Units; now: Date }) {
  const [liftId, setLiftId] = useState<string | null>(null)
  const [trend, setTrend] = useState<Trend | 'all'>('all')
  // What each lift is doing, and how many lifts are doing each thing. Chips show only for trends that have a lift.
  const trends = useMemo(() => new Map(lifts.map((l) => [l.ex.id, liftTrend(l.weeks, now)])), [lifts, now])
  const counts = useMemo(() => {
    const out = new Map<Trend, number>()
    for (const t of trends.values()) out.set(t, (out.get(t) ?? 0) + 1)
    return out
  }, [trends])
  const shown = trend === 'all' ? lifts : lifts.filter((l) => trends.get(l.ex.id) === trend)
  // The lift with the most weeks behind it has the most to show. Plan order breaks ties.
  const fallback = shown.reduce((best, l) => (l.weeks.length > best.weeks.length ? l : best), shown[0] ?? lifts[0])
  const selected = shown.find((l) => l.ex.id === liftId) ?? fallback

  return (
    <div className="mt-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={2}
        value={trend}
        onValueChange={(v) => v && setTrend(v as Trend | 'all')}
        aria-label="Lifts by trend"
        className="flex-wrap justify-start"
      >
        <ToggleGroupItem value="all" className={chip}>
          All
        </ToggleGroupItem>
        {TRENDS.filter((t) => counts.has(t)).map((t) => (
          <ToggleGroupItem key={t} value={t} className={chip}>
            {TREND_LABEL[t]}
            <span className="tabular-nums opacity-60">{counts.get(t)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="mt-3 flex items-center gap-3">
        <Select value={selected.ex.id} onValueChange={setLiftId}>
          <SelectTrigger className="w-full sm:w-80" aria-label="Lift">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shown.map((l) => (
              <SelectItem key={l.ex.id} value={l.ex.id}>
                {l.ex.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="shrink-0 text-sm text-muted-foreground">{trendLabelOf(trends.get(selected.ex.id))}</span>
      </div>
      <LiftProgress lift={selected.ex} weeks={selected.weeks} units={units} now={now} />
    </div>
  )
}

const TABLE_WEEKS = 8
const WEEK_MS = 7 * 86_400_000

/** One lift, week by week: the latest best set as the big number, a line through the weeks, and the weeks as a table. */
function LiftProgress({ lift, weeks, units, now }: { lift: Lift; weeks: WeeklyPoint[]; units: Units; now: Date }) {
  const first = weeks[0]
  const last = weeks[weeks.length - 1]
  const big = bigSet(lift.loadType, last, units)
  // The line takes the plate colour of the lift's day, like the sessions on the calendar.
  const config = useMemo(
    () =>
      ({
        value: { label: 'Best set', color: dayColourVar(lift.type) },
      }) satisfies ChartConfig,
    [lift.type],
  )
  const data = useMemo(
    () =>
      weeks.map((p) => ({
        t: keyTime(p.week),
        value: liftValue(lift.loadType, p),
        point: p,
      })),
    [weeks, lift.loadType],
  )
  const pad = lift.loadType === 'weight' ? 2.5 : lift.loadType === 'bodyweight' ? 1 : 5
  // Newest first, like the user tells it: this week, last week, the week before.
  const rows = weeks.slice(-TABLE_WEEKS).reverse()
  const summary =
    weeks.length === 1
      ? `${lift.name}: ${setText(lift.loadType, last, units)}, first week.`
      : `${lift.name}: ${setText(lift.loadType, first, units)} ${weeks.length} weeks ago, ${setText(lift.loadType, last, units)} now.`

  return (
    <div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-condensed text-5xl font-semibold leading-none tabular-nums">{big.value}</span>
        <span className="text-muted-foreground">{big.unit}</span>
      </div>
      <ChartContainer
        config={config}
        className="mt-4 aspect-[2/1] w-full md:aspect-[5/2]"
        role="img"
        aria-label={summary}
      >
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[keyTime(first.week), Math.max(keyTime(last.week), keyTime(first.week) + WEEK_MS)]}
            ticks={data.map((d) => d.t)}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            padding={{ left: 12, right: 12 }}
            tickFormatter={(v: number) => shortDate(new Date(v).toISOString())}
          />
          <YAxis
            domain={[`dataMin - ${pad}`, `dataMax + ${pad}`]}
            width={40}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmtWeight(Math.round(v * 10) / 10)}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) => {
                  const p = (payload?.[0]?.payload as { point?: WeeklyPoint } | undefined)?.point
                  return p ? `${weekLabel(p.week, now)}, ${shortDate(noon(p.week))}` : ''
                }}
                formatter={(_value, _name, item) => (
                  <span className="font-medium tabular-nums">
                    {setText(lift.loadType, (item.payload as { point: WeeklyPoint }).point, units)}
                  </span>
                )}
              />
            }
          />
          <Line
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-value)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>

      <Table className="mt-4 tabular-nums">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-0 font-normal text-muted-foreground">Week</TableHead>
            <TableHead className="px-0 font-normal text-muted-foreground">Best set</TableHead>
            <TableHead className="px-0 text-right font-normal text-muted-foreground">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const prev = weeks[weeks.indexOf(p) - 1]
            const c = prev ? changeOf(lift.loadType, prev, p, units) : null
            return (
              <TableRow key={p.week} className="hover:bg-transparent">
                <TableCell className="px-0">
                  {weekLabel(p.week, now)} <span className="text-muted-foreground">{shortDate(noon(p.week))}</span>
                </TableCell>
                <TableCell className="px-0">{setText(lift.loadType, p, units)}</TableCell>
                <TableCell className={cn('px-0 text-right', c?.up ? 'text-success' : 'text-muted-foreground')}>
                  {c ? c.text : '–'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
