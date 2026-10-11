# Handover — Workout Plan v3

Written 2026-10-11, early morning, at the end of the second build session. Read this first, then
`PROJECT_CONTEXT.md` (the living plan: design decisions, phases, what is next). Keep updating
PROJECT_CONTEXT.md after every phase; the user asked for that explicitly.

## Where things stand

- Folder: `C:\Users\Gopal\projects\per\workout_plan_v3`. `git init` has been run (branch `main`)
  but there are **no commits**. Commit before touching anything big; a copy of the phase 13 tree
  sits in the scratchpad of the last session only, so git is the real safety net.
- Built and green at the last full run: 109 unit/repo tests (vitest), 36 Playwright tests
  (12 flows × phone 375, tablet 768, desktop 1280). Screenshots in `e2e/screenshots`.
- Every numbered phase is done: 1 to 13 (with 13g and 13h added this session), 14 accounts (email
  link, Google, username + password), 15 settings + start fresh, 16 splits + weekday mode,
  17 exercise library, 18 lift progress charts, 19 Excel / CSV export. Left: the shadcn-first
  audit, the React Aria decision (answered below, the user decides), phase 11's final pass.
- The user watches the dev server at http://localhost:3000 while you work and sends screenshots.
  Keep every write compile-safe (see "Things that bit us").

## What this session did (in order)

1. Fixed the e2e failure the last handover predicted: the `day` validator in `src/server/fns.ts`
   had lost its backslashes (`/^d{4}-d{2}-d{2}$/`). Setup now always writes today's weigh-in.
2. Stats page, all user requests, all e2e-covered: tap a bodyweight point to edit or remove it
   (no list), hand cursor on the chart; the 28-day strip became a month calendar (Monday first,
   previous / next month, title opens a shadcn Calendar with month and year dropdowns), each week
   is a button that drives "This week / Week of", hard sets and effort; days before the join date
   (`settings.joinedAt`) are dimmed and unpickable. (The per-session accordion chart from this
   item was replaced by the week-by-week Strength section in item 21.)
3. History: "Download Excel" (sheets Sets, Bodyweight, Measurements) and "Download CSV". Logic in
   `src/lib/logic/export.ts`.
4. Bottom sheets are the shadcn Drawer (vaul): Today's "Pick a day" and "Change session", and the
   Plan / History editors below 1024px (`src/components/app/editor-panel.tsx`, Sheet above).
   "Discard" sits next to "Change session" with a confirmation dialog.
5. Weigh-ins and tape entries can be logged under an earlier date: `src/components/app/date-picker.tsx`
   (Popover + shadcn Calendar, month and year dropdowns). Client sends `day` + `at`.
6. Phase 14 accounts (Better Auth 1.7.7, MongoDB adapter, `username` + `magicLink` plugins,
   `tanstackStartCookies`). Sign-in page offers: emailed sign-in link (primary), Google (only when
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set), and username or email + password behind
   "Sign in with a password instead". `/signup` creates username + password accounts. Every
   server function runs behind the `authed` middleware (`src/server/session.ts`) and gets
   `context.userId`; every repo function takes `userId` first; settings and plan docs are
   `_id: userId`; log collections carry `userId` with indexes. The first account created on a
   database claims the pre-account data (`claimLegacyData`, via a Better Auth `databaseHooks`
   user-create hook). Sign out in the sidebar footer and at the bottom of Plan.
   Mail: `src/server/mail.ts` sends through Resend when `RESEND_API_KEY` is set; otherwise it logs
   the mail and stores it in the `mail_outbox` collection, which the e2e reads to follow the link.
7. Forms use the shadcn `field` components (login, signup, exercise editor, log dialogs, setup
   weight step) after the user asked for it, with placeholders and more spacing (frontend-design
   skill was invoked for the auth screens; `src/components/app/auth-frame.tsx`).
8. E2E waits for a hydration flag (`html[data-hydrated="true"]`, set by the root route's
   `component`) instead of `networkidle`; clicks on server-rendered HTML had submitted the sign-up
   form natively. Every test in a project shares one page, so the session cookie survives.
