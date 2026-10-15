import { createFileRoute, Link, Outlet, redirect, useLocation } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronsUpDown,
  CircleHelp,
  Download,
  FileChartColumn,
  LogOut,
  MessageSquare,
  Palette,
  Settings,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AppMark, Wordmark } from '#/components/app/app-mark'
import { ExerciseDialog, ExerciseListProvider } from '#/components/app/exercise-dialog'
import { ExercisePictures } from '#/components/app/exercise-thumb'
import { FeedbackDialog } from '#/components/app/feedback-form'
import { InstallDialog } from '#/components/app/install-dialog'
import { LookRadioGroup } from '#/components/app/look-menu'
import { PendingPage } from '#/components/app/page-skeletons'
import { PRIMARY_TABS, TabBar } from '#/components/app/tab-bar'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { accountName } from '#/lib/format'
import { useInstallApp } from '#/lib/install-app'
import { readShell, rememberShell } from '#/lib/shell'
import { ContentProvider } from '#/lib/use-content'
import { usePageHydrated } from '#/lib/use-page-hydrated'
import { useSignOut } from '#/lib/use-sign-out'
import { getContentFn } from '#/server/fns'

export const Route = createFileRoute('/_app')({
  // ?exercise=<library id> opens the library's view of that exercise over any screen; see ExerciseDialog.
  validateSearch: (search: Record<string, unknown>): { exercise?: string } =>
    typeof search.exercise === 'string' && search.exercise ? { exercise: search.exercise } : {},
  // Signed out: the home page is How it works, any other screen asks to sign in first.
  // Signed in but not set up: three questions first. The shell is kept a while on the client (lib/shell.ts).
  beforeLoad: async ({ location }) => {
    const shell = await readShell()
    if (!shell) {
      // A failed sign-in link can land on the home page with ?error=…; carry the reason to the sign-in page.
      const error = new URLSearchParams(location.searchStr).get('error')
      if (error) throw redirect({ to: '/login', search: { error } })
      throw redirect({ to: location.pathname === '/' ? '/how-it-works' : '/login' })
    }
    if (!shell.settings.setupDone) throw redirect({ to: '/setup' })
    rememberShell(shell)
    return { user: shell.user, shell }
  },
  // The split templates and the exercise library, once per visit; the layout provides them to useContent().
  loader: () => getContentFn(),
  staleTime: 60 * 60 * 1000,
  component: AppLayout,
  pendingComponent: AppPending,
})

/** The page column of the layout below, for what stands in while the layout's own data loads. */
const PAGE_COLUMN = 'mx-auto w-full max-w-2xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-16'

/** While the content loads: the page column with the bones of the page being gone to; the frame follows. */
function AppPending() {
  return (
    <main className={PAGE_COLUMN}>
      <PendingPage />
    </main>
  )
}

