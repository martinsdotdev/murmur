/** How far a finger moves before it counts as a drag across or a scroll. */
export const TOUCH_SLOP = 8

export interface TouchDragHandlers {
  /** Defaults to TOUCH_SLOP. */
  slop?: number
  /** It has moved past the slop across, so it is a drag. False lets it go. */
  onStart?: (event: PointerEvent) => boolean | void
  /** Every move once it is a drag, the one that started it included. */
  onMove: (event: PointerEvent) => void
  /**
   * Lifted, or taken by the browser, which ends the drag where it got to.
   * Only for a touch that became a drag.
   */
  onEnd: (event: PointerEvent) => void
}

/**
 * Follows a touch that landed on a pan-y element. Moved across first, it is a
 * drag; moved down first, it is a scroll, which pan-y has already handed to
 * the browser, and it is let go. Listens on the document, which every move
 * reaches wherever the finger is by then, so it needs no pointer capture.
 */
export function followTouch(
  down: Pick<PointerEvent, "pointerId" | "clientX" | "clientY" | "target">,
  { slop = TOUCH_SLOP, onStart, onMove, onEnd }: TouchDragHandlers
): void {
  const { pointerId, clientX: x0, clientY: y0 } = down
  const doc =
    down.target instanceof Node
      ? (down.target.ownerDocument ?? document)
      : document
  let dragging = false

  const stop = () => {
    doc.removeEventListener("pointermove", move)
    doc.removeEventListener("pointerup", end)
    doc.removeEventListener("pointercancel", end)
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    if (!dragging) {
      const dx = Math.abs(event.clientX - x0)
      const dy = Math.abs(event.clientY - y0)
      if (dy > slop && dy >= dx) return stop()
      if (dx <= slop) return
      if (onStart?.(event) === false) return stop()
      dragging = true
    }
    onMove(event)
  }
  const end = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    stop()
    if (dragging) onEnd(event)
  }

  doc.addEventListener("pointermove", move)
  doc.addEventListener("pointerup", end)
  doc.addEventListener("pointercancel", end)
}
