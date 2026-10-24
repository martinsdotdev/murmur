/** One line, for a wheel that counts in lines rather than pixels. */
const LINE_PX = 16

/**
 * A ref callback for a sideways scroller: a mouse wheel, which only turns up
 * and down, scrolls it across. A trackpad's own sideways swipe, and a zoom,
 * are left to the browser. Only takes the wheel while the scroller can still
 * move that way, so at either end it goes on to whatever is behind.
 *
 * Non-passive, which React's onWheel isn't, so it can keep the wheel.
 */
export function wheelScrollsX(el: HTMLElement | null) {
  if (!el) return
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
      return
    }
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_PX
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? el.clientWidth
          : 1
    // Down goes toward the end, which in a right-to-left strip is leftward.
    const dir = getComputedStyle(el).direction === "rtl" ? -1 : 1
    const before = el.scrollLeft
    el.scrollLeft += dir * event.deltaY * unit
    if (el.scrollLeft !== before) event.preventDefault()
  }
  el.addEventListener("wheel", onWheel, { passive: false })
  return () => el.removeEventListener("wheel", onWheel)
}
