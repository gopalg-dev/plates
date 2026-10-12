import { createContext, type ReactNode, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '#/components/ui/drawer'
import { useMediaQuery } from '#/lib/use-media-query'
import { useVisibleViewport } from '#/lib/use-visible-viewport'

interface Props {
  open: boolean
  onClose: () => void
  title: ReactNode
  description: ReactNode
  children: ReactNode
  /** Width of the dialog on tablets and desktops. */
  width?: 'md' | 'lg'
}

/** The footer element of the open panel, for `PanelFooter` to render into. */
const FooterSlot = createContext<HTMLDivElement | null>(null)

/**
 * The editing surface: a bottom Drawer on phones, a centred Dialog from 768px up. The header and the
 * footer stay put; only the content between them scrolls. Content puts its action row in `PanelFooter`.
 */
export function EditorPanel({ open, onClose, title, description, children, width = 'md' }: Props) {
  const wide = useMediaQuery('(min-width: 768px)')
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const visible = useVisibleViewport(open && !wide)
  if (wide) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className={
            width === 'lg'
              ? 'flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl'
              : 'flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-md'
          }
        >
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-2 pb-4">
            <FooterSlot.Provider value={slot}>{children}</FooterSlot.Provider>
          </div>
          <div ref={setSlot} className="flex shrink-0 flex-wrap items-center gap-2 border-t p-4 empty:hidden" />
        </DialogContent>
      </Dialog>
    )
  }
  // With the keyboard up, the drawer sits on top of it and fits the space left, so the whole form and
  // the footer still scroll into view. A swipe then only scrolls: it never drags the drawer shut mid-typing.
  // vaul's own keyboard handling (repositionInputs) moves the drawer in ways that fight this, so it is off.
  const keyboard = visible !== null && (visible.keyboard || visible.bottom > 80)
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} repositionInputs={false} dismissible={!keyboard}>
      <DrawerContent
        className="max-h-[92dvh]"
        data-keyboard={keyboard || undefined}
        style={keyboard ? { bottom: visible.bottom, maxHeight: Math.round(visible.height * 0.92) } : undefined}
      >
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <FooterSlot.Provider value={slot}>{children}</FooterSlot.Provider>
        </div>
        <div
          ref={setSlot}
          className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] empty:hidden group-data-[keyboard]/drawer-content:pb-3"
        />
      </DrawerContent>
    </Drawer>
  )
}

/** The panel's action row. Rendered into the fixed footer, so it stays in view while the content scrolls. */
export function PanelFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlot)
  return slot ? createPortal(children, slot) : null
}
