import type { LibraryRow } from './library'
import type { PlanDay, PlanSource, SplitId } from './types'

/**
 * Reference content: the split templates and the exercise library. It lives in the database
 * (`splits`, `library`), seeded from the bundled copies in `splits.ts` and `library.json`, and the
 * app receives it once per visit through the shell route, the library as rows (an entry's cues come
 * when its detail opens). These helpers are pure: they take the lists they work on.
 */

export interface SplitTemplate {
  id: SplitId
  name: string
  /** One line for the picker: who it fits. */
  fit: string
  /** Position in the picker. */
  order: number
  /** The days the plan starts from. */
  days: PlanDay[]
}

/** What the picker and the labels need. */
export interface SplitInfo {
  id: SplitId
  name: string
  /** Sessions in one round of the plan. */
  days: number
  fit: string
}

export interface Content {
  library: LibraryRow[]
  splits: SplitTemplate[]
}

export const DEFAULT_SPLIT: SplitId = 'ppl6'

function toInfo(s: SplitTemplate): SplitInfo {
  return { id: s.id, name: s.name, days: s.days.length, fit: s.fit }
}

/** The templates in picker order. */
export function splitInfos(splits: SplitTemplate[]): SplitInfo[] {
  return [...splits].sort((a, b) => a.order - b.order).map(toInfo)
}

/** One template's info; the first in the picker when the id is unknown. */
export function splitInfoOf(splits: SplitTemplate[], id: SplitId): SplitInfo {
  const found = splits.find((s) => s.id === id) ?? [...splits].sort((a, b) => a.order - b.order)[0]
  if (!found) throw new Error('No split templates are loaded')
  return toInfo(found)
}

/** A fresh copy of a template's days, ready to become a plan. */
export function buildSplitFrom(splits: SplitTemplate[], id: SplitId): PlanDay[] {
  const found = splits.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown split "${id}"`)
  return structuredClone(found.days)
}

/** The same days with no lifts in them: a split started empty, for the lifter to fill in on Plan. */
export function emptyDays(days: PlanDay[]): PlanDay[] {
  return days.map((d) => ({ ...d, exercises: [] }))
}

/** The template id behind a plan source, or the default when the plan is custom or unset. */
export function templateOf(source: PlanSource | undefined): SplitId {
  return source && source !== 'custom' ? source : DEFAULT_SPLIT
}

/** What to call the plan: the template's info, or a custom entry sized to the plan. */
export function planSourceInfo(
  splits: SplitTemplate[],
  source: PlanSource | undefined,
  dayCount: number,
): SplitInfo & { custom: boolean } {
  if (source === 'custom') {
    return {
      id: DEFAULT_SPLIT,
      name: 'Custom plan',
      days: dayCount,
      fit: 'Your own days, or your own file.',
      custom: true,
    }
  }
  return { ...splitInfoOf(splits, templateOf(source)), custom: false }
}