const secondary = [
  { to: '/report', label: 'Report', icon: FileChartColumn, exact: false },
  { to: '/library', label: 'Library', icon: BookOpen, exact: false },
  { to: '/how-it-works', label: 'How it works', icon: CircleHelp, exact: false },
] as const

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
  const { user, shell } = Route.useRouteContext()
  const content = Route.useLoaderData()
  usePageHydrated()
  // The shell this visit was rendered with, kept for the moves that follow.
  useEffect(() => rememberShell(shell), [shell])
  const who = accountName(user)
  return (
    <ContentProvider content={content}>
      <ExercisePictures pictures={content.library} opens="here">
        <ExerciseListProvider>
          <SidebarProvider>
            <CloseSidebarOnNavigate />
            <Sidebar collapsible="icon">
              <SidebarHeader className="h-12 flex-row items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center">
                <Link
                  to="/"
                  className="flex min-w-0 items-center gap-2 pl-1 font-condensed text-xl font-semibold leading-none group-data-[collapsible=icon]:hidden rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <AppMark className="size-7" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">Plates</span>
                </Link>
                <SidebarTrigger aria-label="Toggle sidebar" />
              </SidebarHeader>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarMenu>
                    {[...PRIMARY_TABS, ...secondary].map(({ to, label, icon: Icon, exact }) => (
                      <SidebarMenuItem key={to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(pathname, to, exact)}
                          tooltip={label}
                          className="h-9 text-base"
                        >
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
                <AccountMenu who={who} email={user.email} image={user.image} />
              </SidebarFooter>
              <SidebarRail />
            </Sidebar>

            {/* No page colour of its own: the body's, and the look's backdrop behind it, show through. */}
            <SidebarInset className="min-w-0 bg-transparent">
              {/* Phones have no rail: a slim header opens the same sidebar as a sheet with every screen in it. */}
              <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur md:hidden">
                <SidebarTrigger aria-label="Open menu" />
                <Link to="/" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <Wordmark />
                </Link>
              </header>
              <main className={PAGE_COLUMN}>
                <Outlet />
              </main>
              <ExerciseDialog />
            </SidebarInset>

            <TabBar
              className="fixed inset-x-0 bottom-0 z-40 pb-safe md:hidden"
              renderTab={(tab, content, className) => (
                <Link to={tab.to} activeOptions={{ exact: tab.exact }} className={className}>
                  {content}
                </Link>
              )}
            />
          </SidebarProvider>
        </ExerciseListProvider>
      </ExercisePictures>
    </ContentProvider>
  )
}

/** On a phone the sidebar is a sheet over the screen: a tap on one of its links closes it as the screen changes. */
function CloseSidebarOnNavigate() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const shown = useRef(pathname)
  useEffect(() => {
    if (shown.current === pathname) return
    shown.current = pathname
    setOpenMobile(false)
  }, [pathname, setOpenMobile])
  return null
}

/** The profile row at the bottom of the sidebar. Opens a menu with Settings and Sign out. */
function AccountMenu({ who, email, image }: { who: string; email: string; image: string | null }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  /** Shown only where Plates can be installed and is not yet. */
  const { way: installWay } = useInstallApp()
  const { isMobile } = useSidebar()
  const { signOut, busy } = useSignOut()
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
                {/* Google's picture when there is one; the initials show until it loads, or always for a password account. */}
                {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" className="rounded-md" />}
                <AvatarFallback className="rounded-md bg-primary font-semibold text-primary-foreground">
                  {initials(who)}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-base leading-tight">
                <span className="truncate font-medium">{who}</span>
                {/* An account made from an emailed link has only its email: no point showing it twice. */}
                {email !== who && <span className="truncate text-muted-foreground">{email}</span>}
              </span>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {/* On a phone the menu stays narrow and hugs the sheet's left edge, so the Look submenu fits beside it. */}
          <DropdownMenuContent
            className={isMobile ? 'w-44 rounded-lg' : 'min-w-56 rounded-lg'}
            side={isMobile ? 'bottom' : 'right'}
            align={isMobile ? 'start' : 'end'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-base font-normal">
              <span className="block truncate font-medium">{who}</span>
              {email !== who && <span className="block truncate text-muted-foreground">{email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-base">
              <Link to="/settings">
                <Settings aria-hidden />
                Settings
              </Link>
            </DropdownMenuItem>
            {/* The look belongs to the device, not the account, so it lives here rather than in Settings. */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-base">
                <Palette aria-hidden className="text-muted-foreground" />
                Look
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <LookRadioGroup />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={() => setFeedbackOpen(true)} className="text-base">
              <MessageSquare aria-hidden className="text-muted-foreground" />
              Send feedback
            </DropdownMenuItem>
            {installWay && (
              <DropdownMenuItem onSelect={() => setInstallOpen(true)} className="text-base">
                <Download aria-hidden className="text-muted-foreground" />
                Install app
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} disabled={busy} className="text-base">
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        <InstallDialog open={installOpen} way={installWay} onClose={() => setInstallOpen(false)} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
