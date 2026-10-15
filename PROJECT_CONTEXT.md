# Workout Plan v3 — project context

Personal gym logbook for a fixed 6-day Push / Pull / Legs plan.
Used on a phone between sets. One person, no accounts.
Folder: `C:\Users\Gopal\projects\per\workout_plan_v3`

## Goal

1. Show the next session and let the user log a set in two taps.
2. Show the plan and let the user edit an exercise or swap an alternate.
3. Show stats computed from the logged sets.

## Stack (as built)

- TanStack Start 1.168 on Vite 8, React 19, TypeScript. Package manager: **bun**.
- shadcn/ui (new-york style). Components added so far: badge, button, collapsible, dialog,
  input, label, progress, radio-group, select, separator, sheet, sonner, textarea, toggle,
  toggle-group. Pulled with the shadcn CLI (same registry the MCP uses). `.mcp.json`
  registers the shadcn MCP for future sessions.
- Tailwind v4. Fonts self-hosted via `@fontsource/barlow` and `@fontsource/barlow-condensed`.
- MongoDB 7 via the official `mongodb` driver. Local server runs in Docker:
  container `workout-mongo`, port 27017, volume `workout-mongo-data` (`bun run db:up`).
- Env: `.env` has `MONGODB_URI` and `MONGODB_DB`. `vite.config.ts` copies them into `process.env`.
- Tests: vitest (`bun run test`), mongodb-memory-server for repo tests, Playwright (`bun run test:e2e`).

## Design tokens (decided with the user)

- Keep the **default shadcn token keys** (`--background`, `--primary`, `--muted`, `--border`,
  `--ring`, `--chart-*`, `--sidebar-*`, `--radius`). Components already read them.
  The palette is applied on those keys in `:root` and `.dark`.
- Only four purpose-named custom tokens exist: `--day-push`, `--day-pull`, `--day-legs`
  (plate colours red / blue / yellow, used only to tag day types) and `--success` (done state).
