import { TabsList, TabsTrigger } from '#/components/ui/tabs'

/*
 * The frame of the Stats screen, shared by the Stats page and the demo on How it works: the title and the tab bar.
 * The tabs themselves are in stats-lifts.tsx, stats-body.tsx and the page.
 */

export type StatsTab = 'lifts' | 'sessions' | 'body'
export const TABS: StatsTab[] = ['lifts', 'sessions', 'body']

export function StatsTitle() {
  return <h1 className="font-condensed text-4xl font-semibold leading-none">Stats</h1>
}

/** The three tabs: full width on phones, shrink-wrapped and left-aligned from 640px up. */
export function StatsTabsList() {
  return (
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
  )
}
