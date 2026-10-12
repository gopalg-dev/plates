import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Flame,
  Ruler,
  Scale,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { paceNote } from '#/lib/logic/goal'
import { CartesianGrid, Line, LineChart, XAxis, YAxis, useActiveTooltipLabel } from 'recharts'
import { LogBodyweightDialog, LogMeasurementsDialog, TapeDialog, WeighInDialog } from '#/components/app/body-dialogs'
import { BodyMap, BodyMapLegend } from '#/components/app/body-map'
import { DayIcon, dayColourClass, dayColourVar, dayInkClass } from '#/components/app/day-mark'
import { ExportButtons } from '#/components/app/export-buttons'
import { SessionEditor, sessionSummary } from '#/components/app/session-editor'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { SectionHeading } from '#/components/app/section-heading'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '#/components/ui/chart'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { longDate, monthYear, relativeDay, shortDate, signed, errorMessage } from '#/lib/format'
import { deloadHint, effortLabel, effortThisWeek } from '#/lib/logic/effort'
import { daysBetween } from '#/lib/logic/nudges'
import { plateOf } from '#/lib/logic/progression'
import { TRENDS, TREND_LABEL, liftTrend, type Trend } from '#/lib/logic/trend'
import {
  addDays,
  bodyweightTrend,
  dayKey,
  monthCalendar,
  plannedVolumeByMuscle,
  recentPRs,
  sessionsInWeek,
  startOfWeek,
  volumeByMuscleInWeek,
  weekTotals,
  weeklyStreak,
  weeklyStrength,
  type WeeklyPoint,
} from '#/lib/logic/stats'
import { fmtWeight } from '#/lib/logic/units'
import { rowTap } from '#/lib/row-tap'
import {
  type BodyweightLog,
  type DayType,
  type Exercise,
  type LoadType,
  type MeasurementLog,
  type Muscle,
  type Units,
  type Workout,
} from '#/lib/types'
import { cn } from '#/lib/utils'
import { toast } from 'sonner'
import { getStatsFn, resetRampFn } from '#/server/fns'

type StatsTab = 'lifts' | 'sessions' | 'body'
const TABS: StatsTab[] = ['lifts', 'sessions', 'body']
import { pageTitle } from '#/lib/page-title'

export const Route = createFileRoute('/_app/stats')({
  head: () => ({ meta: [{ title: pageTitle('Stats') }] }),
  // /stats?tab=body opens on that tab. Lifts when absent.
  validateSearch: (search: Record<string, unknown>): { tab?: StatsTab } =>
    TABS.includes(search.tab as StatsTab) ? { tab: search.tab as StatsTab } : {},
  loader: () => getStatsFn(),
  component: StatsPage,
})

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

/** Noon on a local calendar day, so formatting never slips to the day before in western time zones. */
function noon(key: string): string {
  return `${key}T12:00:00`
}

/** Local midnight of a YYYY-MM-DD key as a timestamp, the chart's time axis. */
function keyTime(key: string): number {
  return new Date(noon(key)).setHours(0, 0, 0, 0)
}

/** "This week", "Last week", "3 weeks ago": the week of `key` counted back from the week of `now`. */
function weekLabel(key: string, now: Date): string {
  const ago = Math.round((keyTime(dayKey(startOfWeek(now))) - keyTime(key)) / (7 * 86_400_000))
  if (ago <= 0) return 'This week'
  if (ago === 1) return 'Last week'
  return `${ago} weeks ago`
}

