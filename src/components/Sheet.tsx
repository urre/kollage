import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { CloseIcon } from './icons'

const EXIT_MS = 200
// Dragged past this, or flicked faster than this, and the sheet goes.
const DISMISS_PX = 96
const DISMISS_SPEED = 0.5 // px per ms
// Upward it is already home, so it barely follows the finger.
const UP_RESIST = 0.2

type Drag = { startY: number; prevY: number; prevAt: number; y: number; at: number; height: number }

type Props = {
  title: string
  onClose: () => void
  /** The X in the header. Off for a question that wants a real answer. */
  closable?: boolean
  /** `close(after)` runs `after` once the sheet is off screen. */
  children: (close: (after?: () => void) => void) => ReactNode
}

// Bottom sheet: scrim, enter/exit, Escape, and a grabber you can drag it away
// by. The drag lives on the header only — the body keeps native scrolling,
// which `touch-action: none` on the whole sheet would have taken away.
export function Sheet({ title, onClose, closable = true, children }: Props) {
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState(0)
  const dragging = useRef<Drag | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const gone = useRef(false)

  // Mount closed, then open on the next frame so the transition has a start.
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = (after?: () => void) => {
    if (gone.current) return
    gone.current = true
    dragging.current = null
    setOpen(false)
    // Dropping the inline transform lets the exit run from wherever the finger
    // left it instead of snapping back to the top first.
    setDrag(0)
    if (scrimRef.current) scrimRef.current.style.opacity = ''
    setTimeout(() => {
      after?.()
      onClose()
    }, EXIT_MS)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    // The close button sits in here; a press on it is a tap, not a drag.
    if ((e.target as HTMLElement).closest('button')) return
    const el = sheetRef.current
    if (!el) return
    // Safari throws here if the pointer is already gone; the drag still works
    // without capture, it just ends early if the finger leaves the grip.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* no capture, carry on */
    }
    const at = performance.now()
    dragging.current = { startY: e.clientY, prevY: e.clientY, prevAt: at, y: e.clientY, at, height: el.offsetHeight }
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragging.current
    if (!d) return
    d.prevY = d.y
    d.prevAt = d.at
    d.y = e.clientY
    d.at = performance.now()
    const dy = d.y - d.startY
    setDrag(dy > 0 ? dy : dy * UP_RESIST)
    // The scrim thins out as the sheet leaves, so the app comes back with it.
    if (scrimRef.current) scrimRef.current.style.opacity = String(Math.max(0, 1 - Math.max(dy, 0) / d.height))
  }

  const onUp = () => {
    const d = dragging.current
    if (!d) return
    dragging.current = null
    const dy = d.y - d.startY
    const speed = (d.y - d.prevY) / Math.max(d.at - d.prevAt, 1)
    if (dy > DISMISS_PX || (dy > 16 && speed > DISMISS_SPEED)) return close()
    setDrag(0)
    if (scrimRef.current) scrimRef.current.style.opacity = ''
  }

  return (
    <div className="sheet-root" data-open={open}>
      <div className="scrim" ref={scrimRef} onClick={() => close()} />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        data-dragging={!!dragging.current}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div className="sheet-grip" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="sheet-grabber" aria-hidden />
          <div className="sheet-head">
            <h2 id="sheet-title">{title}</h2>
            {closable && (
              <button className="icon-btn" onClick={() => close()} aria-label="Stäng">
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
        {children(close)}
      </div>
    </div>
  )
}
