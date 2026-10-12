/**
 * The value, or an error that names what was missing. For a value the code knows is there but TypeScript cannot
 * see, in place of a `!` assertion: if the assumption is ever wrong, the error says which one.
 */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${what}`)
  return value
}
