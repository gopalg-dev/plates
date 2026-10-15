import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'

/*
 * The frame of the Stats screen, shared by the Stats page and the demo on How it works: the title and the tab bar.
 * The tabs themselves are in stats-lifts.tsx, stats-body.tsx and the page.
 */

export type StatsTab = 'lifts' | 'sessions' | 'body'
export const TABS: StatsTab[] = ['lifts', 'sessions', 'body']

export function StatsTitle() {
  return <h1 className="font-condensed text-4xl font-semibold leading-none">Stats</h1>
}

const TAB_LABEL: Record<StatsTab, string> = { lifts: 'Lifts', sessions: 'Sessions', body: 'Body' }

/** The three views, switched the way the report switches Week and Month. */
export function StatsTabs({ tab, onChange }: { tab: StatsTab; onChange: (tab: StatsTab) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={tab}
      onValueChange={(v) => v && v !== tab && onChange(v as StatsTab)}
      aria-label="Stats view"
      className="mt-6"
    >
      {TABS.map((t) => (
        <ToggleGroupItem key={t} value={t} className="px-3 text-base">
          {TAB_LABEL[t]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
