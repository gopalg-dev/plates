import { Link, Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
import {
  BookOpen,
  ChartColumn,
  ChevronsUpDown,
  Dumbbell,
  ListChecks,
  LogOut,
  MessageSquare,
  Palette,
  Settings,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '#/components/ui/sidebar'
import { AppMark } from '#/components/app/app-mark'
import { FeedbackDialog } from '#/components/app/feedback-form'
import { THEME_OPTIONS, readTheme, saveTheme, type Theme } from '#/lib/theme'
import { useSignOut } from '#/lib/use-sign-out'
import { getContentFn, getShellFn } from '#/server/fns'

export const Route = createFileRoute('/_app')({
  // Signed out: sign in first. Signed in but not set up: three questions first.
  beforeLoad: async ({ location }) => {
    const shell = await getShellFn()
    if (!shell) {
      // A failed sign-in link can land on the home page with ?error=…; carry the reason to the sign-in page.
      const error = new URLSearchParams(location.searchStr).get('error')
      throw redirect({ to: '/login', search: error ? { error } : {} })
    }
    if (!shell.settings.setupDone) throw redirect({ to: '/setup' })
    return { user: shell.user }
  },
  // The split templates and the exercise library, once per visit; every screen reads them through useContent().
  loader: () => getContentFn(),
  staleTime: 60 * 60 * 1000,
  component: AppLayout,
})

const primary = [
  { to: '/', label: 'Today', icon: Dumbbell, exact: true },
  { to: '/plan', label: 'Plan', icon: ListChecks, exact: false },
  { to: '/stats', label: 'Stats', icon: ChartColumn, exact: false },
] as const

const secondary = [{ to: '/library', label: 'Library', icon: BookOpen, exact: false }] as const

function isActive(pathname: string, to: string, exact: boolean): boolean {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
}

/** Two letters for the avatar: from the username or name, else the email. */
function initials(who: string): string {
  const words = who
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : who.slice(0, 2)
  return letters.toUpperCase()
}

function AppLayout() {
  const { pathname } = useLocation()
  const { user } = Route.useRouteContext()
  // Accounts made from an emailed link have no username and an empty name.
  const who = user.username ?? (user.name || user.email)
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-12 flex-row items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center">
          <p className="flex min-w-0 items-center gap-2 pl-1 font-condensed text-xl font-semibold leading-none group-data-[collapsible=icon]:hidden">
            <AppMark className="size-7" />
            <span className="truncate group-data-[collapsible=icon]:hidden">Plates</span>
          </p>
          <SidebarTrigger aria-label="Toggle sidebar" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {[...primary, ...secondary].map(({ to, label, icon: Icon, exact }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={isActive(pathname, to, exact)} tooltip={label}>
                    <Link to={to}>
                      <Icon aria-hidden />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <AccountMenu who={who} email={user.email} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        {/* Phones have no rail: a slim header opens the same sidebar as a sheet with every screen in it. */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur md:hidden">
          <SidebarTrigger aria-label="Open menu" />
          <p className="flex items-center gap-2 font-condensed text-lg font-medium leading-none">
            <AppMark />
            Plates
          </p>
        </header>
        <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-16">
          <Outlet />
        </main>
      </SidebarInset>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-3">
          {primary.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact }}
                className="flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground data-[status=active]:text-foreground"
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </SidebarProvider>
  )
}

/** The profile row at the bottom of the sidebar. Opens a menu with Settings and Sign out. */
function AccountMenu({ who, email }: { who: string; email: string }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const { isMobile } = useSidebar()
  const { signOut, busy } = useSignOut()
  /** The look is kept on the device, so it is read after mount: the server does not know it. */
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => setTheme(readTheme()), [])
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={`Account menu, ${who}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {initials(who)}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{who}</span>
                {/* An account made from an emailed link has only its email: no point showing it twice. */}
                {email !== who && <span className="truncate text-xs text-muted-foreground">{email}</span>}
              </span>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate font-medium">{who}</span>
              {email !== who && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings aria-hidden />
                Settings
              </Link>
            </DropdownMenuItem>
            {/* The look belongs to the device, not the account, so it lives here rather than in Settings. */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette aria-hidden className="text-muted-foreground" />
                Look
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(v) => {
                    setTheme(v as Theme)
                    saveTheme(v as Theme)
                  }}
                >
                  {THEME_OPTIONS.map((o) => (
                    <DropdownMenuRadioItem key={o.value} value={o.value}>
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
              <MessageSquare aria-hidden className="text-muted-foreground" />
              Send feedback
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} disabled={busy}>
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
