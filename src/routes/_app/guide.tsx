import { createFileRoute } from '@tanstack/react-router'
import { DocPage, type DocSectionModule, sectionsFrom } from '#/components/content/doc-page'
import { pageTitle } from '#/lib/page-title'

/**
 * The guide: the one page in the app that explains (everything else stays data and controls). Its sections are
 * the MDX files in `src/content/guide`; see `src/content/README.md` for how to write one.
 */
export const Route = createFileRoute('/_app/guide')({
  head: () => ({ meta: [{ title: pageTitle('Guide') }] }),
  staticData: { wide: true },
  component: GuidePage,
})

const SECTIONS = sectionsFrom(import.meta.glob<DocSectionModule>('../../content/guide/*.mdx', { eager: true }))
const IDS = SECTIONS.map((s) => s.id)

function GuidePage() {
  return <DocPage title="Guide" sections={SECTIONS} ids={IDS} />
}
