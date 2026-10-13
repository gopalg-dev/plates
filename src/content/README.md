# Content

Long-form pages written in MDX: markdown that can use React components. The guide lives here today, shown as
How it works (`/how-it-works`, public, and the home page for anyone signed out); posts or other docs follow the
same pattern.

## A page made of sections

One folder per page, one file per section, named `NN-id.mdx`:

- `NN` orders the sections (`01`, `02`, …). The id after it becomes the section's anchor (`#targets`).
- Each file exports a `title`. It may also export an `icon` (a lucide component) and a `part`, a group name the
  contents list shows above its sections.
- The route loads the folder and renders it with `DocPage` (`src/components/content/doc-page.tsx`) inside
  `DOC_COLUMN`, which widens from 1280px to fit the sticky contents list beside the text.
  `src/routes/how-it-works.tsx` is the example to copy.

```mdx
import { TrendingUp } from 'lucide-react'

export const title = 'How targets move'
export const part = 'How the coach works'
export const icon = TrendingUp

<Lead>One line that says what this section is about.</Lead>

<Facts>
  <Fact term="Weight steps">A short answer, on one line.</Fact>
</Facts>

<More>The fine print, folded away.</More>
```

## Blocks every page can use

These come with every content page, no import needed (`src/components/content/mdx.tsx`):

| Block | Use it for |
| --- | --- |
| `<Lead>` | The one line a section opens with. |
| `<Facts>` and `<Fact term="…">` | Short rows: a term, then its answer. The default for most content. |
| `<Steps>` and `<Step n={1} title="…">` | Things that happen in this order. Only for a real sequence. |
| `<More title="…">` | Fine print a reader can skip. The title defaults to "How it decides". |
| `<Tip>` | The one piece of advice in a section that matters most. One per section at most. |

Plain markdown works too. **Bold** reads as a label the reader sees on screen. Lists, numbered lists, links and
`###` subheadings are styled.

Visuals that belong to one page (the guide's ladder, day tiles, trend lines) live beside that page's code, such as
`src/components/app/guide-blocks.tsx`, and are imported by the section that shows them.

The demo screens are `/demo/<screen>`: the app's own pieces (`useSessionSets`, `session-view.tsx`,
`session-finish.tsx`, `ZenScreen`, `plan-view.tsx`, `exercise-editor.tsx`, `stats-*.tsx`, the tab bar) on the made-up
numbers in `src/content/guide/demo-data.ts`, run by `DemoScreen` (`guide-demos.tsx`), so they follow any change to
those pieces. Their edits go through the same pure functions the server uses (`lib/logic/day-edit.ts`,
`finishSummary`), and the demo page provides `useContent()` as the app layout does. Nothing is saved. `app` is the
whole app behind its tab bar: tick sets, Zen, finish with the check-in and summary (the session then shows in Stats),
edit and add exercises on Plan. `zen`, `plan`, `lifts` and `body` are one screen each.

The welcome shows `app` live: a `DemoPhone` opens it in a window the size of a phone inside an iPhone frame, so the
app's breakpoints see a phone. Its label names the window for screen readers and the e2e tests.

`<WithShot name="zen" alt="…">` wraps a section's `<Facts>` and puts a screenshot of that demo screen beside them
(above them on phones), light or dark to match the page, from `public/guide/<name>-light.webp` and `-dark.webp`.
After a screen changes, take the screenshots and the share card (`public/og.png`) again (needs the local MongoDB):

```sh
node node_modules/@playwright/test/cli.js test --config playwright.pictures.config.ts
```

## Writing rules

- Put a component's text on the same line as its tags, as above. Text on its own lines inside a component turns
  into paragraphs with paragraph spacing.
- Escape `<` and `{` in plain text as `\<` and `\{`: MDX reads them as code.
- Comments are `{/* like this */}`; HTML comments do not work. Indented code blocks do not work either; use
  fenced ones.
- Keep classes out of `.mdx` files. Styling lives in the TSX blocks.
- Check every claim against the code before it goes in. The guide names real buttons and real rules.
