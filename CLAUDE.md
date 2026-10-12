# Plates

Keep this file short: under 100 lines. Project history and decisions live in `PROJECT_CONTEXT.md`.

## Components

- Need a new piece of UI? First look for a shadcn component that does the job: the ones in
  `src/components/ui`, then the shadcn registry. Build a custom component only when none fits.
- Wherever a shadcn component is used and needs adjusting, reach for its props (`variant`, `size`
  and the like) first, and add classes through `className` only when no prop does it.

## Stuck on a bug

When a fix does not hold after a first honest attempt, in our logic or in a component's behaviour,
do not keep fighting it: search the web straight away for existing issues (the library's GitHub
issues first, then discussions and posts) and build the fix from what they found.

## Before you finish

Before calling any feature or code change done, and before any push, run the check:

```sh
bun run check   # tsc --noEmit && biome ci .
```

It must pass with zero errors, warnings and infos: Vercel runs the same command before every deploy.
`bun run check:fix` applies Biome's safe fixes and formatting.

Any UI change gets tried at every viewport before it is called done: 360 and 393 (phones, touch,
including with the on-screen keyboard up where there are inputs), 768 (tablet, touch), 1024 and 1440
(desktop, mouse). Check that it looks right and works: layout, overflow, tap and click targets, focus,
drawers and dialogs. Then run the e2e suite (`bun run test:e2e`), which covers phone, tablet and desktop.
