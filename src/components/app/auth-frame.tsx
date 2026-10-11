import type { ReactNode } from 'react'
import { AppMark } from './app-mark'

interface Props {
  title: string
  intro: ReactNode
  children: ReactNode
  /** The line under the form, for the other way in. */
  footer: ReactNode
}

/**
 * The frame around sign-in and sign-up: the plate mark and wordmark, a big condensed title,
 * one sentence, then the form with room to breathe. Left aligned, phone first.
 */
export function AuthFrame({ title, intro, children, footer }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="flex items-center gap-2.5 text-muted-foreground">
        <AppMark className="size-7" />
        <span className="font-condensed text-lg font-medium leading-none">Plates</span>
      </p>
      <h1 className="mt-6 font-condensed text-5xl font-semibold leading-none">{title}</h1>
      <p className="mt-3 text-muted-foreground">{intro}</p>

      <div className="mt-10">{children}</div>

      <p className="mt-10 text-sm text-muted-foreground">{footer}</p>
    </main>
  )
}

/** Input classes for the auth forms: the set logger's field look, big enough for thumbs. */
export const authInput =
  'h-12 rounded-lg border-input bg-card px-4 text-base shadow-none placeholder:text-muted-foreground/60 dark:bg-card'
