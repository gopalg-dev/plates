# Plates

A gym logbook for the time between sets.

See the next session, log a set in two taps, and read stats that come only from what you logged.
Sign in from any device and your log follows you. The name is the mark: three plates in the push,
pull and legs colours.

Four screens, one job each:

- **Today**: the next day in the rolling order, this week's sessions and the streak, exercise rows
  that expand into a set logger with plate-step buttons, each set showing the target worked out from
  last time (reps up, then weight up, set by set), a reps-left tap on the last set so a light
  weight moves up sooner, a "+1 set to plan" offer on a lift trained often, completed and felt fine
  (one set a week, up to 6 a lift and 20 a muscle a week; the deload card drops them again), and
  Finish with a one-tap effort check-in followed by what the session did:
  every lift's best set, new bests, the week's count. Lifts that stopped moving, a week running out and a
  scale that is not moving show up here as one-line alerts. The header's menu switches the day or discards the session.
- **Plan**: the days of your split, each exercise with its picture. Edit an exercise, swap in an
  alternate, add or remove exercises (ten per day at most), add a day of any kind (it starts with
  five lifts), rename, reorder or remove days, or bring your own plan from an Excel template.
- **Stats**, in three tabs. Lifts: chips sort the lifts by trend (climbing, stuck, slipping, idle, new);
  pick a lift and see it week by week, the latest best set, a
  chart of each week's best set, a table reading "this week 62.5 kg × 7, last week 60 kg × 8,
  +2.5 kg", and recent bests. Sessions: the week's count, streak, hard sets, weight lifted and
  minutes, a month calendar where tapping a day opens that session to fix a set or remove it,
  a body map (front and back, each muscle grey, red or green by the week's hard sets against the
  plan, tap one for the number) over the hard sets per muscle, and the Excel / CSV export. Pull-ups and other bodyweight
  work count at your logged bodyweight in the weight lifted and in new bests. Body: bodyweight chart (tap
  a point to edit or remove a weigh-in) and measurements, arm, chest and waist on one chart as the change
  since the first tape.
- **Report** (menu): a finished week or month next to the one before. Sessions
  against the plan, hard sets, new bests and bodyweight, each compared with the period before in words; what needs
  attention (muscles under nine tenths of their target, stuck or slipping lifts, Too much sessions, the deload signal), shown only when
  there is something; new bests and lifts that beat the period before; a bar strip of the last 8 weeks or 6 months
  with this period in colour; the period name opens a calendar picker; the period's days as a calendar; hard sets per muscle as bars against the period
  before; a bodyweight line; the effort mix and reps left. Finished periods only, a week needs 1 session and a month 3; Today links to the new report
  for two days after a week or month ends. Share draws the week as a 1080 × 1350 PNG in any of the
  looks: the days, the sessions, and a highlight the lifter picks: a new best, how many, the streak, every session
  done, or nothing (the share sheet on phones, a download elsewhere); bodyweight only when ticked.
- **Library**: 137 exercises with a picture, muscles, equipment and cues, searchable and
  filterable. "Pick from library" fills an exercise in from the plan editor or the import preview.
  The picture on any exercise row (Plan, Today, a session) opens the same view in place, through
  `?exercise=<id>` in the URL, so a reload or a shared link opens it too.
- **Settings**: units, the gym's smallest steps for bar plates, dumbbells and the machine stack, or one for all (a barbell steps by two plates), training age, bodyweight goal, progression, whether the screen stays on during
  a session, rolling or weekday schedule, the split (switch in place;
  each split keeps its own plan, so coming back finds your edits), and "Start fresh" behind a typed
  confirmation. On a phone the menu button opens the sidebar; the profile row at its foot holds
  Settings and Sign out.

First run asks five questions, one per screen: units, which split (nine templates from
Push / Pull / Legs to Full body and the Arnold split, or your own: a kind for each of two to six days), bodyweight, training age, and how the weight
should go up (reps then weight, weight every session, or the last set to as many reps as you can
setting the next load). Days can run in a
rolling order or sit on fixed weekdays, with Today showing a rest day or anything skipped this week.

## Stack