9. Phase 16 splits: nine templates in `src/lib/splits.ts`, the "Which split?" setup step,
   "Change split" on Plan (`/setup?step=split`), `applySplitFn`, `settings.split`, wider day types
   with colour by family. Weekday mode: `settings.schedule`, a weekday select per day on Plan,
   `src/lib/logic/schedule.ts` (`weekdayView`, `assignWeekdays`), Today shows the matching day,
   "Rest day", "Done for today" and a "Skipped this week" list.
10. Phase 15 settings: `/settings` (units, training age, schedule, split, account, "Start fresh"
    behind typing `start fresh`), linked from the sidebar footer; the schedule switch lives
    there. `startFreshFn`. (The streak target that lived here went in item 23.)
11. Phase 17 library: 137 exercises curated from free-exercise-db by a one-off script (not in the
    repo; the picks are `src/lib/library.json`), `/library` page, `LibraryPicker` in the exercise
    editor and the import preview. 105 unit tests, 36 e2e.
12. README and PROJECT_CONTEXT.md updated for all of the above.
13. shadcn-first audit done: `number-field.tsx` on `input-group`, `sparkline.tsx` on `chart`,
    done-set buttons on `toggle`, Plan exercise rows, History rows, Today's day picker and
    library rows on `item` (with explicit Edit / Open / Start / Switch / Use buttons; the e2e
    selectors use those labels), History and library empty states on `empty`, the measurements
    table on `table`, setup progress on `progress`. `DayMark` stays.
14. Rest timer removed on user request: no countdown after a checked set; the sticky bar always
    shows "x of y sets done". `rest-timer.tsx` deleted; `restSecondsFor` kept in logic.
15. Today shows the streak next to the week count (`weeklyStreakOf` on finish dates; Today's data
    now carries a year of finished sessions as `recent`).
16. Visual pass (frontend-design skill): exercise stills by name everywhere an exercise is listed
    (`exercise-thumb.tsx`, `findLibraryByName`; a dumbbell tile when the name is not in the
    library), week shapes on the split picker (`week-shape.tsx`), section icons on Stats and
    Settings (`section-heading.tsx`), icons on the Today nudge and the skipped list.
17. Plan: "Add exercise" per day with "n of 6" (`MAX_EXERCISES_PER_DAY`), the editor in new mode
    (defaults 3 × 8-12, muscle by day type, "Add to day"), "Remove from day" with a confirmation.
    `addExerciseFn` / `removeExerciseFn`; the import and the templates respect the cap (two
    template days were trimmed from seven to six).
18. Phone navigation: a slim header with the menu button on the left opens the sidebar as a sheet,
    so History, Library and Settings are reachable on a phone. The sidebar footer is a profile
    row (avatar initials, name, email) that opens a dropdown with Settings and Sign out
    (`AccountMenu` in `_app.tsx`; shadcn `dropdown-menu` + `avatar` added).
19. Active workout: "Change session" and "Discard workout" moved under a three-dots "Session
    options" menu in the header.
20. Settings split: a shared `split-picker.tsx` (used by setup too); the current split shows as
    one row inside a shadcn Collapsible, tapping it unfolds the full picker, switching asks for
    confirmation and happens in place. Sign-in: the password form replaces the email-link form
    when toggled, instead of stacking under it.
21. Stats revamp (user: "this week 10 kg, last week 10 kg with more reps, the week before
    7.5 kg"). Strength is now the first section: a shadcn Select picks the lift (default: the
    one with the most weeks logged), the latest best set is the big number, a line chart plots
    the best set of each calendar week on a date axis in the plate colour of the lift's day,
    and a table lists the weeks newest first ("This week", "Last week", "3 weeks ago") with a
    Change column against the week before: the weight first, the reps when the weight held
    ("+2 reps"). "All lifts" under it: every logged lift with its latest set, change since its
    first week and a sparkline; tapping one selects it. The This-week section gained three
    totals: hard sets, weight lifted, minutes. Logic: `weeklyStrength`, `weekTotals` in
    `src/lib/logic/stats.ts` (unit-tested). The `.claude/skills/` folder (ui-ux-pro-max and
    friends) was installed by the user with `npx ui-ux-pro-max-cli init --ai claude`; its search
    script runs with `python .claude/skills/ui-ux-pro-max/scripts/search.py "<q>" --domain chart`
    (plain `python`, not `python -I`).
