import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ReportView } from '#/components/app/report-view'
import { accountName } from '#/lib/format'
import { lastFinished, PERIOD_KINDS, type PeriodKind } from '#/lib/logic/report'
import { dayKey, noon } from '#/lib/logic/stats'
import { pageTitle } from '#/lib/page-title'
import { getStatsFn } from '#/server/fns'

interface ReportSearch {
  period?: PeriodKind
  /** A day inside the period, YYYY-MM-DD. The last finished period when absent. */
  at?: string
}

export const Route = createFileRoute('/_app/report')({
  head: () => ({ meta: [{ title: pageTitle('Report') }] }),
  // /report?period=month&at=2026-09-15 opens that month. Last week when absent.
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    ...(PERIOD_KINDS.includes(search.period as PeriodKind) ? { period: search.period as PeriodKind } : {}),
    ...(typeof search.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.at) ? { at: search.at } : {}),
  }),
  // The same year of sessions and weigh-ins as Stats; the report is worked out from it in the browser.
  loader: () => getStatsFn(),
  component: ReportPage,
})

function ReportPage() {
  const data = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const { period: kind = 'week', at } = Route.useSearch()
  const navigate = useNavigate()
  const now = useMemo(() => new Date(), [])
  const anchor = useMemo(() => (at ? new Date(noon(at)) : lastFinished(kind, now)), [at, kind, now])

  return (
    <ReportView
      data={data}
      kind={kind}
      anchor={anchor}
      now={now}
      name={accountName(user)}
      onChange={(next, day) =>
        navigate({
          to: '/report',
          search: { period: next, ...(day ? { at: dayKey(day) } : {}) },
          replace: true,
        })
      }
    />
  )
}
