# Content

Long-form pages written in MDX: markdown that can use React components. The guide lives here today; posts or
other docs follow the same pattern.

## A page made of sections

One folder per page, one file per section, named `NN-id.mdx`:

- `NN` orders the sections (`01`, `02`, …). The id after it becomes the section's anchor (`#targets`).
- Each file exports a `title`. It may also export an `icon` (a lucide component) and a `part`, a group name the
  contents list shows above its sections.
- The route loads the folder and renders it with `DocPage` (`src/components/content/doc-page.tsx`), and sets
  `staticData: { wide: true }` so the layout makes room for the sticky contents list on wide screens.
  `src/routes/_app/guide.tsx` is the example to copy.

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

## Writing rules

- Put a component's text on the same line as its tags, as above. Text on its own lines inside a component turns
  into paragraphs with paragraph spacing.
- Escape `<` and `{` in plain text as `\<` and `\{`: MDX reads them as code.
- Comments are `{/* like this */}`; HTML comments do not work. Indented code blocks do not work either; use
  fenced ones.
- Keep classes out of `.mdx` files. Styling lives in the TSX blocks.
- Check every claim against the code before it goes in. The guide names real buttons and real rules.
