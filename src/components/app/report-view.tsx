import { Share } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '#/components/ui/button'
import { longDate } from '#/lib/format'
import {
  beforeLabel,
  buildReport,
  daysOf,
  finishedPeriod,
  firstReportOn,
  history,
  MIN_SESSIONS,
  type PeriodKind,
  type ReportData,
} from '#/lib/logic/report'
import { addDays } from '#/lib/logic/stats'
import type { Settings } from '#/lib/types'
import { ReportDashboard } from './report-dashboard'
import { PeriodBar } from './report-parts'
import { ShareReportDialog } from './share-report'

/*
 * The Report page: how a finished week or month went, next to the one before. Stats stays the live view; this is
 * the look back. The shell: the title, the period row, and the two states before there is a report to show.
 */

export function ReportView({
  data,
  kind,
  anchor,
  now,
  name,
  onChange,
}: {
  data: ReportData & { settings: Pick<Settings, 'units' | 'joinedAt'> }
  kind: PeriodKind
  anchor: Date
  now: Date
  /** Whose report it is, for the share card. */
  name: string
  /** A step through periods gives the new anchor; a switch of Week and Month gives none, to open on the latest. */
  onChange: (kind: PeriodKind, anchor?: Date) => void
}) {
  const { units, joinedAt } = data.settings
  const period = useMemo(() => finishedPeriod(kind, anchor, now), [kind, anchor, now])
  const view = useMemo(
    () => ({
      report: buildReport(data, period),
      hist: history(data, period),
      days: daysOf(period, data.workouts),
      firstReport: firstReportOn(kind, now, data.workouts),
    }),
    [data, period, kind, now],
  )
  const { report, hist, days, firstReport } = view
  const [shareOpen, setShareOpen] = useState(false)
  const shareable = !firstReport && report.enough
  const unit = kind === 'week' ? 'week' : 'month'
  // A year of data is loaded, so the arrows stop at a year ago, or at the join date when later.
  const yearAgo = addDays(now, -365)
  const earliest = joinedAt && new Date(joinedAt) > yearAgo ? new Date(joinedAt) : yearAgo

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-condensed text-4xl font-semibold leading-none">Report</h1>
        {/* Share sits beside the title on its own: the one thing to do with a finished period. */}
        {shareable && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-11"
            aria-label={`Share this ${unit}`}
            onClick={() => setShareOpen(true)}
          >
            <Share aria-hidden />
          </Button>
        )}
      </div>
      {shareable && (
        <ShareReportDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          report={report}
          period={period}
          days={days}
          units={units}
          name={name}
        />
      )}
      <div className="mt-6">
        <PeriodBar period={period} now={now} earliest={earliest} hasReports={!firstReport} onChange={onChange} />
      </div>

      {firstReport ? (
        <p className="mt-8 text-muted-foreground">
          Your first {unit}ly report comes on {longDate(firstReport.toISOString())}.
        </p>
      ) : !report.enough ? (
        <p className="mt-8 text-muted-foreground">
          Not enough sessions: {report.sessions.done} of {MIN_SESSIONS[kind]} for a {unit}.
        </p>
      ) : (
        <ReportDashboard report={report} kind={kind} hist={hist} days={days} units={units} before={beforeLabel(kind)} />
      )}
    </div>
  )
}
