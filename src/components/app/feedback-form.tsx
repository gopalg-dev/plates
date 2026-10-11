import { useLocation } from '@tanstack/react-router'
import { Frown, Meh, Smile } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Textarea } from '#/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { errorMessage } from '#/lib/format'
import { MOODS, type FeedbackTrigger, type Mood } from '#/lib/logic/feedback'
import { sendFeedbackFn } from '#/server/fns'
import { cn } from '#/lib/utils'

const ICON = { 1: Frown, 2: Meh, 3: Smile } as const

/** One tap for the mood, one optional line. Nothing else is asked. */
export function FeedbackFields({
  mood,
  text,
  onMood,
  onText,
  compact,
}: {
  mood: Mood | null
  text: string
  onMood: (m: Mood | null) => void
  onText: (t: string) => void
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-3', compact && 'gap-2')}>
      <ToggleGroup
        type="single"
        variant="outline"
        value={mood ? String(mood) : ''}
        onValueChange={(v) => onMood(v ? (Number(v) as Mood) : null)}
        className="w-full"
        aria-label="How is Plates for you?"
      >
        {MOODS.map((m) => {
          const Icon = ICON[m.value]
          return (
            <ToggleGroupItem
              key={m.value}
              value={String(m.value)}
              className={cn('flex-1 gap-2', compact ? 'h-10' : 'h-12')}
            >
              <Icon aria-hidden />
              {m.label}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <Textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Anything to add? Optional"
        aria-label="Feedback"
        maxLength={1000}
        rows={compact ? 2 : 3}
      />
    </div>
  )
}

/** Sends what was filled in; the route says which screen it came from. */
export function useSendFeedback(trigger: FeedbackTrigger) {
  const { pathname } = useLocation()
  const [busy, setBusy] = useState(false)
  async function send(mood: Mood | null, text: string): Promise<boolean> {
    setBusy(true)
    try {
      await sendFeedbackFn({ data: { mood: mood ?? undefined, text: text.trim(), route: pathname, trigger } })
      toast.success('Thanks, noted.')
      return true
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send that.'))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { send, busy }
}

/** The dialog behind "Send feedback" in the account menu. */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mood, setMood] = useState<Mood | null>(null)
  const [text, setText] = useState('')
  const { send, busy } = useSendFeedback('menu')
  const ready = mood !== null || text.trim().length > 0

  async function submit() {
    if (!ready) return
    if (await send(mood, text)) {
      setMood(null)
      setText('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>How is Plates for you?</DialogTitle>
            <DialogDescription className="sr-only">Pick a face, add a line if you like, send.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <FeedbackFields mood={mood} text={text} onMood={setMood} onText={setText} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || busy}>
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
