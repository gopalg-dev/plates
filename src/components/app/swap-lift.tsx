import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Item, ItemActions, ItemContent, ItemGroup, ItemSeparator, ItemTitle } from '#/components/ui/item'
import { Label } from '#/components/ui/label'
import { nameKey } from '#/lib/library'
import { rowTap } from '#/lib/row-tap'
import type { WorkoutEntry } from '#/lib/types'
import { cn } from '#/lib/utils'
import { EditorPanel } from './editor-panel'
import { LibraryList } from './library-list'

/*
 * The swap panel of a running session: the machine is taken, so another lift takes this one's place today. The
 * plan line's alternates come first, then the whole library to search; a tick puts the swap on the plan as well.
 */

interface Props {
  /** The lift being swapped. Null closes the panel. */
  entry: WorkoutEntry | null
  /** The plan line's alternates, the lift's own name left out. */
  alternates: string[]
  /** The lift is on the plan day: the swap can go there too. */
  onPlan: boolean
  busy: boolean
  onClose: () => void
  onPick: (name: string, alsoPlan: boolean) => void
}

export function SwapLiftPanel({ entry, alternates, onPlan, busy, onClose, onPick }: Props) {
  const [alsoPlan, setAlsoPlan] = useState(false)
  const ticked = entry?.sets.filter((s) => s.done).length ?? 0
  /** The tick is for this swap only. */
  const close = () => {
    setAlsoPlan(false)
    onClose()
  }
  const pick = (name: string) => {
    if (busy || !entry) return
    // The lift it has already: nothing to swap.
    if (nameKey(name) === nameKey(entry.name)) return close()
    onPick(name, alsoPlan && onPlan)
    setAlsoPlan(false)
  }
  return (
    <EditorPanel
      open={entry !== null}
      onClose={close}
      title={entry ? `Swap ${entry.name}` : ''}
      description={ticked > 0 && entry ? `${ticked} ${ticked === 1 ? 'set' : 'sets'} done stay as ${entry.name}.` : ''}
    >
      <div className="flex flex-col gap-5 px-4 pb-4">
        {onPlan && (
          <Label className="flex cursor-pointer items-center gap-3 text-base font-normal">
            <Checkbox checked={alsoPlan} onCheckedChange={(c) => setAlsoPlan(c === true)} className="size-5" />
            Also on the plan
          </Label>
        )}
        {alternates.length > 0 && (
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Alternates</p>
            <ItemGroup className="border-y">
              {alternates.map((alt, i) => (
                <div key={alt}>
                  {i > 0 && <ItemSeparator />}
                  <Item
                    size="sm"
                    className={cn('px-1', rowTap(() => pick(alt)).className)}
                    onClick={rowTap(() => pick(alt)).onClick}
                  >
                    <ItemContent>
                      <ItemTitle>{alt}</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label={`Use ${alt}`}
                        disabled={busy}
                        onClick={() => pick(alt)}
                      >
                        Use
                      </Button>
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          </div>
        )}
        <LibraryList action="Use" stickySearch onSelect={(ex) => pick(ex.name)} />
      </div>
    </EditorPanel>
  )
}
