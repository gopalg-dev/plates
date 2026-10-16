import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LogBodyweightDialog, LogMeasurementsDialog, TapeDialog, WeighInDialog } from '#/components/app/body-dialogs'
import { DayIcon } from '#/components/app/day-mark'
import { ExportButtons } from '#/components/app/export-buttons'
import { PastSessionEditor, useDraftSession } from '#/components/app/log-past-session'
import { PendingPage } from '#/components/app/page-skeletons'
import { SessionEditor, sessionSummary } from '#/components/app/session-editor'
import { BodyTab } from '#/components/app/stats-body'
import { LiftsTab, liftsFrom } from '#/components/app/stats-lifts'
import { SessionsTab } from '#/components/app/stats-sessions'
import { type StatsTab, StatsTabs, StatsTitle, TABS } from '#/components/app/stats-view'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { errorMessage, longDate } from '#/lib/format'
import { stepsOf } from '#/lib/logic/progression'
import { bodyweightTrend, dayKey, noon, recentPRs } from '#/lib/logic/stats'
import { pageTitle } from '#/lib/page-title'
import { rowTap } from '#/lib/row-tap'
import type { BodyweightLog, MeasurementLog, Workout } from '#/lib/types'
import { getStatsFn, resetRampFn } from '#/server/fns'

export const Route = createFileRoute('/_app/stats')({
  head: () => ({ meta: [{ title: pageTitle('Stats') }] }),
  // /stats?tab=body opens on that tab. Lifts when absent.
  validateSearch: (search: Record<string, unknown>): { tab?: StatsTab } =>
    TABS.includes(search.tab as StatsTab) ? { tab: search.tab as StatsTab } : {},
  loader: () => getStatsFn(),
  component: StatsPage,
  pendingComponent: PendingPage,
})

function StatsPage() {
  const { settings, plan, workouts, bodyweights, measurements } = Route.useLoaderData()
  const { tab = 'lifts' } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const units = settings.units
  const lengthUnit = units === 'kg' ? 'cm' : 'in'
  const [picked, setPicked] = useState<BodyweightLog | null>(null)
  const [pickedTape, setPickedTape] = useState<MeasurementLog | null>(null)
  /**
   * The session open for editing, and the day whose sessions are listed when there is more than one, or whose
   * plan days are offered when there is none. A plan day picked there opens a draft to log.
   */
  const [editing, setEditing] = useState<Workout | null>(null)
  const [dayOpen, setDayOpen] = useState<string | null>(null)
  const drafts = useDraftSession()
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
    return {
      now,
      prs: recentPRs(workouts, now),
      bw: bodyweightTrend(bodyweights, now),
      lifts: liftsFrom(plan, workouts),
    }
  }, [workouts, bodyweights, plan])

  const { now, prs, bw, lifts } = derived
  const daySessions = dayOpen ? workouts.filter((w) => w.finishedAt && dayKey(w.finishedAt) === dayOpen) : []

  /**
   * A tapped calendar day: its week drives the numbers, and its session opens. Two sessions give a choice; an
   * earlier day with none offers the plan's days, to log one for that date.
   */
  function openDay(date: string) {
    const found = workouts.filter((w) => w.status === 'done' && w.finishedAt && dayKey(w.finishedAt) === date)
    if (found.length === 1) setEditing(found[0])
    else if (found.length > 1 || date < dayKey(now)) setDayOpen(date)
  }

  return (
    <div>
      <StatsTitle />

      <StatsTabs tab={tab} onChange={(v) => navigate({ to: '/stats', search: { tab: v }, replace: true })} />

      {tab === 'lifts' && <LiftsTab lifts={lifts} prs={prs} units={units} now={now} />}

      {tab === 'sessions' && (
        <SessionsTab
          workouts={workouts}
          plan={plan}
          trainingAge={settings.trainingAge}
          joinedAt={settings.joinedAt}
          units={units}
          now={now}
          onOpenDay={openDay}
          dropRamp={
            ramped > 0 && (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void dropRamp()}>
                Drop the extra sets on {ramped} {ramped === 1 ? 'lift' : 'lifts'}
              </Button>
            )
          }
          exportButtons={<ExportButtons workouts={workouts} units={units} />}
        />
      )}

      {/* Two columns only from 1024px: beside the sidebar a tablet leaves 448px, too narrow for two. */}
      {tab === 'body' && (
        <BodyTab
          bw={bw}
          bodyweights={bodyweights}
          measurements={measurements}
          units={units}
          lengthUnit={lengthUnit}
          now={now}
          goal={settings.goal}
          logBodyweight={<LogBodyweightDialog units={units} onLogged={refresh} />}
          logMeasurements={<LogMeasurementsDialog lengthUnit={lengthUnit} onLogged={refresh} />}
          onPickWeight={setPicked}
          onPickTape={setPickedTape}
        />
      )}

      <SessionEditor
        workout={editing}
        units={units}
        steps={stepsOf(settings)}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          await refresh()
        }}
      />
      <PastSessionEditor
        draft={drafts.draft}
        opening={drafts.opening}
        units={units}
        steps={stepsOf(settings)}
        onClose={drafts.close}
        onLogged={async () => {
          drafts.close()
          await refresh()
        }}
      />
      <Dialog open={dayOpen !== null} onOpenChange={(o) => !o && setDayOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dayOpen ? longDate(noon(dayOpen)) : ''}</DialogTitle>
            <DialogDescription>
              {daySessions.length === 0
                ? 'No session'
                : `${daySessions.length} ${daySessions.length === 1 ? 'session' : 'sessions'}`}
            </DialogDescription>
          </DialogHeader>
          <ItemGroup className="border-t">
            {daySessions.length > 0
              ? daySessions.map((w) => {
                  const openIt = () => {
                    setDayOpen(null)
                    setEditing(w)
                  }
                  return (
                    <Item key={w.id} size="sm" className="cursor-pointer px-2" onClick={rowTap(openIt).onClick}>
                      <ItemMedia>
                        <DayIcon type={w.dayType} className="size-8 rounded-md" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="text-base">{w.dayName}</ItemTitle>
                        <ItemDescription>{sessionSummary(w)}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button variant="outline" size="sm" aria-label={`Open ${w.dayName}`} onClick={openIt}>
                          Open
                        </Button>
                      </ItemActions>
                    </Item>
                  )
                })
              : // A day trained without the app: pick which plan day it was, and its sets open to fill in.
                plan.days.map((d) => {
                  const logIt = () => {
                    if (!dayOpen) return
                    setDayOpen(null)
                    void drafts.open(d, dayOpen)
                  }
                  return (
                    <Item key={d.id} size="sm" className="cursor-pointer px-2" onClick={rowTap(logIt).onClick}>
                      <ItemMedia>
                        <DayIcon type={d.type} className="size-8 rounded-md" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="text-base">{d.name}</ItemTitle>
                        <ItemDescription>{d.exercises.length} exercises</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Log ${d.name}`}
                          onClick={logIt}
                          disabled={d.exercises.length === 0}
                        >
                          Log
                        </Button>
                      </ItemActions>
                    </Item>
                  )
                })}
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