function StatsPage() {
  const { settings, plan, workouts, bodyweights, measurements } = Route.useLoaderData()
  const { tab = 'lifts' } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const units = settings.units
  const lengthUnit = units === 'kg' ? 'cm' : 'in'
  const [picked, setPicked] = useState<BodyweightLog | null>(null)
  const [pickedTape, setPickedTape] = useState<MeasurementLog | null>(null)
  /** Monday key of the week the numbers describe. Null means the current week. */
  const [week, setWeek] = useState<string | null>(null)
  /** The session open for editing, and the day whose sessions are listed when there is more than one. */
  const [editing, setEditing] = useState<Workout | null>(null)
  const [dayOpen, setDayOpen] = useState<string | null>(null)
  const [pickedMuscle, setPickedMuscle] = useState<Muscle | null>(null)
  const refresh = () => router.invalidate()
  /** Lifts the set ramp has raised above the plan's own number. The deload card offers to drop them back. */
  const ramped = plan.days.reduce((n, d) => n + d.exercises.filter((e) => e.ramp).length, 0)
  async function dropRamp() {
    try {
      const n = await resetRampFn()
      toast.success(`Back to the plan's sets on ${n} ${n === 1 ? 'lift' : 'lifts'}`)
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not drop the sets.'))
    }
  }

  const derived = useMemo(() => {
    const now = new Date()
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
    return {
      now,
      thisWeek: dayKey(startOfWeek(now)),
      streak: weeklyStreak(workouts, now),
      target: plannedVolumeByMuscle(plan, settings.trainingAge),
      prs: recentPRs(workouts, now),
      bw: bodyweightTrend(bodyweights, now),
      deload: deloadHint(workouts, now),
      lifts,
    }
  }, [workouts, bodyweights, plan, settings.trainingAge])

  const { now, thisWeek, streak, target, prs, bw, deload, lifts } = derived
  const weekKey = week ?? thisWeek
  const isThisWeek = weekKey === thisWeek

  const weekly = useMemo(() => {
    const at = isThisWeek ? now : new Date(noon(weekKey))
    return {
      sessions: sessionsInWeek(workouts, at),
      volume: volumeByMuscleInWeek(workouts, at),
      effort: effortThisWeek(workouts, at),
      totals: weekTotals(workouts, at),
    }
  }, [workouts, weekKey, isThisWeek, now])

  const { sessions, volume, effort, totals } = weekly
  const weekName = isThisWeek ? 'this week' : `week of ${shortDate(noon(weekKey))}`
  const daySessions = dayOpen ? workouts.filter((w) => w.finishedAt && dayKey(w.finishedAt) === dayOpen) : []

  /** A tapped calendar day: its week drives the numbers, and its session opens. Two sessions give a choice. */
  function openDay(date: string) {
    const found = workouts.filter((w) => w.status === 'done' && w.finishedAt && dayKey(w.finishedAt) === date)
    if (found.length === 1) setEditing(found[0])
    else if (found.length > 1) setDayOpen(date)
  }

  return (
    <div>
      <h1 className="font-condensed text-4xl font-semibold leading-none">Stats</h1>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ to: '/stats', search: { tab: v as StatsTab }, replace: true })}
        className="mt-6"
      >
        {/* Full width on phones, shrink-wrapped and left-aligned from 640px up. */}
        <TabsList className="w-full self-start sm:w-fit">
          <TabsTrigger value="lifts" className="flex-1 sm:flex-none sm:px-5">
            Lifts
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex-1 sm:flex-none sm:px-5">
            Sessions
          </TabsTrigger>
          <TabsTrigger value="body" className="flex-1 sm:flex-none sm:px-5">
            Body
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lifts" className="mt-6 grid gap-10">
          <section aria-labelledby="strength-h">
            <SectionHeading id="strength-h" icon={TrendingUp}>
              Strength
            </SectionHeading>
            {lifts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <StrengthPanel lifts={lifts} units={units} now={now} />
            )}
          </section>

          <section aria-labelledby="pr-h">
            <SectionHeading id="pr-h" icon={Trophy}>
              Recent bests
            </SectionHeading>
            {prs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
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

        {/* Two columns only from 1024px: beside the sidebar a tablet leaves 448px, too narrow for two. */}
        <TabsContent value="sessions" className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-x-10">
          <section aria-labelledby="week-h" className="lg:col-span-2">
            <SectionHeading id="week-h" icon={CalendarDays}>
              {isThisWeek ? 'This week' : `Week of ${shortDate(noon(weekKey))}`}
            </SectionHeading>
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-10">
              <div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-condensed text-6xl font-semibold leading-none tabular-nums">{sessions}</span>
                  <span className="text-muted-foreground">of {plan.days.length} sessions</span>
                </div>
                {/* One quiet line each: the streak with the effort, and the week's totals. */}
                {(streak > 0 || effort !== undefined) && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[
                      streak > 0 ? `${streak} ${streak === 1 ? 'week' : 'weeks'} in a row` : null,
                      effort !== undefined ? `effort ${effortLabel(effort).toLowerCase()}` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    .
                  </p>
                )}
                <p className="mt-2 flex flex-wrap gap-x-3 text-sm tabular-nums">
                  <span>{totals.sets} hard sets</span>
                  <span className="text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  <span>
                    {Math.round(totals.lifted).toLocaleString('en-US')} {units}
                  </span>
                  <span className="text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  <span>{totals.minutes} min</span>
                </p>
                {deload && (
                  <div className="mt-3 rounded-lg border px-3 py-2 text-sm">
                    <p>Two hard weeks and no lift moved. Take a deload week: half the sets, same weights.</p>
                    {ramped > 0 && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => void dropRamp()}>
                        Drop the extra sets on {ramped} {ramped === 1 ? 'lift' : 'lifts'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <ActivityCalendar
                workouts={workouts}
                now={now}
                joinedAt={settings.joinedAt}
                selected={weekKey}
                onSelect={(monday) => setWeek(monday === thisWeek ? null : monday)}
                onOpenDay={openDay}
              />
            </div>
          </section>

          <section aria-labelledby="volume-h" className="lg:col-span-2">
            <SectionHeading id="volume-h" icon={Flame}>
              Hard sets {isThisWeek ? 'this week' : `, ${weekName}`}
            </SectionHeading>
            <BodyMap
              done={volume}
              target={target}
              picked={pickedMuscle}
              onPick={(m) => setPickedMuscle((cur) => (cur === m ? null : m))}
              className="mt-4"
            />
            <BodyMapLegend className="mt-3 justify-center" />
          </section>

          {workouts.length > 0 && (
            <section aria-labelledby="export-h" className="lg:col-span-2">
              <SectionHeading id="export-h" icon={FileDown}>
                Export
              </SectionHeading>
              <div className="mt-3">
                <ExportButtons />
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="body" className="mt-6 grid gap-10">
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
                  <p className="mt-2 text-sm text-muted-foreground">
                    7-day average {fmtWeight(bw.weekAvg, units)}
                    {bw.changePct !== undefined
                      ? `, ${signed(bw.changePct, 1)}% vs last week. ${paceNote(bw.changePct, settings.goal)}`
                      : ''}
                  </p>
                ) : null}
                {bw.latestDate && (
                  <p className="mt-1 text-sm text-muted-foreground">Last logged {relativeDay(bw.latestDate, now)}.</p>
                )}
              </div>
              <LogBodyweightDialog units={units} onLogged={refresh} />
            </div>
            <BodyweightChart logs={bodyweights} units={units} now={now} onPick={setPicked} />
          </section>

          <section aria-labelledby="tape-h">
            <SectionHeading id="tape-h" icon={Ruler}>
              Measurements
            </SectionHeading>
            <Measurements
              logs={measurements}
              lengthUnit={lengthUnit}
              now={now}
              onLogged={refresh}
              onPick={setPickedTape}
            />
          </section>
        </TabsContent>
      </Tabs>

      <SessionEditor
        workout={editing}
        units={units}
        plate={plateOf(settings)}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          await refresh()
        }}
      />
      <Dialog open={dayOpen !== null} onOpenChange={(o) => !o && setDayOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dayOpen ? longDate(noon(dayOpen)) : ''}</DialogTitle>
            <DialogDescription>
              {daySessions.length} {daySessions.length === 1 ? 'session' : 'sessions'}
            </DialogDescription>
          </DialogHeader>
          <ItemGroup className="border-y">
            {daySessions.map((w) => (
              <Item
                key={w.id}
                size="sm"
                className="cursor-pointer px-2"
                onClick={
                  rowTap(() => {
                    setDayOpen(null)
                    setEditing(w)
                  }).onClick
                }
              >
                <ItemMedia>
                  <DayIcon type={w.dayType} className="size-8 rounded-md" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-base">{w.dayName}</ItemTitle>
                  <ItemDescription>{sessionSummary(w)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Open ${w.dayName}`}
                    onClick={() => {
                      setDayOpen(null)
                      setEditing(w)
                    }}
                  >
                    Open
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </DialogContent>
      </Dialog>

      <TapeDialog
        log={pickedTape}
        lengthUnit={lengthUnit}
        onClose={() => setPickedTape(null)}
        onChanged={() => {
          setPickedTape(null)
          refresh()
        }}
      />
      <WeighInDialog
        log={picked}
        units={units}
        onClose={() => setPicked(null)}
        onChanged={() => {
          setPicked(null)
          refresh()
        }}
      />
    </div>
  )
}

/** One figure of the week: a label over a condensed number. */
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
        <span className="shrink-0 text-sm text-muted-foreground">{TREND_LABEL[trends.get(selected.ex.id)!]}</span>
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

// ---------------------------------------------------------------- calendar

/** Column heads. Weeks start on Monday, like `startOfWeek`. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface CalendarProps {
  workouts: Workout[]
  now: Date
  /** When the user joined. Earlier days are shown dimmed and cannot be picked. */
  joinedAt?: string
  /** Monday key of the highlighted week. */
  selected: string
  onSelect: (monday: string) => void
  /** A tapped day with a session on it. */
  onOpenDay: (date: string) => void
}

/** One month of sessions as a calendar. Tap a day: its week drives the numbers, and its session opens. */
function ActivityCalendar({ workouts, now, joinedAt, selected, onSelect, onOpenDay }: CalendarProps) {
  const [offset, setOffset] = useState(0)
  const [jumpOpen, setJumpOpen] = useState(false)
  const month = useMemo(() => new Date(now.getFullYear(), now.getMonth() + offset, 1), [now, offset])
  const weeks = useMemo(() => monthCalendar(workouts, now, month, joinedAt), [workouts, now, month, joinedAt])
  // Session names per day, for the day buttons' labels.
  const names = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const w of workouts) {
      if (w.status !== 'done' || !w.finishedAt) continue
      const key = dayKey(w.finishedAt)
      m.set(key, [...(m.get(key) ?? []), w.dayName])
    }
    return m
  }, [workouts])
  const todayKey = dayKey(now)
  const thisWeek = dayKey(startOfWeek(now))
  const joined = joinedAt ? new Date(joinedAt) : null
  const atFirstMonth =
    joined !== null && month.getTime() <= new Date(joined.getFullYear(), joined.getMonth(), 1).getTime()
  const sessions = weeks.flatMap((w) => w.days).filter((d) => d?.type).length
  const title = monthYear(month)

  // Months are counted from year zero so a span across years compares as one number.
  const index = (d: Date) => d.getFullYear() * 12 + d.getMonth()
  const lowest = joined ? index(joined) : index(now) - 36
  const highest = index(now)

  /** Shows the month that holds `d`, kept within the join-to-now span. */
  function jumpTo(d: Date) {
    setOffset(Math.min(highest, Math.max(lowest, index(d))) - highest)
  }

  return (
    <div className="mt-5 max-w-xs">
      <div className="flex items-center gap-2">
        <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 gap-1 px-2 text-sm font-medium"
              aria-label={`${title}. Pick a month`}
            >
              {title}
              <ChevronDown aria-hidden className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            {/* The month and year dropdowns move this calendar as they change; a tapped day picks its week. */}
            <Calendar
              mode="single"
              captionLayout="dropdown"
              weekStartsOn={1}
              month={month}
              onMonthChange={jumpTo}
              startMonth={new Date(Math.floor(lowest / 12), lowest % 12, 1)}
              endMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
              disabled={[{ after: now }, ...(joined ? [{ before: joined }] : [])]}
              onSelect={(day) => {
                if (!day) return
                jumpTo(day)
                onSelect(dayKey(startOfWeek(day)))
                setJumpOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {sessions} {sessions === 1 ? 'session' : 'sessions'}
        </p>
        <div className="ml-auto flex shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Previous month"
            onClick={() => setOffset(offset - 1)}
            disabled={atFirstMonth}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Next month"
            onClick={() => setOffset(offset + 1)}
            disabled={offset >= 0}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 px-1 text-center text-xs text-muted-foreground" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 flex flex-col gap-1" role="group" aria-label={`Weeks of ${title}`}>
        {weeks.map((week) => {
          const isSelected = week.start === selected
          return (
            <div
              key={week.start}
              className={cn(
                'grid grid-cols-7 gap-1 rounded-md p-1 text-xs tabular-nums',
                isSelected && 'bg-foreground/10',
              )}
            >
              {week.days.map((d, j) => {
                if (d === null) return <span key={`pad-${j}`} />
                const on = names.get(d.date) ?? []
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={d.future || d.before}
                    aria-label={`${shortDate(d.iso)}, ${on.length > 0 ? on.join(' and ') : 'no session'}`}
                    onClick={() => {
                      onSelect(week.start)
                      if (on.length > 0) onOpenDay(d.date)
                    }}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                      d.type
                        ? cn(dayColourClass(d.type), dayInkClass(d.type), 'font-medium hover:opacity-90')
                        : d.future || d.before
                          ? 'text-muted-foreground/40'
                          : 'bg-muted text-muted-foreground hover:bg-foreground/10',
                      d.date === todayKey && 'ring-2 ring-foreground/40 ring-offset-1 ring-offset-background',
                    )}
                  >
                    {d.dayOfMonth}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      {selected !== thisWeek && (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto px-0 text-muted-foreground"
          onClick={() => {
            setOffset(0)
            onSelect(thisWeek)
          }}
        >
          Back to this week
        </Button>
      )}
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
        <p className="text-sm text-muted-foreground">
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
}: {
  logs: MeasurementLog[]
  lengthUnit: string
  now: Date
  onPick: (log: MeasurementLog) => void
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
      .filter((l) => (since === null || new Date(l.date).getTime() >= since) && l[site] !== undefined)
      .map((l) => ({ date: l.date, value: l[site]!, log: l }))
  }, [logs, range, site, now])
  const first = data[0]
  const last = data[data.length - 1]
  const summary =
    first && last ? `${SITE_LABEL[site]} ${first.value} to ${last.value} ${lengthUnit} over ${data.length} tapes.` : ''

  return (
    <div className="mt-5">
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
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
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
  onLogged,
  onPick,
}: {
  logs: MeasurementLog[]
  lengthUnit: string
  now: Date
  onLogged: () => void
  /** Called with the tape under a tap on the chart, or under the keyboard cursor when Enter is pressed. */
  onPick: (log: MeasurementLog) => void
}) {
  const last = logs.at(-1)
  const prev = logs.at(-2)
  if (!last) {
    return (
      <div className="mt-3">
        <p className="text-sm text-muted-foreground">
          No tape yet. Arm, chest and waist set the baseline. Then every {TAPE_DAYS} days.
        </p>
        <div className="mt-3">
          <LogMeasurementsDialog lengthUnit={lengthUnit} onLogged={onLogged} />
        </div>
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
              <dt className="text-sm text-muted-foreground capitalize">{site}</dt>
              <dd className="font-condensed text-3xl font-semibold leading-none tabular-nums">
                {value ?? '–'}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{lengthUnit}</span>
              </dd>
              {delta !== undefined && (
                <dd className={cn('mt-1 text-xs tabular-nums', good ? 'text-success' : 'text-muted-foreground')}>
                  {signed(delta, 1)} vs last
                </dd>
              )}
            </div>
          )
        })}
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">
        Last measured {longDate(last.date)}, {ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}.{' '}
        {overdue ? 'Tape day is due now.' : `Next tape day ${longDate(due.toISOString())}.`}
      </p>
      <div className="mt-4">
        <LogMeasurementsDialog lengthUnit={lengthUnit} onLogged={onLogged} />
      </div>
      <MeasurementsChart logs={logs} lengthUnit={lengthUnit} now={now} onPick={onPick} />
    </div>
  )
}
