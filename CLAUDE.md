# Plates

Keep this file short: under 100 lines. Project history and decisions live in `PROJECT_CONTEXT.md`.

A rule that needs more than a few lines of detail keeps that detail in its own file under
`docs/agents/`, and the rule names the file as a plain path, so it is read only when the rule applies.
Never `@`-import those files here: an import loads them into every session.

## What the app does

The app shows: stats, reports, targets and the plan. It never pushes the user toward a decision. No
streak guilt, no "sessions left", no "skipped this week", no "do it now". Surface the information and
let the user act on their own free will; every decision and customization is theirs alone.

## Components

- Need a new piece of UI? First look for a shadcn component that does the job: the ones in
  `src/components/ui`, then the shadcn registry. Build a custom component only when none fits.
- Wherever a shadcn component is used and needs adjusting, reach for its props (`variant`, `size`
  and the like) first, and add classes through `className` only when no prop does it.

## Tidy code

- About to write a piece of logic a second time? Extract it once and reuse it in both places.
- Keep concerns apart: data and state, server code and UI each live in their own module.
- A change to an existing feature or logic also removes what it leaves unused: functions, props,
  flags, styles, and docs that describe the old shape.

## Stuck on a bug

When a fix does not hold after a first honest attempt, in our logic or in a component's behaviour,
do not keep fighting it: search the web straight away for existing issues (the library's GitHub
issues first, then discussions and posts) and build the fix from what they found.

## Before you finish

Before calling any feature or code change done, and before any push, run the check:

```sh
bun run check   # tsc --noEmit && biome ci .
```

It must end with zero errors, zero warnings and zero infos (`biome ci . --diagnostic-level=info`
shows all three): Vercel runs the same check before every deploy. `bun run check:fix` applies Biome's
safe fixes and formatting.

Fix what a diagnostic points at, not the diagnostic. No `biome-ignore`, `@ts-expect-error`, `!` or
`as any` just to quiet one. A suppression is for a rule that is genuinely wrong for that line, with
the reason written beside it.

Any UI change gets tried at every viewport, then the e2e suite, before it is called done:
see `docs/agents/viewport-testing.md`.
