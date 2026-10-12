import { ChevronDown, Lightbulb } from 'lucide-react'
import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import { cn } from '#/lib/utils'

/**
 * How MDX content looks in the app, shared by every content page (the guide today, posts later). `mdxComponents`
 * restyles plain markdown and provides the blocks below under their own names, so any `.mdx` file can write
 * `<Facts>` or `<Tip>` without importing them. Page-specific visuals are imported by the file that uses them.
 *
 * The shape of a section: a `Lead` line, then one visual or a `Facts` list, with the fine print in `More`.
 * Styling stays here, in TSX, where Tailwind looks for class names.
 */

const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** The one line a section opens with: what it is about, in larger type. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-lg leading-snug text-foreground">{children}</p>
}

/** Short rows: a term on the left, the answer beside it. Hairlines between, as the app's lists have. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="mt-5 divide-y border-y">{children}</dl>
}

export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-medium text-foreground">{term}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  )
}

/** Steps that happen in this order. Only for a real sequence: the numbers say "then". */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-5 flex flex-col gap-5">{children}</ol>
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
      <span
        aria-hidden
        className="font-condensed text-4xl font-semibold leading-none tabular-nums text-muted-foreground/60"
      >
        {n}
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}

/** The fine print, folded away: rules a reader can trust without reading, and open when curious. */
export function More({ title = 'How it decides', children }: { title?: string; children: ReactNode }) {
  return (
    <Collapsible className="group/more mt-4">
      <CollapsibleTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
          focusRing,
        )}
      >
        <ChevronDown aria-hidden className="size-4 transition-transform group-data-[state=open]/more:rotate-180" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 border-l-2 pl-4 text-sm text-muted-foreground">{children}</CollapsibleContent>
    </Collapsible>
  )
}

/** The one piece of advice in a section that matters most. */
export function Tip({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-5 flex gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p>{children}</p>
    </aside>
  )
}

/** Plain markdown restyled, plus the blocks above by name. Bold marks a label the reader sees on screen. */
export const mdxComponents: MDXComponents = {
  strong: ({ children }) => <span className="font-medium text-foreground">{children}</span>,
  p: ({ children }) => <p className="mt-4 text-muted-foreground">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-4 flex list-disc flex-col gap-2.5 pl-5 text-muted-foreground marker:text-muted-foreground/50">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 flex list-decimal flex-col gap-2.5 pl-5 text-muted-foreground marker:text-muted-foreground">
      {children}
    </ol>
  ),
  h3: ({ children }) => <h3 className="mt-8 font-condensed text-xl font-semibold leading-none">{children}</h3>,
  a: ({ children, href }) => (
    <a href={href} className={cn('text-foreground underline underline-offset-4 hover:text-primary', focusRing)}>
      {children}
    </a>
  ),
  Lead,
  Facts,
  Fact,
  Steps,
  Step,
  More,
  Tip,
}
