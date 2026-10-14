import { createFileRoute, Link } from '@tanstack/react-router'
import { Wordmark } from '#/components/app/app-mark'
import { DemoPhone } from '#/components/app/demo-phone'
import { ExercisePictures } from '#/components/app/exercise-thumb'
import { LookMenu } from '#/components/app/look-menu'
import { DOC_COLUMN, DocPage, type DocSectionModule, sectionsFrom } from '#/components/content/doc-page'
import { Button } from '#/components/ui/button'
import { pageTitle } from '#/lib/page-title'
import { useHideOnScroll } from '#/lib/use-hide-on-scroll'
import { usePageHydrated } from '#/lib/use-page-hydrated'
import { cn } from '#/lib/utils'
import { getGuideFn } from '#/server/public-fns'

/**
 * How it works, called the guide in the code: the one page that explains (everything else stays data and
 * controls), open to anyone, signed in or not, so it can be shared. Its sections are the MDX files in
 * `src/content/guide`; see `src/content/README.md`. Outside the app layout, it brings its own header: the
 * wordmark, the look, and the way into the app.
 */
export const Route = createFileRoute('/how-it-works')({
  head: () => ({
    meta: [
      { title: pageTitle('How it works') },
      {
        name: 'description',
        content: 'How Plates works: logging a session, zen mode, targets, the plan, stats and your data.',
      },
    ],
  }),
  loader: () => getGuideFn(),
  component: GuidePage,
})

/**
 * The page's frame: the header, the welcome and the footer, as wide as the guide with its contents list (57rem) from
 * 1024px, so the welcome's words and phone sit side by side on a laptop. The guide's own text keeps `DOC_COLUMN`.
 */
const PAGE_COLUMN = 'mx-auto w-full max-w-2xl px-4 md:px-8 lg:max-w-[57rem]'

const SECTIONS = sectionsFrom(import.meta.glob<DocSectionModule>('../content/guide/*.mdx', { eager: true }))
const IDS = SECTIONS.map((s) => s.id)

function GuidePage() {
  const { signedIn, pictures } = Route.useLoaderData()
  usePageHydrated()
  const hidden = useHideOnScroll(48)
  return (
    <>
      {/* Steps aside while you read down, back as soon as you scroll up, or when a key lands focus in it. */}
      <header
        className={cn(
          'sticky top-0 z-30 border-b bg-background/95 backdrop-blur focus-within:translate-y-0 motion-safe:transition-transform motion-safe:duration-200',
          hidden && '-translate-y-full',
        )}
      >
        <div className={cn(PAGE_COLUMN, 'flex h-12 items-center justify-between gap-2')}>
          <Link to="/">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-1">
            <LookMenu />
            <Button asChild size="sm">
              <Link to={signedIn ? '/' : '/login'}>{signedIn ? 'Open app' : 'Sign in'}</Link>
            </Button>
          </div>
        </div>
      </header>
      {/* Signed in, a picture opens the exercise on the Library screen; signed out there is nothing to open. */}
      <ExercisePictures pictures={pictures} opens={signedIn ? 'library' : null}>
        <main className="pt-5 pb-16 md:pt-8">
          {!signedIn && <Welcome />}
          <div className={DOC_COLUMN}>
            <DocPage title="How it works" sections={SECTIONS} ids={IDS} />
          </div>
        </main>
      </ExercisePictures>
      <footer className="border-t">
        <div className={cn(PAGE_COLUMN, 'flex items-center justify-between gap-2 py-6 text-muted-foreground')}>
          <Link to="/" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Wordmark />
          </Link>
          <Link to="/privacy" className="text-foreground underline-offset-4 hover:underline">
            Privacy
          </Link>
        </div>
      </footer>
    </>
  )
}

/** A hand-drawn note and a squiggly arrow down to the live phone: it is the app, and it can be tapped. */
function TryIt() {
  return (
    <div aria-hidden className="flex items-end gap-1 pl-4 text-muted-foreground">
      <span className="-rotate-6 pb-6 font-hand text-2xl font-semibold">It's live. Tap around.</span>
      <svg
        aria-hidden
        viewBox="0 0 80 70"
        className="h-16 w-20 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 10 C 28 2, 52 8, 48 25 C 45 37, 27 34, 33 23 C 39 13, 61 20, 63 38 C 64 49, 60 57, 55 64" />
        <path d="M64 60 L 55 64 L 56 54" />
      </svg>
    </div>
  )
}

/**
 * The first screen for someone who has not signed in: this is the home page then. What Plates is, the way in, and
 * the app itself, live on a phone. Google sign-in makes the account, so one button serves new and returning lifters.
 * Wider than the text below from 1024px, so the words and the phone sit side by side and fit a laptop's first screen.
 */
function Welcome() {
  return (
    <section aria-label="Plates" className={cn(PAGE_COLUMN, 'mb-12')}>
      <div className="border-b pb-12 lg:flex lg:items-center lg:gap-10">
        <div className="lg:flex-1">
          <p className="font-condensed text-5xl font-semibold leading-none md:text-6xl">
            A gym logbook for the time between sets.
          </p>
          <p className="mt-4 text-lg text-muted-foreground">
            Runs in your browser on phone, tablet or laptop. No app store.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/login">Get started</Link>
          </Button>
        </div>
        {/* The whole app, live on made-up numbers, with a note that it can be tapped. */}
        <div className="mt-8 lg:mt-0">
          <TryIt />
          {/* As wide as 18rem, and never taller than the screen leaves room for under the header and the note. */}
          <DemoPhone
            screen="app"
            label="Try it: Plates on made-up numbers"
            className="mt-1 w-[min(18rem,calc((100svh-11rem)*0.49))]"
          />
        </div>
      </div>
    </section>
  )
}
