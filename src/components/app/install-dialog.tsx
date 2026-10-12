import { Feather, RefreshCw, Share, Smartphone, UserRound } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { type InstallWay, useInstallApp } from '#/lib/install-app'

const FACTS: { icon: typeof Smartphone; text: string }[] = [
  { icon: Smartphone, text: 'Its own icon on your home screen or desktop, opening in its own window like an app.' },
  { icon: Feather, text: 'No app store and next to no space: it is this website, kept on your device.' },
  { icon: RefreshCw, text: 'Nothing to update. It is always the latest Plates.' },
  { icon: UserRound, text: 'Same account and data as in the browser.' },
]

/**
 * What installing Plates means, then the way to do it here: the browser's install dialog, or the
 * Share sheet steps on iPhone and iPad.
 */
export function InstallDialog({ open, way, onClose }: { open: boolean; way: InstallWay; onClose: () => void }) {
  const { prompt } = useInstallApp()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install Plates</DialogTitle>
          <DialogDescription className="sr-only">What installing means, and how.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {FACTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        {way === 'ios' && (
          <ol className="list-decimal space-y-1 rounded-lg bg-muted py-3 pr-4 pl-9">
            <li>
              Tap <Share aria-label="Share" className="inline size-4 -translate-y-0.5" /> Share in the browser bar.
            </li>
            <li>Choose Add to Home Screen.</li>
          </ol>
        )}
        <DialogFooter>
          {way === 'prompt' ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Not now
              </Button>
              <Button
                onClick={async () => {
                  await prompt()
                  onClose()
                }}
              >
                Install
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
