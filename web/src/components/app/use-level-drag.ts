import * as React from "react"

import { followTouch } from "@/lib/touch-drag"

/**
 * More than the 10px a Base UI context menu trigger lets a long press wander,
 * so by the time a drag starts it has always cancelled the card's long press.
 */
const SLOP = 12

/**
 * A short drag can still end in a click on the card it dragged, which comes
 * straight after the release. Timed on event timestamps, so a busy main thread
 * can't stretch it. Only that card's: a finger lifted elsewhere clicks their
 * common ancestor instead, and a tap on another card is a tap.
 */
const CLICK_AFTER_DRAG = 400

/**
 * Touch only: a drag across a sound card sets its level, as a slider would.
 * Relative to where the drag starts, with the card's width as the whole
 * range, so taking hold never jumps the level. Moved down first it is the
 * grid's scroll, held still the card's long press, lifted at once its tap.
 *
 * One hook for every card, since the cards render inside a map: `bind` gives
 * each card its handlers, and only one touch can drag at a time.
 */
export function useLevelDrag(handlers: {
  /** Every step, as a slider's onValueChange. */
  onDrag: (id: string, level: number) => void
  /** The release, as onValueCommitted, and only if the level moved. */
  onCommit: (id: string, level: number) => void
}) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  // A drag's listeners outlive the render that attached them.
  const live = React.useRef(handlers)
  React.useEffect(() => {
    live.current = handlers
  })
  const ended = React.useRef({ id: "", at: -Infinity })

  const bind = (id: string, level: number) => ({
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (event.pointerType !== "touch" || !event.isPrimary) return
      const card = event.currentTarget
      const x0 = event.clientX
      let width = 1
      let dir = 1
      let anchorX = x0
      let anchor = level
      let last = level
      let moved = false
      followTouch(event.nativeEvent, {
        slop: SLOP,
        onStart(e) {
          // Held still long enough to open the card's menu: the press is the
          // menu's now.
          if (card.hasAttribute("data-popup-open")) return false
          // offsetWidth, which the card's press scale doesn't shrink.
          width = Math.max(1, card.offsetWidth)
          dir = getComputedStyle(card).direction === "rtl" ? -1 : 1
          // Measured from the slop's edge: the slop is a dead zone, and
          // nothing past it is lost.
          anchorX = x0 + Math.sign(e.clientX - x0) * SLOP
          setDraggingId(id)
        },
        onMove(e) {
          let next = anchor + (dir * (e.clientX - anchorX)) / width
          // Past either end the overshoot is dropped, so turning back
          // answers at once.
          if (next < 0 || next > 1) {
            next = Math.min(1, Math.max(0, next))
            anchor = next
            anchorX = e.clientX
          }
          // The sliders' 1% step.
          next = Math.round(next * 100) / 100
          if (next === last) return
          last = next
          moved = true
          live.current.onDrag(id, next)
        },
        onEnd(e) {
          ended.current = { id, at: e.timeStamp }
          setDraggingId(null)
          // In pointerup itself, the gesture a browser lets start audio.
          if (moved) live.current.onCommit(id, last)
        },
      })
    },
    onClickCapture(event: React.MouseEvent<HTMLElement>) {
      const last = ended.current
      if (last.id !== id || event.timeStamp - last.at > CLICK_AFTER_DRAG) return
      ended.current = { id: "", at: -Infinity }
      // Capture phase: neither the card's toggle nor its remove button sees it.
      event.stopPropagation()
      event.preventDefault()
    },
  })

  return { draggingId, bind }
}
