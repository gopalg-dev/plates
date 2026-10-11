/**
 * Feedback with as little friction as possible: one tap for the mood, one optional line of text,
 * nothing else asked. Always reachable from the account menu; offered once in a while at the end
 * of a session, which is the one moment the app has just done something for the person.
 */

/** Sessions finished before the first prompt: a view from someone who has used the thing. */
export const FEEDBACK_AFTER_SESSIONS = 5
/** Days between prompts, sent or dismissed alike. */
export const FEEDBACK_EVERY_DAYS = 30

export type Mood = 1 | 2 | 3

export const MOODS: { value: Mood; label: string }[] = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'OK' },
  { value: 3, label: 'Good' },
]

export const MOOD_LABEL: Record<Mood, string> = { 1: 'Rough', 2: 'OK', 3: 'Good' }

/** Where the feedback came from: the menu, or the prompt after a session. */
export type FeedbackTrigger = 'menu' | 'summary'

/** Whether to offer the prompt after this session: enough sessions behind them, and not asked lately. */
export function feedbackDue(sessionsDone: number, feedbackAt: string | undefined, now: Date): boolean {
  if (sessionsDone < FEEDBACK_AFTER_SESSIONS) return false
  if (!feedbackAt) return true
  const days = (now.getTime() - new Date(feedbackAt).getTime()) / 86_400_000
  return days >= FEEDBACK_EVERY_DAYS
}
