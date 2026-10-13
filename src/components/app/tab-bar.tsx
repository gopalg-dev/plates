import { ChartColumn, Dumbbell, ListChecks } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/** The three main screens: the phone's tab bar, and the top of the sidebar. */
export const PRIMARY_TABS = [
  { to: '/', label: 'Today', icon: Dumbbell, exact: true },
  { to: '/plan', label: 'Plan', icon: ListChecks, exact: false },
  { to: '/stats', label: 'Stats', icon: ChartColumn, exact: false },
] as const

export type PrimaryTab = (typeof PRIMARY_TABS)[number]

/** A tab: dim until it is the current screen, marked by `data-status="active"` (as a router link marks itself). */
const TAB = cn(
  'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground',
  'data-[status=active]:text-foreground',
)

/**
 * The phone's tab bar, shared by the app layout and the demo on How it works. Each tab is drawn by `renderTab`:
 * a link in the app, a button in the demo. It gets the tab, its icon and label, and the classes to put on it.
 */
export function TabBar({
  className,
  renderTab,
}: {
  className?: string
  renderTab: (tab: PrimaryTab, content: ReactNode, className: string) => ReactNode
}) {
  return (
    <nav aria-label="Main" className={cn('border-t bg-background/95 backdrop-blur', className)}>
      <ul className="grid grid-cols-3">
        {PRIMARY_TABS.map((tab) => (
          <li key={tab.to}>
            {renderTab(
              tab,
              <>
                <tab.icon className="size-5" aria-hidden />
                {tab.label}
              </>,
              TAB,
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
