import { useLoaderData } from '@tanstack/react-router'
import type { Content } from './content'

/** The split templates and the exercise library, loaded once per visit by the app shell. */
export function useContent(): Content {
  return useLoaderData({ from: '/_app' }) as Content
}
