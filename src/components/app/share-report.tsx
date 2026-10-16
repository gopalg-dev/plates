import { Download, Share2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { ScrollArea, ScrollBar } from '#/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { saveBlob } from '#/lib/download'
import { errorMessage } from '#/lib/format'
import type { Period, PeriodDay, Report } from '#/lib/logic/report'
import { highlights, shareCardContent, shareCardFileName } from '#/lib/logic/share-card'
import { type CardTheme, cardThemes, currentCardTheme, drawShareCard } from '#/lib/share-card-draw'
import type { Units } from '#/lib/types'

/*
 * The report's share dialog, opened from the menu beside the title: the card drawn in every look, the one on screen
 * first, a tick to add bodyweight, and the ways out: the device's share sheet where files can be shared, and a
 * download anywhere.
 */

interface Card {
  blob: Blob
  url: string
}

export function ShareReportDialog({
  open,
  onOpenChange,
  report,
  period,
  days,
  units,
  name,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: Report
  period: Period
  days: PeriodDay[]
  units: Units
  /** Whose report it is, for the card. */
  name: string
}) {
  const [withWeight, setWithWeight] = useState(false)
  // What the card tells, the lifter's pick; the first on offer until picked, or when the pick is not on offer.
  const options = useMemo(() => highlights(report, period, units), [report, period, units])
  const [highlight, setHighlight] = useState<string>()
  const chosen = options.some((h) => h.id === highlight) ? highlight : options[0].id
  const [themes, setThemes] = useState<CardTheme[]>([])
  const [picked, setPicked] = useState('')
  const [cards, setCards] = useState<Record<string, Card>>({})
  // The cards on screen, so a new set (or the close) can let go of the images behind the old one.
  const held = useRef<Record<string, Card>>({})
  const unit = period.kind === 'week' ? 'week' : 'month'
  const fileName = shareCardFileName(period)

  const showCards = useCallback((next: Record<string, Card>) => {
    for (const c of Object.values(held.current)) URL.revokeObjectURL(c.url)
    held.current = next
    setCards(next)
  }, [])

  // Every look's card, drawn when the dialog opens and again when bodyweight is ticked; the picked one shows.
  useEffect(() => {
    if (!open) {
      showCards({})
      return
    }
    let gone = false
    const looks = cardThemes()
    setThemes(looks)
    setPicked((p) => p || currentCardTheme())
    const content = shareCardContent(report, period, days, units, name, { bodyweight: withWeight, highlight: chosen })
    Promise.all(looks.map((look) => drawShareCard(content, period.kind, look).then((blob) => [look.id, blob] as const)))
      .then((drawn) => {
        if (gone) return
        showCards(Object.fromEntries(drawn.map(([id, blob]) => [id, { blob, url: URL.createObjectURL(blob) }])))
      })
      .catch((err) => toast.error(errorMessage(err, 'Could not draw the card.')))
    return () => {
      gone = true
    }
  }, [open, withWeight, chosen, report, period, days, units, name, showCards])

  const card = cards[picked]
  const file = card ? new File([card.blob], fileName, { type: 'image/png' }) : null
  const canShare = file !== null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: `Plates, ${unit} in review` })
    } catch (err) {
      // Closing the sheet is a choice, not a failure.
      if (!(err instanceof Error && err.name === 'AbortError')) toast.error(errorMessage(err, 'Could not share.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Taller than a short window, so it scrolls inside instead of losing its title and footer. */}
      {/*
       * A share sheet: the card on the left at a fixed width, the choices as a form on the right, the buttons at the
       * foot of that column, level with the card's bottom edge. On a phone the two stack, the sheet takes the screen's
       * height (a set height, so the card's cap below can resolve) and the card gives up height before anything
       * scrolls; should it still not fit, the sheet scrolls inside instead of losing its title and footer.
       */}
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto max-sm:h-[calc(100dvh-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share this {unit}</DialogTitle>
          <DialogDescription className="sr-only">
            The {unit}'s highlights as an image, in a look of your choice.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 sm:grid sm:grid-cols-[20rem_1fr]">
          {/* On a phone the card takes the height the choices leave, at its own 4:5, so the whole sheet is in view. */}
          <div className="min-h-0 flex-1 text-center sm:aspect-[4/5] sm:w-full sm:text-left">
            {card ? (
              <img
                src={card.url}
                alt={`${unit} in review card`}
                className="inline-block max-h-full max-w-full rounded-lg border object-contain sm:size-full sm:object-cover"
              />
            ) : (
              <div className="mx-auto aspect-[4/5] h-full max-w-full rounded-lg border bg-muted sm:mx-0 sm:size-full" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid gap-2">
              <Label id="share-look">Look</Label>
              {/* One swatch per look: its card colour ringed in its accent, so Lime reads lime and Fire orange, read
                  live from the stylesheet with the card's own tokens. One line that scrolls sideways past the sheet's
                  edges, as the library's tag rows do; the picked one's name under it. min-w-0: a grid item would
                  otherwise grow to the line's full width and push the sheet wide. */}
              <ScrollArea className="-mx-6 min-w-0">
                <ToggleGroup
                  type="single"
                  size="sm"
                  spacing={2}
                  value={picked}
                  onValueChange={(v) => v && setPicked(v)}
                  aria-labelledby="share-look"
                  className="w-max px-6 py-0.5"
                >
                  {themes.map((look) => (
                    <ToggleGroupItem
                      key={look.id}
                      value={look.id}
                      aria-label={look.label}
                      className="size-9 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-ring"
                    >
                      <span
                        aria-hidden
                        className="size-6 rounded-full border-[3px]"
                        style={{ background: look.tokens['--card'], borderColor: look.tokens['--primary'] }}
                      />
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <ScrollBar orientation="horizontal" className="mx-6 h-2" />
              </ScrollArea>
              <span className="text-muted-foreground">{themes.find((l) => l.id === picked)?.label}</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="share-highlight">Highlight</Label>
              <Select value={chosen} onValueChange={setHighlight}>
                <SelectTrigger id="share-highlight" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {report.bodyweight && (
              <Label className="flex cursor-pointer items-center gap-3 font-normal">
                <Checkbox checked={withWeight} onCheckedChange={(c) => setWithWeight(c === true)} className="size-5" />
                Bodyweight on the card
              </Label>
            )}
            <DialogFooter className="mt-auto gap-2 sm:gap-2">
              <Button variant="outline" disabled={!card} onClick={() => card && saveBlob(card.blob, fileName)}>
                <Download aria-hidden />
                Save image
              </Button>
              {canShare && (
                <Button onClick={() => void share()}>
                  <Share2 aria-hidden />
                  Share…
                </Button>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
