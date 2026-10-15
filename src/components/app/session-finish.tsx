import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { EFFORT_LABEL, EFFORTS, type Effort } from '#/lib/logic/effort'
import type { Mood } from '#/lib/logic/feedback'
import type { SessionSummary } from '#/lib/logic/summary'
import { cn } from '#/lib/utils'
import { dismissFeedbackFn } from '#/server/fns'
import { FeedbackFields, useSendFeedback } from './feedback-form'

/*
 * Finishing a session, shared by Today and the demo on How it works: the check-in that asks how it went, and the
 * summary that says what it did.
 */

interface CheckInProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  /** Sets in the session, and how many of them are not ticked: those are left out, so the dialog says so. */
  total: number
  unticked: number
  onFinish: (extra: { effort?: number; note?: string }) => void
}

/**
 * How the session felt, asked at Finish. With sets left unticked it says they will not count and offers to keep
 * going instead of skipping the question; with every set ticked it only asks.
 */
export function FinishCheckIn({ open, onOpenChange, busy, total, unticked, onFinish }: CheckInProps) {
  const [effort, setEffort] = useState<Effort | undefined>(undefined)
  const [note, setNote] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How did it go?</DialogTitle>
          <DialogDescription className={cn(unticked === 0 && 'sr-only')}>
            {unticked > 0
              ? `${unticked} of ${total} ${total === 1 ? 'set is' : 'sets are'} not ticked. They won't count.`
              : 'Pick how hard it felt.'}
          </DialogDescription>
        </DialogHeader>
        <ToggleGroup
          type="single"
          variant="outline"
          value={effort ? String(effort) : ''}
          onValueChange={(v) => setEffort(v ? (Number(v) as Effort) : undefined)}
          className="w-full"
          aria-label="Effort"
        >
          {EFFORTS.map((e) => (
            <ToggleGroupItem key={e} value={String(e)} className="h-12 flex-1">
              {EFFORT_LABEL[e]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything to remember? Optional"
          aria-label="Session note"
          maxLength={200}
        />
        <DialogFooter>
          {unticked > 0 ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Keep going
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onFinish({})} disabled={busy}>
              Skip
            </Button>
          )}
          <Button onClick={() => onFinish({ effort, note: note.trim() || undefined })} disabled={busy}>
            Save and finish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Asked before a session is thrown away: from its menu, or at Finish with nothing ticked. */
export function DiscardDialog({
  open,
  onOpenChange,
  doneSets,
  busy,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  doneSets: number
  busy: boolean
  onDiscard: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard this workout?</DialogTitle>
          <DialogDescription>
            {doneSets > 0
              ? `The ${doneSets} ${doneSets === 1 ? 'set' : 'sets'} logged so far will be lost.`
              : 'Nothing is logged yet, so nothing is lost.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep going
          </Button>
          <Button variant="destructive" onClick={onDiscard} disabled={busy}>
            Discard workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** What the session did, shown once at Finish: every lift's best set, new bests marked, the week's count. */
export function SummaryDialog({
  summary,
  askFeedback,
  onClose,
}: {
  summary: SessionSummary | null
  askFeedback: boolean
  onClose: () => void
}) {
  const [mood, setMood] = useState<Mood | null>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const { send, busy } = useSendFeedback('summary')
  const asking = askFeedback && !sent

  async function close() {
    // Waving the prompt away counts: the next one waits a month.
    if (asking) void dismissFeedbackFn().catch(() => undefined)
    onClose()
    setMood(null)
    setText('')
    setSent(false)
  }

  async function sendNow() {
    if (await send(mood, text)) setSent(true)
  }

  return (
    <Dialog open={summary !== null} onOpenChange={(open) => !open && void close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workout saved</DialogTitle>
          <DialogDescription>
            {summary ? `${summary.week.done} of ${summary.week.planned} sessions this week.` : ''}
          </DialogDescription>
        </DialogHeader>
        {summary && (
          <ul className="divide-y">
            {summary.lines.map((l) => (
              <li key={l.exerciseId} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="shrink-0 tabular-nums">{l.best}</span>
                {l.pr ? (
                  <span className="flex shrink-0 items-center gap-1 text-success">
                    <Trophy className="size-4" aria-hidden />
                    <span className="sr-only">New</span>
                    best
                  </span>
                ) : l.change ? (
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      l.change.startsWith('+') ? 'text-success' : 'text-muted-foreground',
                    )}
                  >
                    {l.change}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {asking && (
          <div className="border-t pt-4">
            <p className="mb-2 font-medium">How is Plates for you?</p>
            <FeedbackFields mood={mood} text={text} onMood={setMood} onText={setText} compact />
          </div>
        )}
        <DialogFooter>
          {asking && (
            <Button variant="outline" onClick={sendNow} disabled={busy || (mood === null && !text.trim())}>
              Send
            </Button>
          )}
          <Button onClick={close}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
