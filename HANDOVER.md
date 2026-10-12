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
63. Two days on one weekday (found by the walkthrough on a Tuesday). `weekdayView` took the first day
    on today's weekday; when that one was done and another day had been moved onto the same
    weekday, Today said "Done for today" with the other still waiting. It now prefers the day on
    today's weekday that is not done yet. The calendar e2e's expected best set follows the 5 kg
    barbell step (65 × 7 outscores the edited 60 × 9).
62. The smallest plate (user: "as the weight increases we cannot add more weights like how we
    used to", then "I didn't see any 1.25 kg plates, the minimum is 2.5", then "collect the
    minimum plate ... use that for their plans", "per person", "not in the setup, just set it to
    2.5 in the settings"). A barbell takes a plate each side, so with 2.5 kg as the smallest plate
    the smallest barbell step is 5 kg; the app stepped every upper-body lift by 2.5 kg, a step
    that does not exist on most barbells. `Settings.plate` (unset reads as 2.5, `plateOf`),
    `PLATES` per unit (kg 1.25 / 2.5 / 5, lb 2.5 / 5 / 10), set in Settings under Units only,
    never asked at setup. `incrementFor(muscle, units, equipment?, plate?)`: barbell = two plates,
    dumbbell = one rack step (2.5 kg / 5 lb), machine, cable and unknown lifts keep the stack rule
    (2.5 upper / 5 lower kg; 5 / 10 lb). `startWorkout` looks the lift up in the library and
    stores its `equipment` on the entry, and hands equipment and plate to `suggestNext`; the rows
    on Today, Zen and the session editor take `plate` and read the entry's equipment. Not done:
    smaller steps than the plate allows (microloading); per-gym settings.
61. The set ramp (user: "do some research on progressive overload ... we'll be implementing this on
    the frequent workouts sets count", then a four-week example, then "go"). Research: weekly sets
    per muscle have a dose-response with diminishing returns (Schoenfeld 2017; Pelland et al.,
    Sports Medicine 2025), the weekly total matters more than its split, and the coaching model
    (Israetel / RP) ramps a set a week through a block, holds when recovery slips, then deloads.
    `src/lib/logic/ramp.ts`: `rampOffer(ex, weeklyByMuscle, workouts, now, trainingAge)` is true
    when the lifter is over a year in, the exercise is under 6 sets, its muscle under 20 planned
    sets a week, it has not ramped this calendar week (`Exercise.ramp.at`), it was trained at
    least twice in the last 14 days with every one of those sessions completed in range
    (`completedInRange`: every set done at or above repMin) and rated ok or easier, and its trend
    is neither stuck nor slipping. `startWorkout` reads 90 days of sessions and marks eligible
    entries `rampOffer: true`; the row on Today and Zen show "+1 set to plan"; `acceptRampFn` →
    `repo.acceptRamp` raises the plan exercise's sets (keeping `ramp.base`, the plan's own number,
    and the week) and adds a blank set to the session aiming where the set before it aims; the
    row shows it at once. Editing Sets by hand clears the ramp (the typed number is the plan).
    The deload card on Stats grows a button, "Drop the extra sets on N lifts", → `resetRampFn` →
    every ramped lift back to its base. Unit tests in `tests/ramp.test.ts`. Not done: an e2e
    step (two completed, rated, in-range sessions inside two weeks are a walkthrough fixture; add
    one to `explore.spec.ts` with `plantBenchSession`), and smaller plate steps on heavy upper-body
    lifts (user asked whether steps should shrink as the bar gets heavy; answered: yes above
    about 50 kg on upper lifts, pending whether the gym has 1.25 kg plates).
60. Trend chips on the Lifts tab (user: "we can add more filters ... if I'm not progressing then
    we should add some filter for not progressing ... it should be meaningful or fit for the
    place"). `src/lib/logic/trend.ts`: `liftTrend(weeks, now)` reads a lift's weekly best sets
    over the stall alert's four-week window, so Today and Stats never disagree: idle (no session
    in 14 days), new (under three weeks of history), then the best of the last four weeks against
    the best before them: climbing above, slipping five percent under, stuck otherwise; with no
    history before the window the latest week stands against the weeks before it. The strength
    panel shows a row of chips, All plus one per trend that has a lift, each with its count, and
    the lift dropdown lists only the lifts of the pressed chip, every entry carrying its trend in
    grey. Unit tests in `tests/trend.test.ts`.
59. Repair for data the swap bug left behind (user: "I have some real workout data that has been
    added when we had that bug ... I need to add the weights"). Sessions logged while Lat Pulldown
    carried "bodyweight" have no weight field in the session editor, so the weights could not be
    added by hand. `scripts/repair-load-types.ts` (`bun run db:repair`, `--yes` to apply) walks
    plans, the legacy plan and workouts, and where a name is in the library and the type disagrees it
    flips only the bug's two shapes: bodyweight → weight when the library says weight; weight →
    bodyweight when the library says bodyweight and no set has a weight above zero. It lists every
    change with the user, the plan or the session date, and writes nothing without `--yes`. After
    it, the weights go in through Stats → the day on the calendar → the session → Save.
58. A flaky "Open menu" on the phone viewport, found by the suite twice in one evening in two
    different tests, each right after `open(page, '/')`. The trace showed the click landing and
    nothing opening. Cause: `__root` sets `data-hydrated` when the root hydrates, but the `_app`
    layout's data streams in and its subtree hydrates a beat later; a click in that gap hits
    server HTML with no handler. The layout now sets `data-app-hydrated` in its own effect
    (cleared on unmount), and the `hydrated` helpers in both specs wait for it on every page that
    is not login, signup, setup or privacy.
57. Zen mode laid out like a clock app (user: "in the zen mode, clearly there are lot of space try
    to find a way to utilize it (for example refer Pixel mobiles default android clock
    applications) - and the main actions more easily accessible", with the ui-styling,
    ui-ux-pro-max and frontend-design skills). `src/components/app/zen-mode.tsx`, out of
    `index.tsx`. One set at a time on a pad: the exercise name in the condensed face, the plan's
    sets × reps and the target hint under it, a row of 44px dots for the sets (ticked ones green,
    the one on the pad ringed; a tap brings any set back to the pad), then the numbers at 72px with
    a 56px round − and + under each, then one full-width 64px pill, "Set N done" (or "Undo set N"
    for a ticked set), then the small add/remove set buttons, and the Previous / Next / Finish bar
    with 48px buttons. The pad follows the first unticked set; ticking moves it on. On a weight
    exercise with every set ticked the reps-left question takes the pill's place, three 56px
    options, and the pill shows again only for a set brought back by its dot. The exercise shown
    is the current one, else the first with a set left, else the last (the old code fell back to
    the first exercise once everything was ticked). Accessible names are unchanged ("Mark set N
    done", "Set N weight", "Previous exercise", "Next exercise", "Exit zen"), so the e2e steps
    held, except that the pad no longer shows set 1 after it is ticked: the walkthrough checks
    the ticked dot and set 2's placeholder instead.
56. An alternate brings its own load type (user: "on the push day, the default suggested exercise
    was pull-ups ... I changed it to the alternate ... Lat Pulldown requires weights ... I'm not
    seeing the weights"). `repo.swapExercise` changed only the name, so Pull-ups (bodyweight)
    swapped to Lat Pulldown stayed bodyweight and the logger showed no weight field. Checked every
    alternate pair in the templates and the day blocks: five cross a load type (Pull-ups ↔ Lat
    Pulldown, Neutral-Grip Lat Pulldown → Chin-ups, Weighted Push-ups → Deficit Push-ups, Seated
    DB Shoulder Press → Pike Push-ups). The swap now looks the new name up in the library and
    takes its load type and muscle; a name the library does not know gets `guessLoad` from the
    plan-sheet parser (push-ups, pull-ups, dips and the like read as bodyweight). Repo test added.
    A plan that already holds a mis-typed exercise is fixed by Edit → Type, or by swapping again.
55. The Vercel function sits in Mumbai (user: "the site feels slow, i deployed in free vercel").
    Measured on the live site through the user's own browser session: the HTML's first byte in 50
    ms, but a full server render of Today in about 2 s, Plan 1.7 s, Library 1.2 s, and a tab
    switch two server-function calls in a row of 850 ms and 1,000 ms. The response header
    `x-vercel-id: bom1::iad1::…` gave the cause: the edge was Mumbai but the function ran in
    Washington, Vercel's default, while the Atlas M0 cluster is in AWS ap-south-1 (Mumbai), so
    every query in a page's chain of queries crossed the planet at about 250 ms. The fix is
    `nitro({ vercel: { functions: { regions: ['bom1'] } } })` in `vite.config.ts`, which Nitro
    writes into the function's `.vc-config.json`; the Hobby plan allows one region. A single
    database-backed call from India measured 200 ms warm and 900 ms on a cold start, so the
    platform itself was never the slow part, and no free host would have fixed a cross-planet
    database. Still open after this: each page is several server calls in sequence (the layout's
    session check, then the content, then the page loader), and the exercise stills are the 73 KB
    originals from GitHub; both are the next things to trim if it still feels slow.
54. "Not now" on the reminders (user: "option to close this suggestion for weight and the
    measurement as well. show it again in some other time, maybe after a day or next week, do
    some research on this before implementation"). Research: a field study of snoozing on phones
    (Weber et al. 2018, "Snooze!") found health and fitness prompts are deferred far less than
    messages or social alerts, and deferrals cluster at short waits or "tomorrow"; habit-app
    studies find reminders raise adherence but frequent ones fatigue and people come to lean on
    them, so a prompt should return rather than vanish; reminder-app guidance keeps nagging for
    high stakes (medication) only. No convention in the gym apps to copy (MacroFactor's weigh-in
    reminder is a feature request; Hevy and Strong have none). Built: an X, "Not now", on the
    Today card. `Settings.nudges[kind] = { at, times }`; `dismissNudgeFn` → `repo.dismissNudge`,
    which counts `times` up when the previous wave-away is newer than the last log of that
    thing, else starts at 1. `snoozeDays(kind, times)` is a quarter of the cadence, doubling,
    capped at the cadence: the scale 1, 2, 4, 7 days; the tape 7, 14, 28. `nudgeFor` takes the
    snoozes, ignores one older than the last log, and lets the next due reminder show when the
    first is quiet (still one at a time). Today hides the card at once and reloads the data.
53. The library's view from any row (user: "what if i want to know more about the exercise",
    "without leaving the current page", then "refactor it to the url param approach"). The app
    layout (`src/routes/_app.tsx`) validates `?exercise=<library id>` and renders one
    `ExerciseDialog` (`src/components/app/exercise-dialog.tsx`) under the outlet: it reads the
    param with `useSearch({ strict: false })`, finds the entry in the loaded content and shows
    `LibraryDetail` (the still, the cues, what it works) as the drawer or dialog the Library tab
    uses, over whatever screen is open. `ExerciseThumb` is a `Link` to the current page with the
    param added (`to: '.'`, `search: (prev) => ({ ...prev, exercise })`), labelled "About <name>",
    wherever the name is in the library: Plan rows, the day preview on Today, the rows of a
    session, the session editor on Stats. A name the library does not know keeps the grey tile.
    The user's reasoning, which holds: one dialog in the layout instead of one per row, nothing
    to stop events through portals, a reload or a shared link reopens it, and the browser's back
    closes it. History: the link pushes with `state: { fromRow: true }`, so closing calls
    `history.back()` and the stack is left as it was; opened by a typed URL or a reload there is
    no such entry, so closing replaces the URL without the param. The session row keeps the still
    outside the accordion trigger (a button cannot hold a link). The Library tab uses the same
    dialog (user: "we can reuse this dialog component on the library page as well"): a row
    navigates to `/library?exercise=<id>`, so every entry has a URL, and the page lends the dialog
    its filtered list through `ExerciseListProvider` / `useExerciseList(list)` in the layout, which
    is what puts Previous and Next in the footer; stepping replaces the id in place so the history
    does not grow. The plan editor's picker keeps its own view: a selection flow inside an open
    dialog, with "Use this". e2e locators
    that matched a row's button by the exercise name alone are anchored at the start, since the
    first version made the still a button that matched too; harmless now, kept.
52. Sets on the Plan row against the editor (user: "under plan you can see 3x but under edit it
    shows 4"). The row shows `plannedSetsFor`, which under a year caps each exercise at 3 a
    session, while the editor shows the stored number. The editor's Sets field now says "Capped
    at 3 a session while under a year." whenever the typed number is above the cap, so the two
    numbers explain each other. Tried and dropped the same day: a set of custom day-type and
    muscle glyphs drawn on Lucide's grid (push, pull, legs, chest, back, shoulders, biceps,
    triceps, quads, hamstrings, calves, abs). At the 14 to 20px the chips and tiles allow they
    read as squiggles; the user asked for them to go, and `DayIcon` keeps its Lucide icons.
    Should this come back, the way that works at that size is a filled mini silhouette from
    `body-figures.ts` with the muscle painted, not strokes.
51. Walkthrough, fourth pass: a past week on the Stats calendar points every number at that week
    (the week section, the kilos, the map's labels, and "Back to this week"), and a template's
    "Reset to the original plan" restores the template while the plan of your own keeps its swapped
    alternate and its five-set bench. 19 steps per viewport, 57 in all. This pass found nothing in
    the app; every failure on the way was the script's own arithmetic (the planted copy sits in
    the same past week, the bench had five sets by then) or a heading matched twice ("This week"
    is also in "Hard sets this week": match exact). Two of four passes found bugs, two found none,
    which is where the round stops.
50. Walkthrough, third pass (user: "we planned for recursive test runs"). Seven more steps in
    `e2e/explore.spec.ts`: the linear method's targets, Zen mode across a reload, the feedback
    prompt on the fifth session (and not on the sixth), the weekday schedule putting a day on
    today, an alternate swapped in and showing on Today, add and remove set in the session editor,
    the under-a-year cap in the logger itself, an empty library search and the CSV row count
    against the database. Found and fixed: (a) two first requests on an empty database both tried
    to seed the content and one died on a duplicate key (`E11000 … splits … ppl6`): `readContent`
    now shares one in-flight read per process and `seedContent` inserts unordered and treats
    duplicate keys as already seeded; (b) the library picker scrolled as a whole, so its title and
    close button left the screen (user: "the title close button everything goes away as we
    scroll"): the dialog is now a fixed header over a scrolling body, like `EditorPanel`. The
    walkthrough runs 17 steps per viewport, 51 in all, clean on the rerun.
49. Screen stays on during a session (user: "is it possible to keep the option to make the
    screen…", then "add it after the round"). `useWakeLock(active)` in `src/lib/use-wake-lock.ts`
    asks for a screen wake lock while `active` and the page is visible, asks again on
    visibilitychange (browsers drop the lock when the page leaves the foreground), releases on
    cleanup, and does nothing where the API is missing or refused (Chrome and Edge on Android and
    desktop, Safari on iOS 16.4+; a secure origin is required, which the deployed site is).
    `ActiveWorkout` on Today holds it while a session is in progress unless
    `settings.keepAwake === false`; Settings has a "Screen during a session" toggle, "Keep it on"
    (default) / "Let it sleep". The library picker inside the plan editor overflowed its dialog
    (user found it): a dialog lays its content out as a grid item, which will not shrink below the
    width of the scrolling tag rows unless it is `min-w-0`; the list's root now is.
48. Walkthrough as a user (user: "run through the platform like a real user on all different
    viewports exploring every single feature… validating the logics which are linked with
    multiple places… again and again until you find no bugs"). `e2e/explore.spec.ts`, run by
    `bun run test:explore` (its own `playwright.explore.config.ts`; the regular suite ignores it):
    signs up, builds a three-day plan of your own, logs a session with the logger's rules, checks
    Stats against the logged numbers (hard sets, kilos, the map's labels, the Lifts table), moves
    the session back a week through the database (and backdates the join, since days before
    joining are out of reach on the calendar), checks the targets under two methods, switches
    splits and comes back, plants weigh-ins and old sessions for the Today alerts, edits a set from
    the calendar, flips units, training age and schedule, walks the library tags and detail, and
    screenshots every look; thirty steps across phone, tablet and desktop. Found and fixed:
    (a) marking the last set of a weight exercise done jumped to the next exercise at once, so the
    reps-left question could never be answered: a weight exercise now stays open until the
    reps-left tap, which then moves on (bodyweight and timed work still move at the last set);
    (b) a plan of your own could be left for a template but never found again, since "Your own"
    always built a fresh one: Settings now loads the plan slots (`getPlanSlotsFn`, `planSlots`),
    the picker shows "Your plan, as you left it" with "Start over with new days" behind a button
    (`ownPlan`, `ownMode`), the button reads "Back to my plan" and `applySplit('custom')` returns
    the kept plan (throws when none); (c) with reps to spare the hint said "try 65 kg" while the
    targets put each set a step above its own last weight: every set now targets the top weight
    plus a step; (d) the Plan intro read "Push / Pull / Legs, 3 days, 3 days" for templates whose
    name carries the day count; (e) the Rules list still mentioned the removed rest timer; (f) a
    muscle the plan does not ask for no longer shows "0 of 0" on the map. Not bugs: the calendar
    disables days before the join date; "Failed to fetch" in the dev console during the
    walkthrough comes from full-page navigations aborting a loader fetch, which link navigation
    never does.
47. Feedback with little friction (user: "how do we collect feedback… generally feedback forms
    will ask for a lot of information so mostly users will skip them… decide where to provide the
    feedback form"). Decision: one place plus one moment, never page by page. The account menu has
    "Send feedback" (`FeedbackDialog` in `src/components/app/feedback-form.tsx`): three faces
    (Rough / OK / Good, `MOODS` in `src/lib/logic/feedback.ts`) and an optional line, nothing
    else asked; a face or a line is enough to send. The same fields appear once in a while at the
    foot of the finish summary (`SummaryDialog`, compact, with a Send beside Done): after
    `FEEDBACK_AFTER_SESSIONS` (5) finished sessions and then every `FEEDBACK_EVERY_DAYS` (30),
    dismissing counts as asked (`dismissFeedbackFn` → `settings.feedbackAt`). `finishWorkout`
    returns `askFeedback` from `feedbackDue(sessionsDone, feedbackAt, now)`. `sendFeedbackFn`
    stores `{ userId, at, mood?, text, route, trigger }` in the `feedback` collection (deleted
    with the account) and mails a copy to `FEEDBACK_TO` when that env var is set, through
    `sendMail`. The privacy page lists feedback among what is stored. Research notes: trigger on an
    event the person just completed rather than a page load or a timer, one question with an
    optional open line, a cooldown of two to four weeks per person, and never mid-task (vendor
    guides from Refiner, SurveySensum, Simplesat; Apple's rating prompt rules as the pattern for
    asking after a completed sequence and capping how often). Tests: `tests/feedback.test.ts`;
    the e2e sends feedback from the menu.
46. Sessions tab tidy-up around the map. The week header is three quiet lines under the big
    number: "1 week in a row, effort ok." and "18 hard sets · 2,202 kg · 2 min" (user: "try to
    provide these information minimally"); the three `Figure` tiles are gone. From 1024px the week
    section spans the tab with the summary left and the calendar right (user: "distribute this
    information to take the right side empty space"), and the map section spans it too with the
    two figures side by side from 640px, each scaling to its cell (`h-auto w-full max-w-[22rem]`),
    which also stopped the figures overflowing onto the Export buttons. `SessionEditor` now holds
    the edited entries itself and resets them when the session id changes: `EditorPanel` swaps
    between a Drawer and a Dialog when the viewport crosses 768px, which remounts its content, and
    a full-page screenshot in the e2e nudged the viewport across that line between typing a rep
    and saving, so the typed change was lost (the "60 kg × 9" flake). The e2e now asserts the
    field holds 9 before saving, and taps a map muscle with a dispatched click because a muscle
    group's centre can fall between its two halves.
45. Body map (user: "build a human body svg, that highlights the muscle groups… red - those parts
    are not trained on that week, green - those parts are trained", then "looks too basic man… try
    to build a real human like", "or look web for any source codes"). The figures are the polygon
    data of react-body-highlighter by GV79 (MIT, notice kept in `src/lib/body-figures.ts`), a
    1000 × 2200 box, front and back, its twenty-three muscle groups folded into the app's nine
    (`make-polygons` mapping: front and back deltoids → shoulders, trapezius and upper back →
    back, obliques → abs, soleus → calves; head, neck, forearms, knees, glutes, hips and lower
    back stay in the body colour). `src/components/app/body-map.tsx`: `BodyMap` renders both
    figures, every part with a page-coloured seam; `regionPaint(done, target)` is grey when the
    plan has no sets for the muscle, red (`--destructive`) when it has and nothing is logged,
    green (`--success`) from 0.4 to 1 towards the plan's number, so red means behind rather than
    skipped. Each muscle is a focusable button labelled "Chest: 6 of 12 sets" and carries its name and
    count as a label with a leader line in the margin beside the figure (`LABEL_SIDE` fixes the
    side per muscle; crowded sides nudge later labels down), so the old hard-sets list under the
    map is gone (user: "shall we combine this info to the figure"). A tap outlines the muscle in
    the foreground colour. The body is `--muted-foreground` at 0.2 so it shows on light themes
    (user: "in light theme hard to see"); each figure has a Front / Back caption (user: "specify
    back and front"). `BodyMapLegend` has the three swatches. Sits at the top of the "Hard sets" section on the Sessions tab, following the
    picked week. A 3D model was considered and declined (mesh and renderer weight, no free model
    with split regions, WebGL on phones, a figure that must be turned to read); a first
    hand-drawn version of rounded blocks was replaced by the polygons. Tests:
    `tests/body-map.test.ts`; the e2e taps Back on the map after the first session.
44. Custom split with little friction (user: "what if the user follows some other split which is
    not found in the list… simple and minimal options with less user friction to create a custom
    split"). Two layers. (a) Day editing on Plan: "Add a day" under the accordion opens a grid of
    the eleven day kinds; a new day is named after its kind ("Push", then "Push 2") and starts with
    that kind's block of five lifts (`DAY_BLOCKS`, `buildDay` in `src/lib/day-blocks.ts`, every
    name in the library; `DAY_LABEL` moved there and re-exported from `day-mark.tsx`). Each open
    day has a "Day" menu: rename or change kind (`DayDialog`/`DayForm`), move up/down, remove
    (confirm; the plan keeps at least one day). Repo: `addDay` (assigns a weekday under the weekday
    schedule, `MAX_DAYS` = 14), `updateDay`, `removeDay`, `moveDay`; server functions `addDayFn`,
    `updateDayFn`, `removeDayFn`, `moveDayFn`. (b) "Your own" at the end of the split picker
    (setup and Settings): two to six days, a kind per day from a Select with the day icon, add or
    take a day away, the week shape underneath (`OwnDaysEditor`, `OWN_SPLIT = 'custom'`,
    `DEFAULT_OWN_DAYS` = upper/lower ×2). Building calls `createCustomPlanFn({ types })` →
    `repo.createCustomPlan` → `replacePlan(buildCustomDays(types))`, so it takes the custom slot
    (repeated kinds read "Upper A", "Upper B"). In setup "Your own" always counts as switching and
    says it replaces the plan of your own; in Settings a custom plan shows "Your own" as picked and
    the button reads "Build my plan". The custom source's fit line is "Your own days, or your own
    file." Sidebar: the app mark hides in the collapsed rail so the toggle sits centred over the
    nav icons (user screenshot). Tests: `tests/day-blocks.test.ts`, repo tests for days and the
    custom plan; e2e adds a day on Plan, renames, moves and removes it, and builds a five-day plan
    of your own from Settings.
43. Delete account and a privacy page (user: "delete their account and data, where we entirely
    remove their data trace from the db, while keeping a small log… a privacy page… enter a text
    to confirm deletion, with options to export their log"). `repo.deleteAccount(userId)` removes
    settings, legacy `plan`, `plans`, workouts, bodyweights, measurements, the Better Auth
    `session` and `account` docs (userId matched as string and ObjectId), pending `verification`
    rows for the address, `mail_outbox` mail to it, and the `user` doc, then writes one line to
    `deletions`: `at`, `emailHash` (SHA-256 of the lower-cased email), `sessions` finished,
    `daysActive` since joining. `deleteAccountFn` (POST, authed). Settings gained a "Delete
    account" section (UserX icon) after Start fresh: the consequence line with a link to
    /privacy, the Excel / CSV `ExportButtons`, and a Dialog with the typed confirmation
    "delete my account" and a "Delete everything" button; afterwards the client clears the cookie
    (`authClient.signOut()`, failure ignored) and lands on `/login?deleted=true`, which shows
    "Your account and all of its data are deleted." (`deleted` in the login route's
    validateSearch). `/privacy` is a public route on `AuthFrame`: what is stored, what it is used
    for, who can see it, taking it with you, deleting it; linked from the login and signup
    footers and from the delete section. e2e: a last test finishes setup, visits the privacy
    page, deletes the account, checks the notice, that the username no longer signs in, and
    `traceOf(email)` in `e2e/db.ts` (user, account, session, settings, plans, workouts all 0,
    deletions 1).
42. Bodyweight work scored at bodyweight (user: "is it worth it" → the one piece worth doing).
    `Workout.bodyweight?` is filled in when sessions are read, never stored:
    `attachBodyweight(workouts, logs)` in `stats.ts` gives each session the latest weigh-in on or
    before it, else the first after it; `getStatsData`, `getTodayData` (for the stall alerts) and
    `finishWorkout` (for the summary) attach it. `setScore(entry, set, bodyweight?)` scores a
    bodyweight set as the Epley estimate at that weight when known, reps alone otherwise, so 8
    pull-ups at 80 kg beat 8 at 70 kg and a heavier lifter's work shows in new bests;
    `weekTotals.lifted` adds bodyweight × reps over bodyweight sets. The Lifts chart and tables
    still show reps for bodyweight exercises. Not done, on purpose: plate steps by bodyweight,
    added weight on pull-ups and dips. Tests under "bodyweight work" in `tests/stats.test.ts`.
41. Follow-ups on the same day. `ProgressionPicker` (`src/components/app/progression-picker.tsx`)
    is shared by setup and Settings: an icon per method (ArrowUpNarrowWide, ArrowUp, Target), one
    plain line and a worked example in a muted box (`example` on `PROGRESSION_OPTIONS`); titles
    are "Reps first, then weight", "Weight every session", "Last set all out" (user: "add any
    images or icons for reference, and simplify the description"). Under "Reps first", a set below
    the top of the range now aims one rep higher than last time (capped at repMax) and the hint
    says "Aim for 11" (user screenshot showed 10 repeating 10). The Sign out button left the
    Settings Account section (user request); sign out lives only in the sidebar account menu, and
    the e2e has a `signOut(page)` helper that opens that menu (the sidebar first on phones).
    `playwright.config.ts` pins `MONGODB_URI` to the local Docker database for the e2e server and
    `e2e/db.ts` does the same, because `.env` can point at Atlas (the run failed on a refused SRV
    lookup before that). Setup progress reads "1 of 5". Full e2e: 36 passed. A `data/` folder
    with one JSON file per collection was exported from the local database for a schema review
    (user: "extract the data into json files"); `account.json`, `session.json` and `user.json`
    hold local credentials and must not be committed.
40. Built for gains (user: "we are not just building things, we really want the user to progress
    and see some gains"). Four pieces:
    - Finish summary: `finishWorkout` now returns `{ finished, summary }`; `summarize` in
      `src/lib/logic/summary.ts` lists each lift's best set, marks a new best (`pr`, by Epley score
      against every earlier session) and the top-weight change against the previous session of that
      lift ("+2.5 kg"), plus the week's count against `plannedPerWeek(plan, settings)` (weekday
      days, or rolling days up to six). `SummaryDialog` on Today ("Workout saved" title, Trophy for
      a best, Done button); the e2e expects it and clicks Done.
    - Reps left on the last set: `LoggedSet.left` (0, 1 = 1 to 2, 3 = 3 or more), a small toggle
      row under the sets of a weight exercise once its last set is done (`LEFT_OPTIONS` in
      `exercise-row.tsx`, also in the session editor). `suggestNext` reads it: 3 or more on the last
      set is `light`: double moves every set up a step, linear adds the step even if the sets were
      not completed, top set adds one more step; "too much" still holds.
    - Alerts on Today (`src/lib/logic/alerts.ts`, computed in `getTodayData` as `alerts`):
      `stallAlerts` (a lift trained 3+ times in the last 4 weeks whose best never beat its best
      from before, at most two), `weekAlert` (sessions left >= days left in the Monday-to-Sunday
      week), `bodyweightAlert` (goal gain or cut, three weekly averages present, under 0.1 kg or
      0.2 lb a week of movement: "Weight flat for 3 weeks. Eat more/less"). Rendered as bordered
      rows above the weigh-in nudge with TrendingDown / CalendarClock / Scale icons.
    - Bodyweight goal: `Settings.goal` (`GOALS` gain | hold | cut, unset reads as hold), a
      Gain / Hold / Cut toggle under the weigh-in field at setup (preselects gain) and a
      "Bodyweight" section in Settings; `paceNote(changePct, goal)` in `src/lib/logic/goal.ts`
      makes the Body tab's week-on-week line read against the goal.
    `tests/gains.test.ts` covers all four.
39. Progression setting (user: "ask them about the plan range they want to follow at the time of
    configuration or later on the settings"). `Settings.progression?: 'double' | 'linear' |
    'topset'` (`PROGRESSIONS` in types); unset means `defaultProgression(trainingAge)`: `linear`
    under a year, `double` otherwise (`progressionOf(settings)`). Setup gained a fifth step "How
    should the weight go up?" whose default follows the training age picked just before; Settings
    has a "Progression" section (TrendingUp icon) with the same three radios
    (`PROGRESSION_OPTIONS`, `PROGRESSION_LABEL` in `progression.ts`). `suggestNext(..., method)`:
    `double` is the per-set rule of item 38; `linear` adds the increment to every set once every
    planned set was done at or above repMin, else repeats, with the stall rule; `topset` (APRE)
    reads the last done set's reps: below repMin one step down, inside the range hold, repMax to
    repMax+2 one step up, repMax+3 or more two steps, all sets at that weight with the last set
    targeting repMax, no stall rule. "Too much" holds in every method. Rep ranges stay per
    exercise on the plan. Both e2e setup walks click Continue once more.
38. Targets instead of prefilled values (user: "prefill the session weight and reps based on the
    same plan of previous week… just prefill not saving. like progressive overload and any other
    methods. do some research"). `suggestNext(exercise, targetSets, history: PastEntry[], units)`
    in `progression.ts` now returns blank `sets` plus `suggested: SetTarget[]` (one target per set)
    and a `hint`; nothing is logged until a set is marked done. `WorkoutEntry.suggested` carries the
    targets; `exercise-row.tsx` shows them as placeholders (`targetFor`) and `completeSet` adopts
    them. Rules: dynamic double progression per set (a set at the top of the range goes up by the
    muscle's increment and back to repMin, the rest repeat); session effort 4 "Too much" holds every
    weight, 1 "Easy" lets a set one rep short go up; `STALL_SESSIONS` (3) sessions at the same top
    weight with no set reaching the top suggest 10% less rounded to the increment. History comes
    from `recentEntries(userId, exerciseId, dayId)` in `repo.ts`: the same plan day first, any day
    when that day has none, three sessions deep, each with the session's effort. Bodyweight and
    timed rules unchanged. Research notes in the chat of 11 Oct 2026: linear, double, dynamic
    double, APRE (last-set AMRAP, candidate for a per-exercise option on big lifts), RPE/RIR
    autoregulation (needs a per-set rating the app does not collect), 3-session/10% stall rule.
37. Sets without a weight (user: "I was able to save the workout without entering the weights",
    then the session editor failed with the validator's JSON on screen). Three causes, all fixed:
    the Mongo client now runs with `ignoreUndefined: true` (a set with no weight was being stored
    as `weight: null`, which the editor showed as "null" and sent back, and zod refused);
    `loggedSet` in `fns.ts` accepts null as absent (`absent()` helper) and `toWorkout` drops nulls
    from older sessions on read; `completeSet` / `canComplete` / `weightFor` in `exercise-row.tsx`
    refuse to mark a weight set done without a weight above zero (its own or an earlier set's),
    and the done toggle is disabled until there is one. Every `toast.error` now goes through
    `errorMessage(err, fallback)` in `lib/format.ts`, which hides messages that are not a sentence.
    `tests/complete-set.test.ts`.
36. One plan per split (user: "later I switched to some other split and again come back to the
    arnold split… will I see the arnold split along with my adjustments"). Collection `plans`,
    one document per user and split (`userId`, `split` = template id or `custom`, `days`,
    `updatedAt`, unique index on the pair). Settings name the split the user is on;
    `getPlan` reads that slot and builds it from the template the first time; `applySplit`
    remembers the choice and returns the slot as left or fresh from the template; `resetPlan`
    restores the template for the current slot only and throws for `custom`; `replacePlan`
    writes the uploaded days into the marked template's slot or `custom`; `startFresh` removes
    every slot. The old `plan` collection (one doc under the user id) is migrated on first read
    and in `claimLegacyData`. Settings and setup say "Each split keeps its own plan. Coming back
    to one finds it as you left it."; the switch toast is "Now on <split>".
35. Content in the database (user: "this is the purpose of seeding"). Collections `splits` (one
    per template, `_id` the split id, `days` the PlanDay list, `order`, `fit`) and `library` (one
    per exercise, `_id` the exercise id). `src/server/content.ts`: `seedContent(db, {reset})`
    inserts what is missing from the bundle (`BUNDLED_SPLITS` in `splits.ts`, `LIBRARY`), never
    overwriting an edit unless `reset`; `readContent()` reads both (one-minute cache per process,
    seeds first when a collection is empty, so a fresh database works); `splitTemplate(id)`.
    `src/lib/content.ts` holds the types and the pure helpers (`splitInfos`, `splitInfoOf`,
    `buildSplitFrom`, `planSourceInfo`, `templateOf`); `library.ts` helpers take the list.
    `getContentFn` is loaded by the `_app` route (`staleTime` one hour) and read with
    `useContent()` (`src/lib/use-content.ts`); setup loads it beside the settings. `SplitId` and
    `PlanSource` are now plain strings (ids can be added in the database); the validators take any
    string and the repo throws on an unknown template before writing. `splitFromMarker` takes the
    known ids. `bun run db:seed` seeds content (`--reset`, `--demo` for the old demo account into
    an empty database). `tests/content.test.ts` covers seed, merge, reset and the auto-seed.
34. Seeding and Vercel. `bun run db:seed` (`scripts/seed.ts`, bun) makes `seed@example.com`
    (Better Auth's own document shapes: `user` with ObjectId `_id`, `account` with the password
    through `hashPassword` from `better-auth/crypto`, `emailVerified: true`) and eight weeks of
    sessions on a split, weigh-ins every three days drifting down, tape every four weeks;
    deterministic. It only fills an empty database (user request: "a fresh db seed, not moving
    all data"): any document in `user`, `settings`, `plan`, `plans`, `workouts`, `bodyweights` or
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