- No colour-named tokens (the scaffold's sea/lagoon set was removed).
- All colour values are written as hsla(h, s%, l%, a) so alpha is easy to tweak.
- Type: Barlow for body, Barlow Condensed for titles and big numerals. Tabular numbers everywhere.
- Dark mode: `.dark` class on `<html>`, set from `prefers-color-scheme` by an inline script.

## Design plan (frontend-design skill)

Subject: iron, chalk, plates. The memorable thing is the set logger:
big condensed numerals with plate-step buttons. Everything else stays quiet.

Layout: single column on mobile, 16px gutters, bottom tab bar (Today / Plan / Stats)
with safe-area padding. Set logger expands inline, one exercise open at a time, no modal.
Sticky action bar with the set count + Finish (the rest timer was removed on 2026-10-11, see
13i). Desktop >= 1024px: left rail nav + content
column max 44rem, left aligned. Stats grid goes 2 columns at >= 768px.

Principles:
1. One screen, one job. Today logs. Plan edits. Stats reads.
2. Numbers are the hero. Condensed, large, tabular.
3. Colour means something. Plate colours tag day types. Green only means done.
4. No chrome. Lists with hairlines, not cards in cards. One radius for controls.
5. Motion answers taps only: row expand, set check, timer. No page-load animation.

Generic-tell review: no cream + terracotta, no black + acid green, no broadsheet,
no card kit, no all-caps eyebrows, no middle dots, no mono labels, no arrows,
no Inter/Geist. Checked.

## Screens

- `/setup` first run only. One question per screen: units, bodyweight, training age.
  Training age under 1 year turns 4-set lifts into 3 sets.
- `/` Today. Next day in rolling order (or the weekday's day). Exercise rows expand to a set
  logger. Prefill from last time, suggest +2.5 / +5 when every set hit the top of the range.
  Finish workout saves and advances the day.
- `/plan` Six days. Expand a day, edit an exercise (name, sets, reps, note), swap alternate.
- `/stats` From logs only, in three tabs kept in the URL (`?tab=`). Lifts: strength per lift
  week by week (picker, big number, chart, week table), recent PRs. Sessions: numbers and totals
  for the picked week, month calendar (a day with a session opens it for editing or deletion),
  hard sets per muscle vs the plan, Excel / CSV export. Body: bodyweight trend, measurements.
  There is no separate History page.

## Code map

- `src/lib/types.ts` shared types
- `src/lib/seed-plan.ts` the final Plan B with the user's equipment picks (`seedPlan()`, `slug()`)
- `src/lib/logic/next-day.ts` rolling day order
- `src/lib/logic/progression.ts` per-set targets (dynamic double progression, effort, stall rule) + hints, rest seconds
- `src/lib/logic/stats.ts` week math, volume, strength series, PRs, bodyweight trend
- `src/lib/logic/units.ts` formatting helpers
- `src/server/db.ts` Mongo client (tests inject a db with `setDbForTests`)
- `src/server/repo.ts` all reads/writes + `getTodayData()` / `getStatsData()`
- `src/server/fns.ts` TanStack server functions with zod validation
- `tests/*.test.ts` unit + repo tests

## Data (MongoDB collections)

- `settings` one doc `_id: 'settings'`: units, bodyweight, trainingAge, setupDone
- `plans` one doc per user and split (`userId`, `split`: a template id or `custom`): days[] -> exercises[] (id, name, sets, repMin, repMax, muscle, loadType, note, alternates). The user is on the split named in settings; the others wait for them to come back
- `splits` and `library`: the reference content, seeded from the bundle (phase 29)
- `workouts`: dayId, dayName, dayType, startedAt, finishedAt, status, entries[] -> sets[] (weight, reps, seconds, done)
- `bodyweights`: date, weight
- `measurements`: date, arm, chest, waist

## Phases (tick as done)

- [x] 1. Scaffold app in this folder (bun, TanStack Start, shadcn add-on), Mongo in Docker
- [x] 2. Design tokens (hsla on shadcn keys), root shell, app layout with bottom nav + desktop rail, dark-mode script
- [x] 2b. (user request) Desktop nav on the shadcn Sidebar component, trigger inside the sidebar header
- [x] 2c. (user request) Exercise rows on Today and History, and day sections on Plan, use the shadcn
      Accordion (one open at a time). Blank sets borrow from the nearest earlier filled set. (SidebarProvider, Sidebar,
      SidebarInset, SidebarMenu). Phone keeps the bottom tab bar. Sidebar footer will hold the
      account row once phase 14 lands.
- [x] 3. Data layer: Mongo client, seed plan, repositories, server functions
- [x] 4. Pure logic + unit tests: next day, progression, stats math (29 tests pass)
- [x] 5. Setup flow (3 questions, one per screen) at /setup
- [x] 6. Today screen: next up, day picker, exercise rows, set logger, autosave, rest timer, finish / discard
- [x] 7. Plan screen: day sections, exercise editor sheet, alternates swap, rules, reset
- [x] 8. Stats screen: this week + 28-day strip, strength rows with sparklines, hard sets vs plan, bodyweight + measurements dialogs, recent bests
- [x] 9. Repo tests run against the Docker Mongo in db `workout_plan_v3_test` (skip if down). 45 tests pass, typecheck clean
- [x] 10. Playwright e2e at 375 / 768 / 1280 (installed Chrome). 15 of 15 pass.
      UX fixes from the screenshots: stepper on an empty set now starts from the previous set
      (placeholder shows it, done carries it forward); editor number fields stacked on phones
      so digits are not clipped. Dark-mode snapshots added. Screenshots in e2e/screenshots.
- [~] 11. README written. Final check of this file pending.
- [x] 12. Bring your own plan at /plan/import: template download, upload, editable preview, replace. 18 of 18 e2e pass.
      Page /plan/import. "Download template" builds an .xlsx in the browser from the live plan
      (sheet "Plan": Day, Type, Exercise, Sets, Reps, Load, Muscle, Note, Alternates; sheet
      "Guide" with the allowed values). "Upload" reads .xlsx / .csv in the browser with SheetJS,
      nothing is sent or stored. Parser in `src/lib/logic/plan-sheet.ts` guesses day type, load
      type and muscle when blank, lists rows it skipped. Preview is editable (name, sets, reps,
      load, muscle, remove row) before "Use this plan" replaces the plan via `replacePlanFn`.
      Unit tests for parse + export round trip. Link from the Plan page.
- [x] 13. Progress logging: finish check-in (effort + note), weigh-in / tape nudge on Today, /history with edit + delete, stats effort + deload hint, bodyweight date chart with range toggle, measurements timing + history table, Change session sheet on the active workout. 72 unit/repo tests, 21 e2e pass. (user question). Already there: Today logs every set and
      saves on each tap; Stats has Log bodyweight and Log measurements. Planned additions:
      a. Weigh-in nudge on Today: one quiet line + button when the last bodyweight log is 7+ days
         old (measurements at 28+ days). Same dialogs as Stats.
      b. Finish check-in: after Finish workout, an optional one-tap effort rating (easy / ok /
         hard / too much) and a short note, stored on the workout. Skippable.
      c. History: a list of past sessions (date, day, sets done, effort) with open to edit sets
         or delete the session. Stats recompute from the edited logs. Route /history, linked
         from Stats.
      d. Stats add-ons from (b): average effort per week next to sessions, and a hint to deload
         when effort is high two weeks running while strength is flat.
      e. (user request) Bodyweight as a date-based line chart on the shadcn chart component
         (recharts), with a 4 weeks / 12 weeks / all range toggle and a date tooltip.
         Measurements block shows last measured, next due (28 days later), change vs the previous
         tape, and a short history table.
      f. (user request) Weigh-ins and tape entries can be edited and deleted from Stats. One entry
         per calendar day: logging again the same day replaces it (toast says so). The client sends
         its local day so the boundary is the user's, not the server's.
      g. (user requests, 2026-10-10 evening) Stats reworked around the calendar:
         - Bodyweight chart: tap, click or Enter on a point opens that weigh-in in a dialog with
           Save and Remove. The separate "Recent weigh-ins" list is gone. The chart draws from one
           log (a single dot).
         - The 28-day strip became a month calendar, Monday first, with previous / next month.
           Each week is a button: picking a week points "This week" (becomes "Week of Sep 28"),
           hard sets and effort at that week. "Back to this week" returns. Days before the join
           date are dimmed and weeks that end before it cannot be picked. The join date is
           `settings.joinedAt`, stamped once the first time setup completes (phase 14 carries it
           onto the account). The e2e helper `backdateJoin` moves it for the week-picking test.
         - Setup always writes today's weigh-in. Before, a repeat run with the same number wrote no
           log, so Today asked for a weigh-in right after setup (user report).
         - The day-of-month validator in `fns.ts` had lost its backslashes (`/^d{4}-d{2}-d{2}$/`),
           so every log with a `day` failed. Fixed; this was the e2e failure the handover expected.
         - The month title on the calendar is a button that opens the shadcn Calendar with month and
           year dropdowns (`captionLayout="dropdown"`): changing a dropdown moves the Stats calendar
           at once, tapping a day picks that week. The bodyweight chart shows a hand cursor (Recharts
           sets `cursor: default` inline on its wrapper, so the chart gets `style={{ cursor }}`).
      i. (user request, 2026-10-11, after 1 am) The rest timer is gone: checking a set no longer
         starts a countdown in the sticky bar, which now always shows "x of y sets done" next to
         Finish. `rest-timer.tsx` was deleted; `restSecondsFor` stays in the progression logic
         (tested, unused by the UI) in case the timer returns as a setting.
      h. (user requests, same evening) Bottom sheets are the shadcn Drawer (vaul): "Pick a day" and
         "Change session" on Today, and the Plan and History editors on phones and tablets
         (`src/components/app/editor-panel.tsx` renders a Drawer under 1024px and the right-hand
         Sheet above it, with the header owned by the wrapper so each primitive gets its own title).
         "Discard" sits next to "Change session" on the active workout and asks first in a dialog;
         the drawer only switches days now. Weigh-ins and tape entries can be logged under an earlier
         date: both Log dialogs have a Date field on `src/components/app/date-picker.tsx` (Popover +
         shadcn Calendar, month and year dropdowns, weeks start Monday, nothing after today). The
         client sends `day` plus `at` (now for today, midday for an earlier day); `fns.ts` validates
         `at` with `z.iso.datetime()` and rejects the future; the repo keeps `settings.bodyweight`
         equal to the latest log by date, so a backfilled older weigh-in never overwrites it.
- [x] 14. Accounts and sync (user request): sign in from any device. Built 2026-10-11.
      Better Auth 1.7.7 (self-hosted) with the MongoDB adapter, the `username` plugin and the
      `magicLink` plugin, plus `tanstackStartCookies`. Three ways in, on `/login`: an emailed
      sign-in link (primary: email only, the link signs the user in and lands them in the app, new
      users go to setup), "Continue with Google" (shown only when GOOGLE_CLIENT_ID and
      GOOGLE_CLIENT_SECRET are set; redirect URI `${BETTER_AUTH_URL}/api/auth/callback/google`),
      and email or username + password behind "Sign in with a password instead". `/signup` makes
      username + password accounts. Mail goes through Resend when RESEND_API_KEY is set; otherwise
      `src/server/mail.ts` logs it and stores it in `mail_outbox` (the e2e reads the link there).
      Session cookie, HttpOnly, SameSite=Lax, 30 days. Server route `src/routes/api/auth/$.ts` hands
      requests to Better Auth. The `authed` middleware (`src/server/session.ts`) passes `userId`
      to every server function; every repo function takes `userId` first; settings and plan docs
      are `_id: userId`; workouts, bodyweights and measurements carry `userId` with indexes. The
      first account created on a database claims the pre-account data (`claimLegacyData`, from a
      Better Auth user-create hook). `_app` redirects to `/login` without a session, then to
      `/setup` until setup is done; sign out in the sidebar footer and at the bottom of Plan. Forms
      use the shadcn `field` components with placeholders and room between fields (user request,
      frontend-design pass; `src/components/app/auth-frame.tsx`). Secrets in .env:
      BETTER_AUTH_SECRET, BETTER_AUTH_URL; optional GOOGLE_*, RESEND_API_KEY, MAIL_FROM.
      Tests: repo tests per user plus isolation and legacy-claim tests; e2e signs up first,
      follows an emailed link for a new user, and checks a second user starts clean while the first
      signs back in by username. Email verification stays off.
- [x] 15. Settings page (user request) at /settings, built 2026-10-11. Linked from the sidebar footer
      (above Sign out) and the bottom of Plan ("Settings" replaces "Change units or training age").
      Sections, each saving at once with a toast: units, training age, streak target (removed
      again in phase 22: a streak week is now any week with a session), schedule (the Rolling /
      By weekday switch moved here from Plan;
      Plan keeps the per-day weekday selects and links back), split (current template + "Change
      split"), account (name, email, Sign out), and "Start fresh": a dialog that asks the user to
      type `start fresh`, then `startFreshFn` wipes this user's plan, settings and every log and
      sends them to setup. The account stays. Repo test covers that another user is untouched.
- [x] 16. Splits beyond Push / Pull / Legs (user request). Built 2026-10-11. The nine templates
      live in `src/lib/splits.ts` (`SPLITS`, `buildSplit`, `splitInfo`; the shared Upper / Lower /
      Full body days are reused across templates), setup has a "Which split?" step (step 2 of 4)
      with a one-line fit per split, `/setup?step=split` opens straight on it from the Plan page's
      "Change split", switching starts the plan over from the template (`applySplitFn`, with a
      warning when the user already has a plan) while the same split keeps edits, `settings.split`
      is remembered and "Reset to the original plan" resets to that template. Day types widened
      (`DAY_TYPES` in types.ts), colour by family in `day-mark.tsx` (mixed days are grey on
      `muted-foreground`, no new token), the importer guesses the new types from day names.
      Weekday mode: `settings.schedule` ('rolling' default, 'weekday') with a "Rolling / By
      weekday" switch on the Plan page (`setScheduleFn`; going by weekday gives every day a
      weekday, Monday first, spread with rest days: `defaultWeekdays` in
      `src/lib/logic/schedule.ts`), a weekday select inside each day section (`setDayWeekdayFn`),
      and Today driven by `weekdayView`: the day on today's weekday with "Today, Wednesday" above
      it, "Done for today" once it is finished, "Rest day" otherwise, "Next: Pull B, tomorrow", and
      a "Skipped this week" list with "Do it now" for planned days earlier in the week with no
      session. "Pick a day" stays. The schedule switch moves to Settings in phase 15.
      Original brief: setup gets a step "Which split?" with
      one-line fits, also changeable in Settings: Push / Pull / Legs (6 days, current default),
      Push / Pull / Legs (3 days, each once a week), Push / Pull / Legs + Upper / Lower (5 days),
      Upper / Lower (4 days), PHUL (4 days: power upper, power lower, hypertrophy upper,
      hypertrophy lower), Upper / Lower / Full body (3 days), Full body (3 days), One muscle a day
      (5 days: chest, back, shoulders, legs, arms + abs), Arnold split (6 days: chest + back,
      shoulders + arms, legs). The user confirmed the list on 2026-10-11 and asked for common
      splits they may not know; the picker shows a one-line "fits you if" per split.
      Day types grow to chest, back,
      shoulders, arms, legs, core, upper, lower, full, push, pull; colour stays by family (push
      family red, pull family blue, legs family yellow, mixed neutral). Optional weekday per day:
      in weekday mode Today shows the day that matches the calendar, shows a rest day otherwise,
      and lists any day skipped this week with a button to do it now. Rolling mode stays the
      default. "Pick another day" stays on Today as the way to log a different day, and the
      active session has "Change session" to switch day or discard. Any template stays fully
      editable afterwards: Plan editor, Excel import, template switch in Settings.
- [x] 17. Exercise library (user request), built 2026-10-11. `/library` lists 137 exercises, each
      with a picture, the muscles it works, equipment, level and three cues: a curated subset of the
      public-domain free-exercise-db (yuhonas/free-exercise-db, Unlicense) in
      `src/lib/library.json`, chosen by a script that maps the source's muscles onto the app's nine
      and renames to the app's vocabulary (so every template exercise name is in it). Pictures stay
      on the project's GitHub raw host (`imageUrl`). `src/lib/library.ts` has `LIBRARY`,
      `searchLibrary` (every typed word must appear in name, muscles or equipment; muscle and
      equipment filters) and `findLibrary`. `src/components/app/library-list.tsx`: `LibraryList`
      (search + two selects + rows with a lazy thumbnail), `LibraryDetail` (drawer on phones, sheet
      on desktop: picture, numbered cues, "Works: ..."), `LibraryPicker` (a dialog; "Pick from
      library" next to the Name field in the exercise editor and a book icon per row in the import
      preview; fills name, muscle and load type). Linked from the sidebar. One deviation from the
      brief: the page sits inside the signed-in app shell rather than being public, so it keeps the
      navigation; nothing in it is private. Unit tests check the data and the search; e2e covers
      the page and both pickers.
- [x] 18. Lift progress (user request: "bench press 10 kg in week one, 12.5 kg in week two, as a
      graph"; refined to "this week 10 kg, last week 10 kg with more reps, the week before
      7.5 kg"). Strength is the first section of Stats: a Select picks the lift, the latest best
      set is the big number, a line chart plots the best set of each calendar week (weight for
      weighted lifts, reps or seconds otherwise) on a date axis in the lift's day colour, and a
      table lists the weeks newest first with a Change column against the week before (weight
      first, reps when the weight held). "All lifts" below shows every logged lift with its
      change since its first week and a sparkline. The This-week section also shows hard sets,
      weight lifted and minutes for the picked week. Ideas for later: a muscle filter and an
      estimated one-rep max toggle.
- [ ] 19. Export the logs (user request) to Excel or CSV. On History: "Download Excel" writes an
      .xlsx with sheets Sets, Bodyweight and Measurements; "Download CSV" writes the Sets sheet.
      One row per done set: Date, Time, Day, Type, Exercise, Muscle, Set, Weight (units), Reps,
      Seconds, Effort, Note, oldest session first, session fields repeated on every row so filters
      and pivots work. Built in the browser with SheetJS from `getExportFn` (all finished sessions,
      all body logs). Row logic in `src/lib/logic/export.ts` with unit tests; e2e checks both
      downloads by file name.

- [x] 20. Polish round (user requests, 2026-10-11, 1 to 2:30 am), all e2e-covered: streak on
      Today; exercise stills next to every exercise (library match by name), week shapes on the
      split picker, section icons on Stats and Settings; add and remove exercises per day with a
      cap of six (`MAX_EXERCISES_PER_DAY`, templates trimmed to fit, import capped; raised to ten on 2026-10-12); phone header
      with a left-side menu button opening the sidebar sheet; sidebar footer as a profile row with
      a Settings / Sign out dropdown; the active workout's "Change session" and "Discard workout"
      under a three-dots menu; the Settings split as a Collapsible (current row, unfold to pick,
      confirm to switch); the sign-in toggle swaps the email-link and password forms; the rest
      timer removed (13i); the shadcn-first audit finished (input-group, chart, toggle, item, empty,
      table, progress).
- [x] 21. Minimal pass (user's list, 2026-10-11 afternoon): every explanatory sentence out of the
      UI; editors as a Dialog from 768px and a Drawer below, headers and footers unified; Plan
      without Sign out / Change split; setup no longer re-logs the weigh-in; library detail with
      Previous / Next and a steady height; "Remove the last set"; phone-sized set fields; the
      History page folded into the Stats calendar (tap a day to open the session) with exports on
      Stats; Stats split into Lifts / Sessions / Body tabs. HANDOVER.md item 22 has the details.
- [x] 22. Streak without a target (any week with a session counts; the setting from phase 15 is
      removed), shown top right on Today as a flame and a big number; zen mode on an active
      workout (full-screen dialog, one exercise at a time). HANDOVER.md item 23.
- [x] 23. Import templates name their split: a template picker on the import page (current plan or
      any split), a Template sheet and Guide title as the marker, the split read back on upload,
      and `settings.split` set to that id or to `custom` (Plan says "Custom plan, N days").
      HANDOVER.md item 24.
- [x] 24. UX pass against the ui-ux-pro-max checklist: tap targets, tap delay, press feedback,
      pending skeleton, inline sign-in errors, show / hide password, tappable list rows.
      HANDOVER.md item 25.
- [x] 25. Looks: Slate (default), Catppuccin Latte, Dracula, Lime (a dark shadcn preset, which
      replaced Pocket on 2026-10-14), and the six elements (Air, Sky, Stone, Fire, Water, Forest,
      2026-10-14, each with its element painted behind the page and its own plates; Chalk dropped
      the same day), as token
      blocks keyed on `<html data-theme>`,
      picked from the account menu, kept per device, applied before paint. HANDOVER.md item 27.
- [x] 25b. Export layouts (2026-10-15): Log (one row per set) or Tracker (a sheet per plan day, the sets
      across, like the user's old hand-kept sheet), picked on Stats with a three-row preview of each;
      CSV only for Log. The Excel and CSV buttons left Settings, where the zip already holds the logs.
- [x] 26. Day glyphs: a plate-coloured tile with a lucide glyph per day type replaces the colour bar
      on days, titles and pickers (`DayIcon`). HANDOVER.md item 28.
- [x] 27. Mail and sign-up hardening: the sign-in email in the app's look, Resend errors surfaced,
      used links explained on the sign-in page, favicon and tab titles, and sign-up verified by a
      six-digit emailed code before a password account can sign in. HANDOVER.md items 29 to 32.
- [x] 28. The app is called Plates (was "Workout plan"): wordmark, titles, mails, file names, README. HANDOVER.md item 33.
- [x] 29. Content in the database: the split templates and the exercise library in `splits` and
      `library`, seeded from the bundled copies when empty or by `bun run db:seed`, read once per
      visit through the shell route. Editable without a deploy. HANDOVER.md item 35.
- [~] 48. Guide (user request, 2026-10-12): `/guide` in the app shell, linked from the sidebar under Library. The one
      page allowed to explain (the no-explanatory-copy rule holds everywhere else). Text in MDX, one file per section
      in `src/content/guide/NN-id.mdx` exporting `title`, `icon` and `part`; `src/content/README.md` has the rules.
      A reusable content layer serves it and any later long read (posts): `src/components/content/doc-page.tsx`
      (`DocPage`, `sectionsFrom`: jump links, a sticky contents list from 1280px grouped by part, the section being read
      highlighted by `src/lib/use-active-section.ts`) and `src/components/content/mdx.tsx` (`mdxComponents`: markdown
      styling plus Lead, Facts/Fact, Steps/Step, More, Tip, usable in any .mdx without an import). Guide-only visuals
      (Ladder, Methods, DayKinds, TrendShapes, WithPicture, Shot) are in `src/components/app/guide-blocks.tsx`. A doc
      page sits in `DOC_COLUMN` (doc-page.tsx), which makes room for the contents list from 1280px. (2026-10-13: the
      guide went public as How it works, `/how-it-works`, the signed-out home page; see below.) Build:
      `@mdx-js/rollup` as a 'pre' plugin in `vite.config.ts`, `@vitejs/plugin-react` includes `.mdx`, `"mdx"` in
      tsconfig types. Regenerate the route tree with a build or the dev server, not the standalone `tsr generate`,
      which drops the Start `Register` block. Reader-tested twice with fresh agents; e2e "the guide lists every
      section" passes on mobile and desktop. The full e2e run is still to do.
- [x] 58. Small asks (2026-10-14): Enter moves on from every setup step (the form catches Enter on a toggle, radio or
      tick, which are buttons and would only click; text fields submitted already; Back, dropdowns and steppers
      keep their own Enter). The tape dialogs say where the tape goes, one line under each field (`TAPE_HOW`,
      shared `TapeFields` for the log and edit dialogs: arm bent and flexed around the peak, chest under the
      armpits after breathing out, waist at the navel relaxed), with a "How to measure" section in the guide's
      Body page; there are no measurement pictures, as the picture set is the exercise library only.
      - Bug hunt on the day's work (user request), with `tests/scenarios.test.ts` (whole stories through the
        server code: a split started empty, filled from the library, trained three sessions with the targets, Stats
        and the report checked at each step; a machine taken mid-session, swapped for good with ticked sets kept,
        then for today only, each lift keeping its own history, a pause taken out of the minutes) and the two-year
        simulator's two new stories (`--empty`, `--swaps`: 214 swaps, 57 paused sessions over 580 sessions, no
        duplicate ids, every swap for good present next time, every pause closed; the anomaly counts match the
        plain run, and the "topped out" check now reads the range's top, not the aim, which it mistook before).
        Found and fixed: a swap to the same lift after a ticked set gave two session entries one id (refused now,
        and a kept lift's id is reserved); "Plan and today" after emptying the day left a session with no lifts and
        Zen read an entry that was not there (Zen off then); Change session offered empty days (Switch off);
        Today drew an empty bordered list on an empty day; the swap panel's "Also on the plan" tick stuck between
        swaps; a library entry added in the database without the new fields made the server re-run the fill-in
        on every read (only the bundle's ids count now). Known, left: "Add a day" on a plan started empty still
        brings five lifts, as there is no stored "empty" preference.
- [x] 63. Both source pictures, and the base text size (2026-10-15, user: "seems like there are two images", "add the
      end image as well, in the details panel option to go next like a carousel by touch and cursor"; and "remove the
      text-sm manually added in places so it will automatically take the base variant", then text-xs too). The
      source photographs every exercise at the start (`0.jpg`) and the end (`1.jpg`) of the movement; the app showed
      the start only. The detail panel now holds both in a shadcn Carousel (`src/components/ui/carousel.tsx`, as
      published, on embla-carousel-react): a swipe or a mouse drag moves between them, two arrows sit inside the
      picture for the cursor, two dots say which is shown, and the next exercise opens on its start again (the
      carousel is keyed by the exercise). `data-vaul-no-drag` on it keeps the phone drawer from taking a sideways
      swipe for a pull-down. The data carries both: `library.json` and the `library` collection hold `images`, the
      source's pair of paths, in place of the single `image` (user: "the images should come from the seeded db, not
      building in the UI"); `imageUrl(ex, frame)` picks one. Databases seeded with `image` get `images` from the
      bundle and lose `image` through `fillLibrary`, like the sets and the cues. List rows keep the start
      thumbnail. Checked by a Playwright scratch script at 360, 393,
      768 (CDP touch swipe), 1024 and 1440 (arrow click and mouse drag): the end frame shows, the panel stays open,
      no console errors. Text size: every hand-added `text-sm` (54) and `text-xs` (12, with the calendar's
      `sm:text-xs`) left the app's own files, so text takes the body's base size; shadcn files untouched. Side
      effects handled: the guide's ladder label slot grew from `h-4` to `h-6` for the taller line, and the Stats
      tabs dropped `size="sm"` and took `text-base` ("the tab looks too small on mobile"); the other toggle groups
      still say `size="sm"`. Also caught up (user: "the hero section demo mobile is outdated on the today page"):
      the live phone's Today never offered **Skip or done** (item 61) and sat on Pull whatever happened. `TodayDemo`
      now keeps the day it moved past (a finished session or a skip) and shows the next one by `nextDayId`, and
      passes `onSkip` to the shared `NextUpView`, so its footer matches the app's.
- [x] 62. Full cues from the source (2026-10-15, user: "some of the workout cues seem to be cut off", then "update
      them by looking at the resource where we sourced it"). The first import kept three steps per exercise and
      cut each at about 170 characters with an ellipsis: 197 cues in 117 of the 137 entries ended mid-sentence, and
      many exercises stopped before the lift came back up. `library.json` now carries every instruction step from
      free-exercise-db (`dist/exercises.json`, matched by the picture folder, which is the source id), 4 to 8 per
      exercise, in full; Side Plank has no source text and keeps its own three. Databases seeded before this hold
      the cut copies: `fillLibrary` in server/content.ts now also replaces the cues of a bundle entry whose cues end
      in `…`, on the first read that finds one (the same self-heal as the missing sets and range; a full cue list
      edited in the database stays). The detail panel scrolls its content on every viewport, so the longer lists
      needed no UI change.
- [x] 61. A missed log, and a skipped day (2026-10-15, user problem: "I trained Tuesday but forgot to log it, and
      Today still shows Push with no way to fix it"). Two gaps, one cause: a session could only be born live, and
      Next up only ever read the last finished session. Research first (Hevy backdates a session from its calendar,
      MacroFactor and Gravl skip a workout and move the program on), then built on the user's design calls over
      three turns: Skip lives in the Next up footer, not a `⋯` menu; logging an earlier day lives on the Stats
      calendar only, not in Pick a day (a date row there was built and dropped: the calendar tap already is the
      date); the footer button reads **Skip or done** (was "Skip or already done"; on phones it shares a row with
      **Pick another day**, was "Not this one? Pick another day", both ghost (outline was tried once the row held
      two) and as tall as Start, the labels cut to fit half a row at 360px) and asks first (`SkipDialog`, two sentences: nothing
      is logged, and "Already did it? Log the session on Stats, under Sessions."; an alert mark with a tooltip,
      then a longer text naming the next day and the taps, were built before it and cut on the user's word:
      "straight to the point and don't tell what will be next"). Logging: an empty earlier
      calendar day opens the same day dialog two sessions do, titled with the date, listing the plan days with
      **Log**; `draftWorkoutFn` / `repo.draftWorkout` returns the day's session as it would start (targets from
      history, blank sets, no ramp offer, `startedAt` = `finishedAt` = noon of that day, nothing stored); the
      session editor takes it in `log` mode (`SessionEditor` prop: **Tick all** fills every set from its target
      through `completeSet`, **Log session** is disabled until a set is ticked, no Delete) and
      `logPastWorkoutFn` / `repo.logPastWorkout` stores it, refusing nothing ticked. `components/app/log-past-
      session.tsx` holds the pair (`useDraftSession`, `PastSessionEditor`). Every reader of `finishedAt` (streak,
      week count, calendar, body map, progression history, export, Next up) takes the backfilled session as is.
      Skip: `skipDayFn` / `repo.skipDay` stores `settings.rolledPast = { dayId, at }`, and `rollingCursor` in
      next-day.ts counts from whichever is later, the last finished session or the skip, so a skip is forgotten
      once a later session is finished and a session logged for an earlier day never undoes it. Rolling order
      only (by weekday the calendar decides); hidden on a one-day plan. The skipped day is not carried (item 54
      stands). Tests: `rollingCursor` cases, repo tests for skip / draft / log, an app e2e flow; the guide's
      session and Stats sections and the README say it.
- [x] 60. The interactive demo mirrors the app, and SEO groundwork (2026-10-14, user request). The live phone on
      How it works now runs the same flow as the app: Today opens on **Next up** (the day the plan says is next, its
      lifts, the week streak and a review alert), and only Start — or a day from Pick a day — begins the session;
      finishing or discarding returns to Next up. To share instead of duplicate, the Today "Next up" view was
      extracted from `routes/_app/index.tsx` into `components/app/next-up.tsx` (`NextUpView` + `Streak`): the route
      wires it to the server and passes the weigh-in/tape reminder as a `nudge` slot; the demo (`TodayDemo` in
      guide-demos.tsx) passes made-up data, starts a client session via `demoSession(…, dayId)`, and opens its own
      report from the alert through `onAlertAction`. The demo session gained the app's header menu (**Change
      session** → a day-picker drawer, **Discard workout** → back to Next up), shown only when an `onSwitch` is
      given. Earlier in the same batch the demo also got the Report (top bar + `ReportDemo` on `ReportView`), a
      working mid-session swap, and the Plan day **Rename or change kind** dialog — the last by extracting
      `DayDialog` from `routes/_app/plan.tsx` into plan-view.tsx with an `onSave(name, type)` callback (route saves
      to the server, demo updates its own plan). The report top bar double-header on the Plan and Stats tabs was
      fixed with a `header` prop on `PlanDemo`/`StatsDemo` (off inside the app demo). SEO: `robots.txt` and
      `sitemap.xml` are now server routes that read the request origin (so the domain is right on any host; the
      static `public/robots.txt` is gone, `/signup` is left out since production signs in with Google), and the
      root head carries `Organization` + `WebSite` JSON-LD with absolute URLs for brand searches (sitelinks and the
      rest are Google's to grant, over time; this is the groundwork). `public/google…​.html` verifies Search Console.
- [x] 59. Today alerts as a card deck (2026-10-14, user request, chosen from a six-way demo artifact built in the
      app's skin and since deleted). The four stacked bordered alert rows on Today became `AlertDeck`
      (components/app/alert-deck.tsx): a slideshow, one card at a time, the rest behind dots. Swipe by touch or
      cursor (pointer events, the track follows the finger then settles on the next card or snaps back, a fifth of
      the width is the threshold; it is a carousel slide, not a drag-and-throw, at the user's call), or the ‹ ›
      buttons, or arrow focus. The action button is full width on phones and hugs its label at the bottom-right
      from `sm:` up (the user found full width unpleasant on tablet and web). Each alert now carries a stable
      `key` (`stall:<exerciseId>`, `week:<weekStart>`, `weight:<weekStart>`, `review:<kind>:<at>`) and a `to`:
      review → its report, stall → `/plan`, weight → `/stats?tab=body`, week → no route, its "Pick a day" button
      opens the day picker on Today (passed as `onPickDay`). A × dismisses: `Settings.alertsDismissed` (key → ISO)
      via `dismissAlertFn`/`repo.dismissAlert` (prunes entries over 90 days), and `shownAlerts` in alerts.ts filters
      them in `getTodayData`; the client also drops the card at once by key. `gains.test` pins the keys and
      `shownAlerts`; `repo.test` covers the dismiss, the prune and the Today filter; the explore spec asserts the
      deck leads with the stall, its action links to Plan, and a dismiss survives a reload. Research question
      answered first with the ui-ux-pro-max skill (one primary action, progressive disclosure, a badge over a
      shout); the swipe-away deck was reshaped to a plain slideshow on the user's feedback. Then, by the user's
      principle that the app never pushes a decision (now in CLAUDE.md "What the app does"), the week alert
      ("N sessions left this week", `weekAlert`) and the whole "Skipped this week" + "Do it now" section
      (`WeekdayView.skipped`, its weekday block on Today) were removed; alert kinds are now stall / weight /
      review, each with a `to`, and the deck's week branch and `onPickDay` are gone. The empty-days checkbox gate
      was fixed (it was hidden whenever a custom plan existed, since it keyed on the own-plan keep flag; now only
      hidden when returning to an existing own plan), caught by the app e2e run.
- [x] 57. Start with empty days, and the programs behind the templates (2026-10-14, user request). The user asked
      whether the split templates were research-based or random, and for a way to take a split's days without its
      lifts. The templates follow well-known programs (the Reddit PPL, Nippard's PPL + UL, Campbell's PHUL, the
      classic UL, full-body and bro splits, Arnold's) and the research's two points (each muscle twice a week on
      4+ days, 10-20 hard sets a week on the big muscles; the direct sets per muscle were counted per template, the
      5 and 6 day splits sit in the band, the 3 day ones lower, arms thin on ul4 / pplul5 / ulf3, left as is).
      `SPLIT_SOURCES` in splits.ts names each program under its card in the picker (`splitSource`; a template added
      to the database has none), and the guide's Plan section says what the templates keep. A **Start with empty
      days** tick under the picker (`EmptyDaysOption`, setup and Settings; in Settings ticking it with nothing
      picked offers the current split, button "Start with empty days") sends `empty` to `applySplit` /
      `createCustomPlan`, which save the split's days with no lifts in place of the plan that split had
      (`emptyDays` in lib/content.ts). The "at least one lift" rule went: `removeExerciseFrom` takes the last one,
      `replacePlan` no longer refuses (the import page still does, as a sheet day is its rows and an empty day
      cannot travel through the file), `startWorkout` refuses an empty day, Today shows "No lifts yet" with an
      outline "Add lifts on Plan" link in place of Start, Pick a day disables Start on it, and "Restore default
      order" stays off on an empty day. Reset to the original plan brings the template's lifts back. Zen mode was
      never reachable with no lifts once Start refuses. A checkbox on every split card was considered and dropped:
      one tick under the list is the same choice with less noise.
- [x] 56. Mid-session swap, library numbers, and the session clock (2026-10-14, four user questions).
      - Sets and range per lift (user asked whether they belong to the exercise or to a preference). Research:
        coaching practice sets the band by the lift (heavy compounds low, isolation high) and the goal shifts it;
        Hevy and Strong leave the numbers to the user per routine line, Fitbod and Jefit compute them from a goal.
        Plates already has the user's number on every plan line and a progression that reads it, so the defaults
        belong to the lift and no preference was added: `library.json` carries `sets`, `repMin`, `repMax` on all
        137 entries (barbell squat and bench 4 × 5-8, deadlift 3 × 4-6, rows 6-10, machine and dumbbell work 8-12,
        leg press 10-15, small lifts 12-15, calves 4 × 12-15, holds 30-45 s). A swap (`swapLine` in day-edit.ts,
        which `swapExerciseIn` now wraps) and a library pick in the editor take the lift's numbers; an unknown name
        keeps the line's. Before, a swap kept the old lift's range (a hack squat inherited the squat's 5-8) and
        the editor always started at 3 × 8-12. Databases seeded before the fields existed are filled in by
        `fillLibrary` in server/content.ts on the first read that finds an entry without `sets` (only the missing
        fields, so edits made in the database stay); `bun run db:seed` reports the count as `filled`.
      - The templates were checked line by line against PHUL's original sheet, RP and Nippard's programs: all
        sound; the one fix is PHUL power lower's Leg Press, 6-10 to the original's 10-15. The database copy of the
        template is only refreshed by `bun run db:seed -- --reset`.
      - Swap for today (the machine is taken): **Swap** in the action row under a lift's sets on Today and in Zen
        opens `SwapLiftPanel` (swap-lift.tsx: the plan line's alternates, then the whole library list, and an
        "Also on the plan" tick when the lift is on the plan day). `repo.swapSessionExercise` builds the new lift
        as at the start of a session (own history, targets, library numbers), `swapEntries` in session-sync.ts
        puts it in the old one's place, or, with sets ticked, keeps those as the old lift and puts the new one
        after it with the sets that were left (`setsLeft`). The id is kept clear of the session's and the day's
        ids, so a later "Plan and today" finds the same lift. Before, the only way was Plan → Use this → "Plan and
        today", which changed the plan for good.
      - The session clock: the title reads "Started 6:05 PM · 42 min" with a pause / resume button (`Elapsed` in
        session-view.tsx, `useNow` ticking every 15 s, null until the page is live so nothing differs between
        server and client); Zen's header shows the same. `Workout.pausedAt` / `pausedMs`, `setPaused` and
        `activeMs` in `lib/logic/session-time.ts`; finishing while paused closes the pause; the minutes in Stats
        and the session summary read `activeMinutes`, so paused time stays out. No rest timer and no target
        length, by the user's call: a target would make the session a race.
- [x] 55. Report (2026-10-13, user request, the third attempt after the two undone ones noted under 54; this one
      starts from the research and keeps Stats untouched). `/report` (src/routes/_app/report.tsx,
      components/app/report-view.tsx) from the sidebar and a Today alert (a button beside the Stats title was
      built and removed at the user's request). One rule: a report is of a **finished** week (Mon–Sun) or
      calendar month, never the one running; it opens on the last finished one, arrows back a year; a week needs 1
      session, a month 3; a new account sees "Your first weekly report comes on <date>".
      - `src/lib/logic/report.ts`: `finishedPeriod`, `lastFinished`, `shiftPeriod`, `hasNext`, `firstReportOn`,
        `periodLabel`, `buildReport` (sessions of planned, hard sets, bests bounded by the period, movers = lifts
        without a best whose best set beat the period before, bodyweight 7-day average into and out of the period,
        attention (a muscle counts as under target below `UNDER_TARGET`, 0.9), hard sets per muscle a week against the plan, effort counts and reps left) and
        `reviewCard` (the Today line for the first two days after a period ends). stats.ts gained range helpers
        (`volumeByMuscle`, `totalsBetween`, `prsBetween`, `averageWeight`); the week-only names wrap them.
      - Laid out the way the best-regarded training reports are (visual research 2026-10-13: Hevy's monthly report,
        Strava, Oura, Peloton, Garmin), in the order a lifter asks: did I show up (one giant number, sessions of
        planned with its change in words; the period's days as a calendar in the day colours, `daysOf`; a bar strip
        of the last 8 weeks or 6 months with this period in the foreground colour and a chip row for Sessions / Hard
        sets, `history`), what did I get (tiles for hard sets, new bests and bodyweight with green-up / grey-down
        deltas; Hevy never uses red), what should I do (Needs attention, only when there is something), what went
        well (bests, movers), where the work went (a horizontal bar chart per muscle against the period before), how
        it felt (the effort bar), and the body last (a bodyweight line over the run-up). report-parts.tsx holds the shared pieces,
        report-dashboard.tsx the body, report-view.tsx the shell and empty states. A stack-of-cards look was built
        beside it and dropped: that is the year-in-review style, a slideshow for a weekly report. Today's alerts gained `kind: 'review'` with a `to` link (`reviewAlerts` in
        alerts.ts, rendered as a Link row).
      - The guide pictures are unchanged, since Stats is. The report was reader-tested from a temporary demo screen,
        removed afterwards.
      - Share: `share-report.tsx` (`ShareReportDialog`, opened from a ⋯ menu beside the title, which keeps the period row
        clean on phones; a Dialog with the card in every look, `cardThemes` reading each look's tokens by
        setting data-theme on the document and reading computed style back before the next paint; the look on
        screen first; a Checkbox for bodyweight, off by default; Share… via navigator.share with the PNG file where
        files can be shared, Save image via `saveBlob` in src/lib/download.ts, which export-buttons now uses too).
        `src/lib/logic/share-card.ts` is the pure content (the comparison words moved here from report-parts) and
        `src/lib/share-card-draw.ts` the canvas drawing, 1080 × 1350, the favicon as the mark. The first card
        (sessions, hard sets, bests count, every number with "vs the week before") was judged not worth posting:
        the deltas against an empty week only repeated the numbers, hard sets mean nothing to a friend, the win was
        buried, and nothing said whose week it was. The card now: "Sam's week · Sep 21 – 27", the days strip as
        the hero, "5 of 6 sessions" (its change only when the period before had sessions), and one win standing on
        the bottom margin, which the lifter picks from a Highlight select (a beginner's first month has nothing a
        card can call a win, so the app does not guess): the count of new bests, each best heaviest first, a streak
        of two or more periods (`Report.streak`, `periodsInARow`), every planned session done, or nothing. The
        planned sessions are pro-rated from the join date (`plannedFrom`), so a month joined on the 22nd asks for
        eight, not twenty-six, on the card and the page alike. Hard sets stay on the page.
        The look picker is a row of swatches (ToggleGroup items as circles in each look's card colour; the joined
        outline chips broke when they wrapped). The period name in the period row opens a shadcn
        Calendar (dropdown captions) to pick a period, only once a report exists (`hasReports`): in Week mode the row is the
        target (the picked week is a band, a hovered row lights up whole, the days have no hover of their own, any
        day picks its week; the cells stay real buttons, as a `tr` cannot take `role="button"` under the a11y
        rules); in Month mode only the caption shows (arrows and the month and year dropdowns, via the Calendar's
        `classNames` hiding `month_grid`) and the month picks as it moves. The explore e2e spec had three stale steps
        (bench planted 35 days back was time-of-day flaky after 18:00, now 32; Zen mode is a button, not a menu
        item; the effort dialog has no Skip), fixed when the suite ran for the report.
      - (user request) Stats switches its three views with the same control as the report's Week | Month: shadcn
        `ToggleGroup variant="outline" size="sm"` (`StatsTabs` in stats-view.tsx, items `px-3`), no custom class
        anywhere. The panels are plain `div`s shown by the `?tab=` state; the shadcn Tabs file was removed as unused;
        the e2e specs find the views by `radio` role.
      - `scripts/day.ts` plays one day at a time for a test account (`day@example.com`) in the database `.env` points
        at, so the report could be watched growing; the lifter it logs as (a capacity per lift that grows and
        saturates, fatigue across sets, misses, a lift skipped now and then) is `scripts/lifter.ts`, shared with the
        two-year simulator. Running it showed the phone sidebar stayed open after a tap on one of its links
        (`CloseSidebarOnNavigate` in `_app.tsx` now closes it on every route change; the app spec's report test
        caught it on mobile, the first test to tap a nav link from the phone sidebar).
- [x] 54. Today touches (2026-10-13, user requests): the streak shows "week"/"weeks" under its number; Pick a day
      shows "Done today / yesterday / 3 days ago" per day (`lastDoneAt` in schedule.ts with `relativeDay`).
      Carrying a skipped day in the rolling order was weighed and dropped: it would reshuffle the plan's order.
      A Report page, then a Stats Overview with a period control, were built the same day and undone: the
      pieces repeated Stats and the period logic kept shifting. Kept for the next attempt, from the research
      (Hevy, Fitbod, Alpha Progression, Boostcamp; Schoenfeld, Baz-Valle, Pelland, Plotkin, Helms, Iraki):
      a training report holds weekly hard sets per muscle against a target, per-lift progress and new bests,
      sessions done against planned, bodyweight rate a week against the goal, and the effort trend; each number
      against the period before; it is of a finished week or month, never the one running; tonnage, calories
      and percentiles are left out as misleading.
- [x] 53. Weight steps per equipment (2026-10-13, user request). Settings under Units: "Smallest steps" with
      three rows, Bar plates (kg 1.25 / 2.5 / 5, lb 2.5 / 5 / 10), Dumbbells (kg 2 / 2.5 / 5, lb 2.5 / 5 / 10) and
      Machine stack (kg 2.5 / 5 / 10, lb 5 / 10 / 15), or one row with **Same for all** ticked (shadcn Checkbox).
      - `Settings.plate` / `dumbbellStep` / `stackStep` / `sameStep`; `stepsOf(settings)` in progression.ts reads
        them (an unset or other-unit value falls back to 2.5 kg, or 2.5 / 5 / 5 lb, which is what the app used
        before) and `incrementFor(units, equipment, steps, plateLoaded)` picks the kind: bar plates step by two (one
        each side), the others by the value. Set rows take `steps` in place of `plate`.
      - Plate-loaded machines (Leg Press, Leg Press Calf Raise, Hack Squat, Smith Machine Squat / Calf Raise,
        Chest-Supported T-Bar Row) carry `"plateLoaded": true` in library.json and step like a barbell; `startWorkout`
        copies it onto the entry. The live `library` collection got the flag by hand with one `updateMany` (the
        seed only adds missing exercises).
      - The old hidden rule "lower-body machines step 5 kg" is gone: pin machines step by the stack value.
- [x] 52. Session and data safeguards (2026-10-13, user request).
      - Plan edits while a session runs: a session starts from a copy of its plan day, so the day being trained
        wears an "In progress" badge on Plan, and saving an exercise edit or a reorder on it asks "Change today's
        session too?" (Plan only / Plan and today; `TodaySyncDialog` in plan.tsx, `activeDayId` from getPlanFn).
      - "Plan and today" runs `syncSessionFn` → `repo.syncSession`: the day's order and lifts win, logged sets are
        never touched, new lifts come in with targets from `sessionEntries` (shared with `startWorkout`), started
        lifts the plan dropped stay and are named (`syncEntries` in lib/logic/session-sync.ts, unit-tested).
      - Finish: the check-in says "N of M sets are not ticked. They won't count." with Keep going in place of Skip;
        with nothing ticked Finish asks "Discard this workout?" (`DiscardDialog`, shared with the session menu and
        the demo).
      - Download all my data (.zip), in Settings and in the delete-account dialog (`DownloadAllButton`,
        export-buttons.tsx, `fflate`), named `plates-data-<username or email>-<date>.zip`. It holds:
        README.md (`dataReadme`, columns from the same lists the files use), sessions.csv, weigh-ins.csv, tape.csv,
        plan.xlsx (`planWorkbook` in src/lib/plan-workbook.ts, shared with Download template; Excel, not CSV, so
        rep ranges like 6-10 stay text instead of turning into dates), settings.json, feedback.json and
        everything.json. `getExportData` now also returns the plan, the feedback and the account.
      - Every Plates wordmark on a real page links home: the sidebar, the phone header, the How it works footer, and
        the sign-in pages' `AuthFrame`.
- [x] 51. How it works (2026-10-13): the guide went public at `/how-it-works` (`src/routes/how-it-works.tsx`, out
      of the app layout) and is the home page for anyone signed out (`_app` beforeLoad sends a signed-out `/` there;
      every other screen still goes to /login). Its own header (wordmark, Look menu, Sign in / Open app) hides on
      scroll down and returns on scroll up (`src/lib/use-hide-on-scroll.ts`); a footer links Privacy. Signed out it
      opens with a welcome (one line, Get started, two phones). `src/server/public-fns.ts` holds the functions
      anyone may call: `getGuideFn` (signed in or not, the library's pictures) and `getSiteFn` (the origin for the
      share card). The root head carries the og/twitter tags; `public/og.png` is a picture of the welcome's two phones
      (`scripts/guide-pictures.spec.ts`, `playwright.pictures.config.ts`, which also take the sections' screenshots
      from the demo screens). The Look list is shared (`LookRadioGroup` in
      look-menu.tsx) by the account menu and the header; the theme script also follows a look saved in another window.
      `staticData.wide` and `src/lib/route-static-data.ts` were removed with the guide's move.
      Live phones, not screenshots: the welcome (session, stats) and the Zen, Plan and Body sections (`WithDemo`,
      beside the facts from 768px; Facts rows use a container query) each show `/demo/<screen>`
      (`src/routes/demo.$screen.tsx`, public, noindex) in a 393x852 window under Magic UI's iPhone frame
      (`demo-phone.tsx`: `DemoPhone` outside, `PhoneScreen` inside with status bar and home bar). A window of its
      own because the app's breakpoints read the window width. `DemoScreen` (`guide-demos.tsx`) runs the app's own
      pieces on made-up numbers (`src/content/guide/demo-data.ts`: a Pull A, half a year of the default split worked
      out from today, weigh-ins, fifteen months of tape), so the demos follow any change to them. For that the screens
      were split into shared pieces: `useSessionSets` (the set logic, out of `ActiveWorkout`), `session-view.tsx`,
      `ZenScreen` (out of `ZenMode`'s dialog), `plan-view.tsx` (`PlanTitle`, `DaySection`, out of plan.tsx, whose
      private copy of `targetOf` went), `stats-view.tsx`, `stats-lifts.tsx` (`LiftsTab`, `liftsFrom`) and
      `stats-body.tsx` (`BodyTab`, logging passed in), out of stats.tsx (1227 lines to 492); `noon` and `keyTime`
      moved to lib/logic/stats.ts. `ExerciseThumb` reads its pictures from an `ExercisePictures` provider (the app
      layout's library, the guide's loader) and is told where a tap opens.
      Later the same day: one live phone, in the welcome, runs the whole app (`app`: Today, Plan, Stats behind the
      shared `TabBar` from tab-bar.tsx, which the app layout uses too), with a hand-drawn "It's live. Tap around."
      arrow; the Zen, Plan, Stats and Body sections show screenshots of the other demo screens (`WithShot`,
      `scripts/guide-pictures.spec.ts`). The welcome has its own wider column from 1024px so it fits a laptop's first
      screen. More shared pieces for it: `stats-sessions.tsx` (`SessionsTab`; stats.tsx is now 204 lines),
      `exercise-editor.tsx` (`ExerciseEditor`, its server calls passed in as `actions`; out of plan.tsx),
      `session-finish.tsx` (`FinishCheckIn`, `SummaryDialog`; out of index.tsx), `lib/logic/day-edit.ts` (update,
      add, remove, swap an exercise: pure, used by the repo and the demo), `finishSummary` in lib/logic/summary.ts
      (used by repo.finishWorkout and the demo). `useContent()` reads a `ContentProvider` (src/lib/use-content.tsx)
      that the app layout and the demo page fill; `getPublicContentFn` serves the reference content to the demo. The
      demo session is built from the made-up history (`demoSession`), so finishing it shows real-looking bests and
      joins Stats. Zen shows the exercise's picture beside its name (long names wrap). e2e walks the phone: tick, Zen,
      Plan, Stats > Sessions and back. On the dev server a demo window loads the app's unbundled files, so it can take
      seconds there; the production build is quick.
- [x] 50. 2026-10-12 session (commits f972f2f, bf8bfb3, ac586fc, 903b5b5): the phone drawer sits above the
      keyboard (`editor-panel.tsx`, `use-visible-viewport.ts`, vaul `repositionInputs={false}`); ten exercises a
      day; drag-to-reorder exercises with dnd-kit (`sortable-list.tsx`) and Restore default order
      (`logic/default-order.ts`, `repo.reorderExercises`); library name suggestions on the exercise name
      (`exercise-name-field.tsx`, own input inside cmdk's root for dip/cmdk#368 and #370); 16px reading text;
      a full-width Stats calendar on phones; an installable PWA (manifest, icons, offline-only `public/sw.js`,
      Install app in the account menu, `install-app.ts`, `install-dialog.tsx`).
- [x] 49. Biome (user request, 2026-10-12): `biome.json` (2.5.15, single quotes, no semicolons, 120 cols, trailing
      commas, import sorting, `preset: recommended`; skips the route tree, `src/components/ui`, `.claude`, `.mcp.json`, `vercel.json` (Vercel rewrites it onto one line during its build, which failed the first deploy),
      `.cta.json`). `bun run check` = `tsc --noEmit && biome ci .` (fails on errors, not warnings); `bun run check:fix`
      formats and applies safe fixes. `vercel.json` runs `bun run check && bun run build`, so a type or Biome error
      stops the deploy. The first pass formatted 57 files and fixed 19 errors: `useAlternate` and `useDbForTests`
      renamed (`swapToAlternate`, `setDbForTests`) because Biome reads `use…` as a hook; stable keys or a
      `biome-ignore` with its reason where the index is the identity; sr-only text instead of aria-label on spans; the
      body map's muscle groups split into a button and an img branch. The second pass took the 66 warnings to zero:
      `finished()` in stats.ts returns `FinishedWorkout` (the finish time in the type), `must(value, what)` in
      `src/lib/must.ts` replaces `!` where a value is known to exist (it throws naming what was missing),
      `weekdayOf()` in schedule.ts names a day's weekday, and the reduced-motion `!important` lines carry a
      `biome-ignore` with the reason. Keep it at 0 errors, 0 warnings, 0 infos: write no new `!` assertions.
- [x] 47. Google is the only door in production: the password door opens only where AUTH_PASSWORD=true.
      HANDOVER.md item 68.
- [x] 46. Google sign-in, and the emailed link and sign-up code removed: two doors, Google or username /
      email with a password. HANDOVER.md item 67.
- [x] 45. The deload hint at three lifts in four stuck, "too much" holding only the lifts that were not
      clearly fine, and a bodyweight lift under its range naming its alternate. HANDOVER.md item 65.
- [x] 44. Two years of a beginner simulated through the real server code, every split × method, and the
      five rule changes it earned: ramp gate, stall and scale alerts said once, reps first as the default,
      a one-step top set on big plates. HANDOVER.md item 64.
- [x] 43. The smallest plate in Settings: a barbell steps by two of it, dumbbells by a rack step, machines
      by the stack. HANDOVER.md item 62.
- [x] 42. The set ramp: a frequent, completed, fine, moving lift earns one set a week (caps 6 a lift,
      20 a muscle a week), offered on the row; the deload card drops the extra sets. HANDOVER.md item 61.
- [x] 41. Trend chips on the Lifts tab: climbing, stuck, slipping, idle, new, with counts, narrowing
      the lift dropdown. HANDOVER.md item 60.
- [x] 40. Zen mode as a pad: one set, big numbers, one pill; and an alternate swap that brings the
      alternate's own load type. HANDOVER.md items 56 and 57.
- [x] 39. "Not now" on Today's weigh-in and tape reminders: quiet for a day or a week, longer each
      time, never gone for good. HANDOVER.md item 54.
- [x] 38. The library's view of an exercise from its still on Plan, Today, a session and the session
      editor, in place: one dialog in the app layout, opened by ?exercise= in the URL. HANDOVER.md item 53.
- [x] 37. Feedback: three faces and an optional line, from the account menu any time and at the foot of
      the finish summary after five sessions, then monthly. HANDOVER.md item 47.
- [x] 36. Body map on the Sessions tab: front and back figures coloured by the week's hard sets against the
      plan, tappable per muscle. HANDOVER.md item 45.
- [x] 35. Custom split: add, rename, move and remove days on Plan, each new day a block of five lifts
      for its kind; "Your own" in the split picker builds a plan from two to six day kinds. HANDOVER.md
      item 44.
- [x] 34. Delete account (every trace gone, one hashed line in a deletions log) behind a typed
      confirmation with the export buttons beside it, and a public /privacy page. HANDOVER.md item 43.
- [x] 33. Built for gains: finish summary with new bests and the week count, reps-left on the last
      set feeding the targets, stall / week / scale alerts on Today, bodyweight goal (gain, hold,
      cut) at setup and in Settings with a goal-aware pace on the Body tab. HANDOVER.md item 40.
- [x] 32. Progression setting: reps then weight, weight every session, or top set drives (APRE); asked
      at setup, changeable in Settings, defaulting by training age. HANDOVER.md item 39.
- [x] 31. Targets, not prefilled values: each set shows what to aim for from the same plan day's last
      sessions (dynamic double progression, effort-aware, 3-session stall rule) and logs it only when
      marked done. HANDOVER.md item 38.
- [x] 30. One plan per split: switching splits keeps the plan being left and brings back the one
      the user had on the new split, edits and all. HANDOVER.md item 36.

## Next up

Read HANDOVER.md first. Every numbered phase is built and green: 109 unit/repo tests, 36 e2e
(12 flows × 3 viewports). Nothing is committed to git yet (the repo is initialised): commit first.

Left: the React Aria decision (answered below, the user decides) and phase 11's last read-through
of the README and this file.

React Aria (user question, answered 2026-10-11): the shadcn registry has no React Aria items. Its
two official base layers are Radix (this project) and Base UI (the "base" docs). React Aria only
comes through third-party registries such as Jolly UI, which would mean re-adding about 25
components with different APIs and re-running every e2e flow. Not done; the user decides.

Earlier: phase 13 (a: weigh-in nudge, b: finish check-in, c: history, d: effort in stats), then phase 11 README.

Earlier note, kept for history. Phase 10: Playwright flow (setup -> log a workout -> swap an exercise -> stats) on mobile 375, tablet 768, desktop 1280 with screenshots in `e2e/screenshots`. Review the screenshots, fix UX issues, re-run. Then phase 12 (own plan import), phase 13 (progress logging additions), then 11.

## Notes

- Docker Desktop was paused; it was restarted to run Mongo.
- Large files are written with the Write tool; long shell heredocs got cut off once.
- mongodb-memory-server was dropped: its 500 MB binary download timed out. Repo tests use the Docker Mongo instead.
- shadcn CLI wrote `from "cn"` in the ui files; fixed to `#/lib/utils`. It also skipped installing radix-ui, sonner, next-themes; added by hand.
- Windows App Control blocks Playwright's downloaded Chromium (0x11C7). Tests drive the installed Edge/Chrome via `channel` instead.- Playwright Chromium is installed (`chromium-1248`); the install log printed a non-fatal error at the end.
