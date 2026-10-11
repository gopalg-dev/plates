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
- `src/server/db.ts` Mongo client (tests inject a db with `useDbForTests`)
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
      cap of six (`MAX_EXERCISES_PER_DAY`, templates trimmed to fit, import capped); phone header
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
- [x] 25. Looks: Slate (default), Chalk and Pocket, plus Catppuccin Latte and Dracula, as token
      blocks keyed on `<html data-theme>`,
      picked from the account menu, kept per device, applied before paint. HANDOVER.md item 27.
- [x] 26. Day glyphs: a plate-coloured tile with a lucide glyph per day type replaces the colour bar
      on days, titles and pickers (`DayIcon`). HANDOVER.md item 28.
- [x] 27. Mail and sign-up hardening: the sign-in email in the app's look, Resend errors surfaced,
      used links explained on the sign-in page, favicon and tab titles, and sign-up verified by a
      six-digit emailed code before a password account can sign in. HANDOVER.md items 29 to 32.
- [x] 28. The app is called Plates (was "Workout plan"): wordmark, titles, mails, file names, README. HANDOVER.md item 33.
- [x] 29. Content in the database: the split templates and the exercise library in `splits` and
      `library`, seeded from the bundled copies when empty or by `bun run db:seed`, read once per
      visit through the shell route. Editable without a deploy. HANDOVER.md item 35.
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
- Windows App Control blocks Playwright's downloaded Chromium (0x11C7). Tests drive the installed Edge/Chrome via `channel` instead.
- Playwright Chromium is installed (`chromium-1248`); the install log printed a non-fatal error at the end.
