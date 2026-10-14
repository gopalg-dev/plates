import { BatteryFull, Signal, Wifi } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Iphone } from '#/components/ui/iphone'
import { cn } from '#/lib/utils'
import type { DemoScreenName } from './guide-demos'

/*
 * A phone on How it works running the app's own screens. The page draws the frame (`DemoPhone`); inside it, a
 * window the size of a phone shows `/demo/<screen>` (src/routes/demo.$screen.tsx), which draws the phone's screen
 * (`PhoneScreen`). A window of its own, so every breakpoint in the app's components, shadcn's included, sees a 393px
 * phone and not the page's width.
 */

/**
 * A phone frame's shadow, here and on the guide's screenshots (`Shot`): a soft drop, and a hairline of light in dark,
 * where a dark frame would lose its edge.
 */
export const PHONE_SHADOW = 'drop-shadow-xl dark:drop-shadow-[0_0_1px_rgb(255_255_255/0.4)]'

// Where the screen sits in Magic UI's iPhone frame (src/components/ui/iphone.tsx), in the frame's own units.
const FRAME = { width: 433, height: 882 }
const SCREEN = { x: 21.25, y: 19.25, width: 389.5, height: 843.5, radius: 55.75 }
/** The window inside, at an iPhone 15 Pro's size in CSS pixels, scaled down to the screen it is drawn on. */
const APP = { width: 393, height: 852 }
/** A clear pixel: given as the frame's picture, it makes the frame cut its screen open over the window beneath. */
const CLEAR = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const pct = (part: number, whole: number) => `${(part / whole) * 100}%`

/**
 * The iPhone frame over a phone-sized window running one demo screen, scaled to the frame's width, which the caller
 * sets. The frame lets
 * taps through. The window opens once the browser knows the screen's size, so it never shows at the wrong scale,
 * and only when it nears the view.
 */
export function DemoPhone({ screen, label, className }: { screen: DemoScreenName; label: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / APP.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    // Never stretched by a row or grid around it: the screen is placed in percentages of this box, which must stay
    // the frame's own shape.
    <div className={cn('relative mt-6 shrink-0 self-start', PHONE_SHADOW, className)}>
      <div
        ref={box}
        className="absolute overflow-hidden bg-background"
        style={{
          left: pct(SCREEN.x, FRAME.width),
          top: pct(SCREEN.y, FRAME.height),
          width: pct(SCREEN.width, FRAME.width),
          height: pct(SCREEN.height, FRAME.height),
          borderRadius: `${pct(SCREEN.radius, SCREEN.width)} / ${pct(SCREEN.radius, SCREEN.height)}`,
        }}
      >
        {scale !== null && (
          <iframe
            src={`/demo/${screen}`}
            title={label}
            loading="lazy"
            width={APP.width}
            height={APP.height}
            className="block origin-top-left border-0"
            style={{ transform: `scale(${scale})` }}
          />
        )}
      </div>
      <Iphone src={CLEAR} className="pointer-events-none" />
    </div>
  )
}

/** A phone's screen inside the demo window: the status bar, the app scrolling between, and the home bar. */
export function PhoneScreen({ children }: { children: ReactNode }) {
  return (
    // No page colour of its own: the body's, and the look's backdrop behind it, show through.
    <div className="flex h-dvh flex-col">
      <div aria-hidden className="flex h-[54px] shrink-0 items-center justify-between pt-1.5 pr-7 pl-12">
        <span className="text-[17px] font-semibold">9:41</span>
        <span className="flex items-center gap-1.5">
          <Signal className="size-[18px]" strokeWidth={2.5} />
          <Wifi className="size-[18px]" strokeWidth={2.5} />
          <BatteryFull className="size-6" />
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none">{children}</div>
      <div aria-hidden className="flex h-[34px] shrink-0 items-end justify-center pb-2">
        <span className="h-[5px] w-[139px] rounded-full bg-foreground" />
      </div>
    </div>
  )
}
