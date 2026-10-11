import type { MouseEvent } from 'react'

/**
 * Makes a whole list row do what its button does, so a thumb does not have to find the button.
 * A tap on a control inside the row (the button itself, a link, a select) is left to that control.
 */
export function rowTap(action: () => void) {
  return {
    onClick: (e: MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, select, [role="combobox"], [role="menuitem"]')) return
      action()
    },
    className: 'cursor-pointer',
  }
}
