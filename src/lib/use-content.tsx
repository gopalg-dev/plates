import { createContext, type ReactNode, useContext } from 'react'
import type { Content } from './content'

/*
 * The split templates and the exercise library: reference content, the same for everyone. The app layout loads it
 * once per visit and provides it; the demo on How it works provides it too, so the app's pieces that read it run there
 * unchanged.
 */

const ContentContext = createContext<Content | null>(null)

export function ContentProvider({ content, children }: { content: Content; children: ReactNode }) {
  return <ContentContext value={content}>{children}</ContentContext>
}

export function useContent(): Content {
  const content = useContext(ContentContext)
  if (!content) throw new Error('useContent() needs a ContentProvider above it: the app layout or a demo page')
  return content
}