- [TanStack Start](https://tanstack.com/start) on Vite, React 19, TypeScript
- [shadcn/ui](https://ui.shadcn.com) components on Tailwind v4
- [Better Auth](https://www.better-auth.com) for accounts, MongoDB through the official Node driver
- bun for scripts and packages
- vitest for unit and repository tests, Playwright for end-to-end tests

## Run it

You need [bun](https://bun.sh) and Docker.

```sh
bun install
bun run db:up        # MongoDB 7 in Docker on port 27017, data kept in a volume
cp .env.example .env # then set BETTER_AUTH_SECRET to a random string of 32+ characters
bun run dev          # http://localhost:3000
```

Stop the database with `bun run db:down`. Data stays in the `workout-mongo-data` volume.

To use a hosted MongoDB instead, set `MONGODB_URI` and `MONGODB_DB` in `.env`.

## Content: the templates and the library

The nine split templates and the exercise library live in the database (`splits`, `library`), so
they can be edited there without a deploy. The copies in the code (`src/lib/splits.ts`,
`src/lib/library.json`) are the seed: an empty database fills itself from them on the first request,
and `bun run db:seed` does the same by hand.

```sh
bun run db:seed                 # adds whatever the bundle has that the database lacks; edits stay
bun run db:seed -- --reset      # replaces both collections with the bundle
bun run db:repair               # lists exercises whose load type disagrees with the library; --yes applies
bun run db:simulate -- matrix   # two years of a beginner through the real server code, every split × method
bun run db:simulate -- seed     # the same two years for a new sim@example.com account in the dev database, to look at
bun scripts/day.ts              # one day at a time for day@example.com in the database .env points at: sessions as the
                                # simulated lifter logs them, to watch Today, Stats and the Report change day by day
bun run db:seed -- --demo       # also a demo account with eight weeks of logs; empty database only
```

The seed refuses a database that is not on localhost unless `--yes`. The app reads both collections
once per visit and caches them for an hour in the browser and a minute on the server, so an edit
shows up within that.

## Deploy to Vercel

The server side builds through Nitro (`nitro()` in `vite.config.ts`), which Vercel detects on its
own: import the repository at vercel.com/new, keep the detected TanStack Start preset and the
default build settings, and set these environment variables for Production:

| Variable                                   | Value                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `MONGODB_URI`, `MONGODB_DB`                | a hosted MongoDB, for example an Atlas cluster, with the app's database name                    |
| `BETTER_AUTH_SECRET`                       | a random string of 32+ characters, different from the one in `.env`                             |
| `BETTER_AUTH_URL`                          | the site's address, `https://<project>.vercel.app` or your domain, no trailing slash            |
| `RESEND_API_KEY`, `MAIL_FROM`              | the Resend key and a sender on a domain verified at Resend                                      |
| `FEEDBACK_TO`                              | optional: an address that gets a copy of every piece of feedback sent from the app              |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in, the one door in production, with `BETTER_AUTH_URL` + `/api/auth/callback/google` as a redirect URI |
| `AUTH_PASSWORD` | leave unset in production; `true` opens the password door (local, tests) |

The function region is set in `vite.config.ts` (`regions: ['bom1']`, Mumbai): put it where the database is, or
every page pays a long round trip per query. Node 24 or later. A change to a variable needs a redeploy. `bun run build` runs the same build
locally and `bun run preview` serves it.

## Accounts

Two doors on `/login`, each open only where it is configured:

- **Google**: shown once `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Create OAuth
  credentials in Google Cloud and add `BETTER_AUTH_URL` + `/api/auth/callback/google` as an
  authorised redirect URI. In production this is the only door: a sign-up costs a real Google
  account, which is what keeps spam out.
- **Username and password**: open only where `AUTH_PASSWORD=true` (the dev server, the tests).
  Create one on `/signup` with a username, an email and a password; the account is signed in at
  once and setup follows. Sign in with the username or the email. Leave the variable unset on
  Vercel and the page shows Google alone, with no sign-up API behind it.

No sign-in links and no emailed codes: those need a verified sender domain, and the app is meant
to run without one. Mail goes through [Resend](https://resend.com) only for the copy of feedback
sent to `FEEDBACK_TO`, when that and `RESEND_API_KEY` are set.

The account menu has Send feedback: three faces and an optional line, stored with the account and
mailed to `FEEDBACK_TO` when that is set. The same two fields appear at the foot of the finish summary
after five sessions, then at most once a month.

Settings has Delete account: a typed confirmation, the export buttons beside it, and then every trace
of the account and its data leaves the database. The only thing kept is one line in a `deletions`
collection: the date, a one-way hash of the email, the session count and the days active. The
/privacy page says the same in plain words and is linked from the sign-in and sign-up pages.

Each account has its own settings, plan and logs. The first account created on a database takes
over any data logged before accounts existed.

## Scripts

| Script                                | What it does                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                         | Dev server on port 3000                                                                                        |
| `bun run build` and `bun run preview` | Production build and a local preview                                                                           |
| `bun run typecheck`                   | TypeScript                                                                                                     |
| `bun run test`                        | Unit tests plus repository tests against the local Mongo in a `_test` database                                 |
| `bun run test:e2e`                    | Playwright flows on phone, tablet and desktop sizes, screenshots in `e2e/screenshots`                          |
| `bun run test:explore`                | a longer walkthrough as a user, time-travelling through the database; screenshots in `e2e/screenshots/explore` |
| `bun run generate-routes`             | Regenerate `src/routeTree.gen.ts` after adding a route file                                                    |

The repository tests skip themselves when no MongoDB is reachable. The end-to-end run starts its own
dev server on port 3100 against a `_e2e` database and wipes it first. `node e2e/check-hydration.mjs`
loads a page in headless Chrome and prints console errors, for when a page stops responding.

On Windows the end-to-end tests drive the installed Chrome, because App Control blocks the
Chromium build Playwright downloads.

## Bring your own plan

On the Plan screen, choose "Bring your own plan". Pick a template, your current plan or any of the
nine splits, and download it: an `.xlsx` with the days on the `Plan` sheet, the rules on the `Guide`
sheet, and a `Template` sheet naming the split it came from. Edit it in Excel or Google Sheets, upload
it back, check the preview, fix anything inline, then confirm. The file is read in the browser and
never stored. A file that still carries its template marker puts the plan on that split; one without
(any `.csv`, or a sheet you built yourself) becomes a custom plan.

Columns: Day, Type, Exercise, Sets, Reps, Load, Muscle, Note, Alternates. Leave Day blank to keep the
same day as the row above. Type, Load and Muscle can be blank; they are guessed from the names.
A `.csv` with the same header works too.

## Export your logs

On Stats, under Sessions, "Download Excel" writes an `.xlsx` with three sheets: Sets (one row per logged set,
with the session's day, effort and note repeated on each row so filters and pivots work),
Bodyweight and Measurements. "Download CSV" writes the Sets sheet only. Both are built in the
browser from your own data.

## Where things live

```
src/lib/types.ts            shared types
src/lib/seed-plan.ts        the default six-day plan
src/lib/content.ts          the content types and the pure helpers over the templates and the library
src/lib/splits.ts           the bundled split templates (the seed)
src/lib/library.ts          the bundled exercise library (data in library.json, from free-exercise-db) and its search
src/server/content.ts       reads the content from the database, seeds it when empty
src/lib/logic/              pure logic: next day, weekday schedule, progression, stats, sheet parsing, export rows
src/lib/auth-client.ts      Better Auth client
src/server/db.ts            Mongo client
src/server/auth.ts          Better Auth instance (server only)
src/server/session.ts       session server function and the auth middleware
src/server/mail.ts          mail sending, with the development outbox
src/server/repo.ts          reads and writes, one user at a time
src/server/fns.ts           server functions with zod validation
src/routes/                 login, signup, privacy, setup, today (/), plan, plan/import, stats, library, settings, api/auth
src/components/app/         auth frame, date picker, day mark, editor panel, library list, number field, ...
src/components/ui/          shadcn components
tests/                      vitest
e2e/                        Playwright
PROJECT_CONTEXT.md          goals, design decisions, phases, what is next
HANDOVER.md                 how to pick the work up
```

## Design notes

Colours live on the default shadcn token keys in `src/styles.css`, written as `hsla()`. The only
custom tokens are `--day-push`, `--day-pull`, `--day-legs` (plate colours for the day types), their
`-ink` partners (the glyph colour on top of each plate, which a theme with pastel plates darkens)
and `--success`. Type is Barlow, with Barlow Condensed for titles and big numbers. Bottom sheets are
shadcn Drawers; forms use the shadcn field components.

The body map on Stats uses the figure polygons of [react-body-highlighter](https://github.com/giavinh79/react-body-highlighter)
by GV79, MIT License, folded into the nine muscles the app tracks.

Five looks, picked from the account menu and kept on the device: Slate (the default, dark when the
device is), Chalk (warm white and graphite, flat), Pocket (the device's own typeface, soft corners,
white cards, blue buttons), and two popular themes on their own published palettes, Catppuccin Latte
and Dracula. Each is a block of token values in `src/styles.css`; the components never change, and
red, blue and yellow still mean push, pull and legs in every one of them.

## Licence

MIT. See `LICENSE`.
