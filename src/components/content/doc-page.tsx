import type { LucideIcon } from 'lucide-react'
import type { MDXComponents, MDXContent } from 'mdx/types'
import { Fragment } from 'react'
import { SectionHeading } from '#/components/app/section-heading'
import { useActiveSection } from '#/lib/use-active-section'
import { cn } from '#/lib/utils'
import { mdxComponents } from './mdx'

/**
 * A content page made of MDX section files: the guide today, any long read later. A folder holds one file per
 * section, named `NN-id.mdx`: the number orders the sections, the id becomes the anchor. Each file exports a
 * `title`, and may export an `icon` (a lucide component) and a `part` (a group name for the contents list).
 * The route loads the folder with `import.meta.glob(..., { eager: true })`, turns it into sections with
 * `sectionsFrom`, renders `DocPage`, and sets `staticData: { wide: true }` so the app layout makes room for the
 * contents list. See `src/content/README.md`.
 */

export interface DocSectionModule {
  default: MDXContent
  title: string
  icon?: LucideIcon
  part?: string
}

export interface DocSection {
  id: string
  title: string
  icon?: LucideIcon
  part?: string
  Body: MDXContent
}

/** The sections of a folder, in file-name order. Pass the result of `import.meta.glob` for that folder. */
export function sectionsFrom(modules: Record<string, DocSectionModule>): DocSection[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, mod]) => ({
      id: path.replace(/^.*\/(\d+-)?/, '').replace(/\.mdx$/, ''),
      title: mod.title,
      icon: mod.icon,
      part: mod.part,
      Body: mod.default,
    }))
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * The page: a title, the sections, and their jump links. Below 1280px the links wrap above the text; from 1280px
 * they are a column beside it that stays in view, grouped by part, and marks the section being read. Only one of
 * the two is ever shown, so they share a name. `components` adds to or overrides `mdxComponents` for this page.
 */
export function DocPage({
  title,
  sections,
  ids,
  components,
}: {
  title: string
  sections: DocSection[]
  /** The section ids, as a stable array (a module constant), for the scroll tracking. */
  ids: string[]
  components?: MDXComponents
}) {
  const active = useActiveSection(ids)
  const mdx = components ? { ...mdxComponents, ...components } : mdxComponents
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,38rem)_12rem] xl:gap-12">
      <div className="min-w-0">
        <h1 className="font-condensed text-4xl font-semibold leading-none">{title}</h1>

        <nav aria-label={`${title} sections`} className="mt-6 flex flex-wrap gap-2 xl:hidden">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                focusRing,
              )}
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="mt-10 flex flex-col gap-12">
          {sections.map(({ id, title: heading, icon, Body }) => (
            <section key={id} id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 xl:scroll-mt-8">
              {icon ? (
                <SectionHeading id={`${id}-h`} icon={icon}>
                  {heading}
                </SectionHeading>
              ) : (
                <h2 id={`${id}-h`} className="font-condensed text-2xl font-semibold leading-none">
                  {heading}
                </h2>
              )}
              <Body components={mdx} />
            </section>
          ))}
        </div>
      </div>

      <aside className="hidden xl:block">
        <nav aria-label={`${title} sections`} className="sticky top-8">
          <ul className="flex flex-col border-l">
            {sections.map((s, i) => (
              <Fragment key={s.id}>
                {s.part && s.part !== sections[i - 1]?.part && (
                  <li aria-hidden className={cn('pb-1 pl-4 text-xs text-muted-foreground/80', i > 0 && 'mt-4')}>
                    {s.part}
                  </li>
                )}
                <li>
                  <a
                    href={`#${s.id}`}
                    aria-current={s.id === active ? 'location' : undefined}
                    className={cn(
                      '-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-muted-foreground transition-colors hover:text-foreground',
                      s.id === active && 'border-foreground font-medium text-foreground',
                      focusRing,
                    )}
                  >
                    {s.title}
                  </a>
                </li>
              </Fragment>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  )
}