22. Minimal pass (user's list, 2026-10-11 afternoon), all e2e-covered:
    - Every explanatory sentence removed: page subtitles (Plan, Stats, Library, History, Settings),
      "tap X to" hints, chart captions, the "All lifts" list under the lift chart. Dialog
      descriptions that only explained are `sr-only`; the ones that state a consequence stay.
      Settings keeps one line per schedule mode because the user asked for it back.
    - `editor-panel.tsx`: a Dialog from 768px up (was a Sheet from 1024px), a Drawer below;
      scrollable content hides its scrollbar (`scrollbar-none` utility in `styles.css`), which the
      user chose over a shorter layout. Headers left-aligned everywhere (set once in
      `ui/dialog.tsx` and `ui/drawer.tsx`), footers ghost-then-primary.
    - Plan: "Change split" and "Sign out" buttons removed; the account menu and Settings own them.
    - Setup logs the weigh-in only on the first run or when the number changed (it re-logged
      today's weigh-in on every finish, which looked like an automatic entry).
    - Library detail: Previous / Next through the rows in view ("3 of 137"), picture beside the
      cues from 768px with a fixed-height cue column so the dialog does not jump between
      exercises.
    - Settings split: name + a chevrons button that opens a shadcn Dialog (list scrolls between a
      fixed header and footer, Keep then Switch).
    - Exercise rows: "Remove the last set" beside "Add a set" while the last set is unticked and
      not the only one (Today and the session editor). Phone sizes: step buttons 36px, smaller
      number, narrower set and done columns, so "2.5" and three-digit weights fit at 375px.
    - Today heading one size smaller on phones; the day mark stretches over a wrapped title.
    - History merged into Stats: every calendar day is a button; a day with a session opens it
      in `session-editor.tsx` (fix sets, add or drop one, delete); two sessions on a day show a
      list first. Exports moved to Stats. `history.tsx`, its nav entry and `getHistoryFn` are
      gone (`repo.getHistoryData` stays for its unit test).
    - Stats has three tabs on shadcn Tabs, kept in the URL (`/stats?tab=lifts|sessions|body`):
      Lifts (chart, table, recent bests), Sessions (week numbers, calendar, hard sets, export),
      Body (bodyweight, measurements). Default Lifts.
23. Streak and zen mode (user requests, same afternoon):
    - The streak target is gone (`settings.streakTarget`, `DEFAULT_STREAK_TARGET`, the Settings
      section, the "N sessions in a week starts a streak" lines). A streak week is now any week
      with at least one finished session (`weeklyStreak` / `weeklyStreakOf` default `min = 1`;
      the parameter stays). Today shows it top right as a flame and a big number (`Streak` in
      `index.tsx`, muted at 0, flame in the legs yellow when on); Stats says "N weeks in a row"
      under the session count when above 0.
    - Zen mode on an active workout, from the "Session options" menu: a full-screen shadcn
      Dialog (`ZenMode` in `index.tsx`) with one exercise at a time, Previous / Next, the sets-
      done count and Finish on the last exercise. Ticking the last set of an exercise moves on,
      as on the normal view, because both share `openId`. Zen mode lives in the URL (`/?zen=1`,
      `validateSearch` on the Today route) so a refresh keeps it.
24. Import templates know their split (user request). On "Bring your own plan" a Select picks the
    template to download: the current plan (carrying its own template's marker unless the plan is
    custom) or any of the nine splits (`buildSplit`). The workbook gets a `Template` sheet
    (`Split | id`, `Name`, `Days`), a first Guide line "Template: Upper / Lower, 4 days (ul4)",
    and the file name `workout-plan-template-<id>.xlsx`. On upload `splitFromMarker` reads the
    Template or Guide sheet; the preview says "Template: X." or "Custom plan.", and
    `replacePlanFn` takes `split` so `settings.split` becomes that id, or `'custom'` (a new
    `PlanSource = SplitId | 'custom'`). `planSourceInfo` / `templateOf` in `splits.ts` resolve a
    source for display and for template fallbacks; Plan shows "Custom plan, N days" and hides
    "Reset to the original plan"; Settings shows "Custom plan" with no option picked until one is;
    Setup treats custom as "no current split" so any pick applies. A CSV never carries a marker.
25. UX pass with the ui-ux-pro-max checklist (user request). Already in place: viewport-fit, safe
    areas, reduced motion, autofill attributes, inline sign-up errors, setup Back, dialog escape
    routes, confirmations on destructive actions, toasts via sonner. Added: `touch-action:
    manipulation` on tappables; small buttons grow to 44px on coarse pointers (`styles.css`,
    keyed on the shadcn `data-size`); a press scale on every Button; a route pending skeleton
    (`router.tsx`, 300ms); sign-in errors under the password field instead of a toast, with the
    401 reworded; show / hide password (`password-input.tsx`) on sign-in and sign-up; whole list
    rows tappable where the row has one action (`lib/row-tap.ts`: library rows, Plan exercise
    rows, Today's day pickers, the Stats day-session chooser), the button inside still works.
    Left alone on purpose: library rows keep the explicit "Open" button (house rule: labels over
    icons); the calendar cells stay 40px since they sit in a 7-column grid.
    The Stats Sessions tab goes two-column from 1024px, not 768px: beside the sidebar a tablet
    leaves 448px, and the calendar header overflowed into the next column (a tablet e2e hang).
    `playwright.config.ts` now asks for reduced motion (the app cuts every transition under it)
    so clicks never wait on the press animation; the suite dropped from 4 to 2.2 minutes.
26. Panel footers (user request): `EditorPanel` is header / scrolling content / fixed footer in
    both the dialog and the drawer. Content renders its action row through `PanelFooter`, which
    portals into the footer slot; a submit button there needs `form="<form id>"` because it sits
    outside the form in the DOM (the exercise editor uses `exercise-form`). The exercise editor's
    Sets / Low / High row is two-up at every width: three-up inside the 448px dialog cropped the
    numbers to one digit.
27. Looks (user request: "different minimal variants, light", "any other total different UI").
    The account menu at the foot of the sidebar has a "Look" submenu (not Settings: the look belongs
    to the device, not the account), kept in `localStorage.theme` and applied before paint
    by `THEME_SCRIPT` (`src/lib/theme.ts`, injected from `__root.tsx`), which sets
    `<html data-theme>` and adds `.dark` for a dark theme, or for the slate default on a dark
    device. The looks are token blocks in `styles.css` (`:root[data-theme='…']`), nothing else
    changes. Five, after the user trimmed a longer list ("we have a handful, just keep a few"):
    - Slate: the original, cool grey, Barlow Condensed numbers, dark with the device.
    - Chalk: the gym whiteboard, warm chalk white, graphite ink, flat (card = page), hairline warm
      borders, matte plates, 6px radius. Always light.
    - Pocket: a different app: the device's own typeface (`--app-font-sans` / `--app-font-condensed`,
      which the `@theme` font tokens now point at), 16px radius, white cards on a grey page, pull
      blue as the primary colour.
    - Catppuccin Latte and Dracula, on their published palettes (Dracula has 7.5M+ installs per a
      2025 VS Code themes guide). Red / blue / yellow / green map to push / pull / legs / success,
      the accent to `--primary` and `--ring`; Dracula is in the script's `dark` map so `.dark` is
      added and the components' dark styles apply. Their blocks were generated from hex by a
      scratch script, not typed. Dropped on request: Snow, Nord, Catppuccin Mocha, Solarized
      Light, Gruvbox, Rosé Pine Dawn, Tokyo Night (easy to bring back the same way).
    `THEME_OPTIONS` in `src/lib/theme.ts` is the list the submenu renders; `saveTheme` writes the
    key and calls `window.__applyTheme`. The e2e picks Chalk and Pocket, reloads, and checks
    `data-theme`; screenshots `17b-chalk`, `17c-pocket`.
28. Day glyphs (user: "instead of colour tags, icons or illustrations"). `DayIcon` in
    `day-mark.tsx`: a plate-coloured tile with a lucide glyph per day type (push ArrowBigUp, pull
    ArrowBigDown, legs Footprints, upper / lower ArrowUpToLine / ArrowDownToLine, full Dumbbell,
    chest Shield, back Anchor, shoulders Triangle, arms BicepsFlexed, core Target); the glyph
    scales with the tile (`size-*`). It replaced the `DayMark` bar on Plan days, Today's title and
    zen header, the day pickers, the import preview, the Stats day chooser and the session editor
    title. The bar stays for the wordmark, the sign-in frame and the week shapes. The ink on a tile
    is a token (`--day-push-ink` and friends, white / white / black-80 by default) because
    Dracula's pastel plates lost the white glyph; Dracula sets all three to its background.
29. Mail. `src/server/mail-templates.ts` holds `signInMail(url, minutes)`: a table-based HTML
    email in the app's light look (wordmark bars, condensed "Sign in", one line, one ink button,
    the link as text, a one-line footer), plus the plain-text twin; `auth.ts` sends it. The
    `mail_outbox` copy keeps `link`, which the e2e follows. `mail.ts` now surfaces Resend's error
    message. Resend facts that bit: the key had been put in `.env.example` (moved to `.env`, the
    example has a placeholder); `MAIL_FROM` must be a verified domain, and until one is verified
    the sandbox sender `onboarding@resend.dev` only delivers to the Resend account's own address
    (no domain is verified on the account as of 2026-10-11). The Resend MCP plugin is installed
    (`claude plugin install resend@claude-plugins-official`); its send tool needs the sender and
    recipient from the user.
30. Used or expired sign-in links: the magic-link request passes `errorCallbackURL: '/login'`,
    Better Auth appends `?error=INVALID_TOKEN`, and the sign-in page (`validateSearch` on `error`)
    shows an alert: the link was used already or expired, each works once, ask for a fresh one.
    The e2e keeps the emailed link (`usedLink`) and opens it again after signing out.
31. Favicon (`public/favicon.svg`: the three plates on slate, linked from `__root.tsx`) and a tab
    title per route (`pageTitle('Today')` → "Today - Workout plan", `src/lib/page-title.ts`, set
    through each route's `head`). The account menu shows the email once when the account has no
    username or name. A failed sign-in link that lands on the home page (old links carry no
    error address) is forwarded to `/login?error=` by the `_app` gate, reason intact.
32. Sign-up verification by code (user: "we should avoid the junk and not real emails", chose a
    code over a link). Better Auth `emailOTP` plugin (`otpLength: 6`, 10 minutes,
    `sendVerificationOnSignUp`) with `emailAndPassword.requireEmailVerification` and
    `emailVerification.autoSignInAfterVerification`. Sign-up makes the account, mails
    `codeMail(...)` (the digits big, in the mail frame), and the page switches to a six-box
    shadcn `input-otp` screen ("Check your email", Verify, Send a new code, Go back). A right
    code verifies the address and signs in (the client re-signs in with the password if the
    server did not). Email-link accounts are verified by the link itself. The outbox copy keeps
    `code`; `e2e/db.ts` has `lastCode(email)` and both sign-up flows type it. Rate limit from the
    plugin: 3 verify attempts a minute per address. Not done: an unverified account that tries
    the password form gets Better Auth's "email not verified" message with no way to ask for a
    new code from the sign-in page; and no DNS or disposable-domain check (the user picked the
    code route; those can still be added in front of sign-up).
34. Seeding and Vercel. `bun run db:seed` (`scripts/seed.ts`, bun) makes `seed@example.com`
    (Better Auth's own document shapes: `user` with ObjectId `_id`, `account` with the password
    through `hashPassword` from `better-auth/crypto`, `emailVerified: true`) and eight weeks of
    sessions on a split, weigh-ins every three days drifting down, tape every four weeks;
    deterministic. It only fills an empty database (user request: "a fresh db seed, not moving
    all data"): any document in `user`, `settings`, `plan`, `workouts`, `bodyweights` or
    `measurements` makes it stop without writing. It refuses a non-local `MONGODB_URI` without
    `--yes`; it prints the host, never the connection string (the `.env` URI carries the
    Atlas password). For Vercel: `nitro` is installed and `nitro()` sits between `tanstackStart()`
    and `viteReact()` in `vite.config.ts`; `bun run build` passes locally; Vercel detects the
    framework. The mail mark no longer reads `public/icon-192.png` from disk (no disk on
    serverless): `src/server/app-mark.ts` holds it as base64, written by the render-icon script.
    README has the environment variable table.
33. The app is called **Plates** (user's pick, 2026-10-11; it was "Workout plan"). Renamed in the
    wordmark, tab titles, sign-in frame, mail subjects and sender name, the template file name
    (`plates-template-<id>.xlsx`), the export file name and the README. The package name and the
    folder stay `workout_plan_v3`.
    The mark is drawn once: `AppMark` (`app-mark.tsx`) is an `<img>` of
    `/favicon.svg`, used in the sidebar header, the phone header and the sign-in frame; the
    sign-in email uses `public/icon-192.png`, the same SVG rendered with Chrome (scratch script
    `render-icon.mjs`, rerun it if the SVG changes), fetched from the app's origin because mail
    clients do not take SVG. `apple-touch-icon` points at the PNG too.

## How to run

```sh
bun install
bun run db:up          # MongoDB 7 in Docker, container workout-mongo, port 27017
bun run dev            # http://localhost:3000
bun run typecheck
bun run test           # vitest: unit + repo tests (repo tests use the Docker Mongo, db workout_plan_v3_test)
bun run test:e2e       # Playwright, starts its own server on 3100 against db workout_plan_v3_e2e
```

`.env` holds `MONGODB_URI`, `MONGODB_DB`, `BETTER_AUTH_SECRET` (generated this session),
`BETTER_AUTH_URL`. Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI
`${BETTER_AUTH_URL}/api/auth/callback/google`), `RESEND_API_KEY`, `MAIL_FROM`. See `.env.example`.
The e2e server gets its own `BETTER_AUTH_URL` (port 3100) and secret from `playwright.config.ts`.

## User requests still open, in the order agreed

1. **shadcn-first audit**: done (item 13 above). `button-group` was installed but not needed; it
   can go, or stay for later. Inline one-line empty states on Stats were left as text on purpose.
2. **React Aria instead of Radix**: answered, not done. The shadcn registry has no React Aria items
   (`bunx shadcn@latest search @shadcn -q react-aria` finds nothing; only Radix and Base UI are
   official). Third-party registries such as Jolly UI exist; switching means re-adding about 25
   components with different APIs and re-running every flow. Ask the user whether to proceed.
3. **Phase 11**: README and PROJECT_CONTEXT.md got a pass this session (accounts, library,
   settings, splits). One last read-through before calling it done.
4. Git: make the first commit.

## Things that bit us (do not rediscover)

- The Bash tool on this machine eats backslashes in inline scripts (`node -e`, `sed`); edits that
  contain `\d`, `\n` etc. silently come out wrong. Use the Edit / Write tools for those.
- **Write nothing inside the project while `bun run test:e2e` runs**, not even a new unimported
  file under `src/`: Vite reloads the page mid-test and client-only state (rest timer) vanishes.
- The user declines bursts of permission prompts. A rewritten file whose importers were not yet
  updated crashed the live app for them. Prefer a few whole-file writes over many Edits, in an
  order that compiles after each one.
- `bunx shadcn@latest add X --yes` stops at an overwrite prompt for registry dependencies that
  already exist (button, label, separator). Use `--overwrite`, then run
  `sed -i 's#from "cn"#from "\#/lib/utils"#' src/components/ui/*.tsx` and diff the overwritten
  files against the previous versions (so far they were identical apart from the import).
  `bun add` any runtime dependency the CLI skipped (vaul, react-day-picker, date-fns were fine).
- TanStack Start's `shellComponent` renders only on the server; effects there never run.
  Client-side effects go in the root route's `component` (`RootComponent` in `__root.tsx`).
- **Server-only code may only be referenced inside `.handler()` and middleware `.server()`
  callbacks.** A plain exported function in a module that routes import (it was `currentUser` in
  `session.ts`) keeps its imports in the client bundle: Better Auth and the MongoDB driver reached
  the browser, the console said `Module "events" has been externalized` and `Class extends value
  undefined`, React never mounted, and every click fell through to native form submits. No build
  or typecheck error. `src/server/auth.ts`, `repo.ts`, `mail.ts`, `db.ts` are server-only;
  `session.ts` and `fns.ts` are the client-importable surface. After touching that layer, run
  `node e2e/check-hydration.mjs http://localhost:3000/login`: it prints console errors and the
  `data-hydrated` flag.
- Every Playwright test gets a fresh browser context, so the session cookie does not survive
  between tests. `e2e/app.spec.ts` therefore shares one `page` across the serial flows
  (`test.beforeAll` creates it); do not switch back to the `{ page }` fixture.
- Without a mail provider the sign-in link is printed by the dev server and stored in
  `mail_outbox`; the user needs to know this when they try the email link locally.
- Recharts sets `cursor: default` inline on its wrapper; pass `style={{ cursor: 'pointer' }}` to
  the chart, a class on the container does nothing. Chart `onClick` reads `activeTooltipIndex`
  from the hover state; `useActiveTooltipLabel` tracks the keyboard cursor.
- Playwright `getByRole` names match substrings: "This week" also hit "Hard sets this week",
  "Next month" hit the calendar's "Go to the Next Month". Use `exact: true` near calendars.
- A vaul Drawer and a Radix Popover stay in the DOM while closing; wait for their content to be
  hidden before clicking something else with a similar name.
- Opening a Dialog or Drawer from a DropdownMenu item: the menus use `modal={false}`, otherwise
  Radix can leave `pointer-events: none` on the body when the menu's close overlaps the open.
  In e2e, open the menu first (`Session options`, `Account menu, <name>`), then the `menuitem`.
- "Sign out" lives in the account dropdown and at the bottom of Settings; the tests sign out
  from `/settings`.
- The user does not want the e2e suite run after every change: it takes 3 to 5 minutes, blocks
  project writes, and their next requests queue up. Typecheck and unit tests per change, one
  Playwright run when the batch is done.
- The repo has no prettier config. Bare `npx prettier --write` rewrites a file to double quotes,
  semicolons and 80 columns. Use `--single-quote --no-semi --print-width 120 --trailing-comma all`
  or format by hand.
- `getByRole('heading', { name: 'Barbell Row' })` also matches "Underhand Barbell Row": use
  `exact: true` wherever a name can be a substring of another.
- The e2e dev server inherits `.env` through `loadEnv` (`??=`), so once `RESEND_API_KEY` landed
  in `.env` the sign-up codes went to Resend (refused, sandbox) instead of the outbox and the
  flows found no code. `playwright.config.ts` now passes `RESEND_API_KEY: ''`. Better Auth mails
  the sign-up code in a background task, so `e2e/db.ts` polls the outbox for a few seconds.
- Mail images: a `<img src="http://localhost:3000/…">` shows broken in Gmail. The mark is now an
  inline attachment (`cid:app-mark`, `Mail.inline`, Resend `attachments[].content_id`), 4.7 KB
  base64 of `public/icon-192.png`, so it renders wherever the app runs.
- react-day-picker day buttons are named "Monday, October 5th, 2026"; the caption dropdowns are
  native selects labelled "Choose the Month" / "Choose the Year" with short month labels.
- Windows App Control blocks Playwright's own Chromium; `playwright.config.ts` uses the installed
  Chrome (`channel: 'chrome'`).
- The e2e tests are serial and share one database per browser project; run the whole suite, not
  one test. `backdateJoin` and `lastMagicLink` in `e2e/db.ts` poke the e2e database directly.
- `tsr generate` can fail with EPERM on `routeTree.gen.ts`; retry once. The Vite plugin also
  regenerates it on dev start.
- Docker Desktop was paused once; `docker desktop restart` fixed it.

## Code map

- `src/lib/types.ts` shared types (`Settings.joinedAt`, logs have `day`)
- `src/lib/seed-plan.ts` the default Push/Pull/Legs plan; `src/lib/splits.ts` the nine templates
  (`SPLITS`, `buildSplit`, `splitInfo`); `src/lib/library.ts` + `library.json` the exercise library
- `src/lib/logic/` next-day, schedule (weekday mode), progression, stats (`monthCalendar`,
  `strengthSeries`…), effort, nudges, plan-sheet (Excel import), export (Excel / CSV rows), units,
  format
- `src/lib/auth-client.ts` Better Auth client (username + magic link plugins);
  `src/lib/use-sign-out.ts`
- `src/server/db.ts` (`getDb` async, `getDbSync` for the auth adapter), `auth.ts` (Better Auth
  instance, `authOptions()`), `session.ts` (`currentUser`, `getSessionFn`, `authed` middleware),
  `mail.ts`, `repo.ts` (all reads/writes, per user), `fns.ts` (server functions, zod)
- `src/routes/` `__root.tsx`, `login.tsx`, `signup.tsx`, `setup.tsx`, `api/auth/$.ts`,
  `_app.tsx` (session gate, sidebar + account footer, bottom tabs), `_app/index.tsx` (Today),
  `_app/plan.tsx`, `_app/plan_.import.tsx`, `_app/stats.tsx` (tabs, calendar, session editing,
  export), `_app/library.tsx`, `_app/settings.tsx`
- `src/components/app/` auth-frame, body-dialogs (log + per-point weigh-in editor), date-picker,
  day-mark, editor-panel (dialog / drawer), exercise-row, exercise-thumb, export-buttons,
  library-list (list, detail with Previous / Next, picker), number-field (on input-group),
  section-heading, session-editor, sparkline (on chart, unused since the lifts list went),
  split-picker, week-shape
- `src/components/ui/` shadcn: accordion, avatar, badge, button, button-group (unused), calendar,
  card, chart, collapsible (unused), dialog, drawer, dropdown-menu, empty, field, input,
  input-group, item, label, popover, progress, radio-group, select, separator, sheet (only inside
  sidebar), sidebar, skeleton, sonner, table, tabs, textarea, toggle, toggle-group, tooltip
- `tests/` vitest (export, repo per user, stats incl. month calendar…); `e2e/app.spec.ts`
  Playwright, `e2e/db.ts` database helpers

## Design rules the user set

- Keep the default shadcn token keys; colours are `hsla()` on those keys in `src/styles.css`.
  Only purpose-named custom tokens: `--day-push`, `--day-pull`, `--day-legs`, `--success`.
- Use shadcn components wherever one exists (sidebar, accordion, chart, drawer, calendar, field
  were explicit asks). Bottom sheets are Drawers.
- Minimal, one job per screen, phone first. Barlow + Barlow Condensed. Real placeholders and room
  between fields (the user called out a cramped form).
- Explicit labels over icons. Destructive actions ask first (Discard workout, Delete session).
