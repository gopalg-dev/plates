# Plates

A personal gym logbook, built for a phone between sets: see the next session, log a set in two
taps, and read stats that come only from what you logged. Sign in from any device and your log
follows you. The name is the mark: three plates in the push, pull and legs colours.

Four screens, one job each:

- **Today**: the next day in the rolling order, this week's sessions and the streak, exercise rows
  that expand into a set logger with plate-step buttons, prefilled from last time, and Finish with
  a one-tap effort check-in. The header's menu switches the day or discards the session.
- **Plan**: the days of your split, each exercise with its picture. Edit an exercise, swap in an
  alternate, add or remove exercises (six per day at most), or bring your own plan from an Excel
  template.
- **Stats**, in three tabs. Lifts: pick a lift and see it week by week, the latest best set, a
  chart of each week's best set, a table reading "this week 62.5 kg × 7, last week 60 kg × 8,
  +2.5 kg", and recent bests. Sessions: the week's count, streak, hard sets, weight lifted and
  minutes, a month calendar where tapping a day opens that session to fix a set or remove it,
  hard sets per muscle against the plan, and the Excel / CSV export. Body: bodyweight chart (tap
  a point to edit or remove a weigh-in) and measurements.
- **Library**: 137 exercises with a picture, muscles, equipment and cues, searchable and
  filterable. "Pick from library" fills an exercise in from the plan editor or the import preview.
- **Settings**: units, training age, rolling or weekday schedule, the split
  (switch in place), and "Start fresh" behind a typed confirmation. On a phone the menu button
  opens the sidebar; the profile row at its foot holds Settings and Sign out.

First run asks four questions, one per screen: units, which split (nine templates from
Push / Pull / Legs to Full body and the Arnold split), bodyweight, training age. Days can run in a
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

## Accounts

Three ways to sign in, all on `/login`:

- **Email link**: enter your email, open the link we send, and you are in. New addresses get an
  account and go straight to setup. Links work for 15 minutes.
- **Google**: shown once `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Create OAuth
  credentials in Google Cloud and add `BETTER_AUTH_URL` + `/api/auth/callback/google` as an
  authorised redirect URI.
- **Username and password**: create one on `/signup`. A six-digit code goes to the address and has
  to be typed back before the account can sign in, so a made-up address never gets in. Sign in with
  the username or the email.

Mail goes through [Resend](https://resend.com) when `RESEND_API_KEY` is set (`MAIL_FROM` is the
sender). Without it, the sign-in link is printed by the dev server and kept in the `mail_outbox`
collection, which is fine for local use and is what the tests rely on.

Each account has its own settings, plan and logs. The first account created on a database takes
over any data logged before accounts existed.

## Scripts

| Script | What it does |
|---|---|
| `bun run dev` | Dev server on port 3000 |
| `bun run build` and `bun run preview` | Production build and a local preview |
| `bun run typecheck` | TypeScript |
| `bun run test` | Unit tests plus repository tests against the local Mongo in a `_test` database |
| `bun run test:e2e` | Playwright flows on phone, tablet and desktop sizes, screenshots in `e2e/screenshots` |
| `bun run generate-routes` | Regenerate `src/routeTree.gen.ts` after adding a route file |

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
src/lib/splits.ts           the nine split templates
src/lib/library.ts          the exercise library (data in library.json, from free-exercise-db)
src/lib/logic/              pure logic: next day, weekday schedule, progression, stats, sheet parsing, export rows
src/lib/auth-client.ts      Better Auth client
src/server/db.ts            Mongo client
src/server/auth.ts          Better Auth instance (server only)
src/server/session.ts       session server function and the auth middleware
src/server/mail.ts          mail sending, with the development outbox
src/server/repo.ts          reads and writes, one user at a time
src/server/fns.ts           server functions with zod validation
src/routes/                 login, signup, setup, today (/), plan, plan/import, stats, library, settings, api/auth
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

Five looks, picked from the account menu and kept on the device: Slate (the default, dark when the
device is), Chalk (warm white and graphite, flat), Pocket (the device's own typeface, soft corners,
white cards, blue buttons), and two popular themes on their own published palettes, Catppuccin Latte
and Dracula. Each is a block of token values in `src/styles.css`; the components never change, and
red, blue and yellow still mean push, pull and legs in every one of them.
