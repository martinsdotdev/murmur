import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/**
 * Diverges from the shadcn registry in five ways, all deliberate:
 *
 * 1. A scalar `value` renders one thumb. The registry falls back to
 *    `[min, max]`, which renders two. Base UI gives both index 0 when the value
 *    is scalar, so they stack invisibly on top of each other, double the tab
 *    stops, and break track press outright: with no thumb pressed the control
 *    resolves the press to the last thumb, index 1, which is out of range, so
 *    it bails before it ever starts a drag.
 * 2. The aria props reach the Thumb, which owns the focusable
 *    `<input type="range">`. On the Root they would name a `role="group"`.
 * 3. The control carries an invisible hit band, since a 4px track and a 16px
 *    thumb are not a touch target.
 * 4. `wheelStep` and `resetValue` add pointer affordances Base UI has no prop
 *    for. Both are opt-in and off by default, so a registry-shaped consumer
 *    behaves exactly as the registry does.
 * 5. Thumbs render one pass after the control. An edge-aligned Thumb keeps its
 *    position with a ResizeObserver it only creates if the Control's ref is
 *    already attached, and on a first mount it never is: a child's layout
 *    effects run before its parent's refs. Without the observer a thumb
 *    measures once, so one mounted hidden (the master volume across a
 *    breakpoint) stays invisible once shown, and every thumb drifts off its
 *    value as the window resizes. Still true in Base UI 1.9.
 * 6. A scroll passes over the control. Base UI sets the value the moment a
 *    finger lands on the track, and the control was touch-none, so a list of
 *    sliders (Now playing, Preferences) could not be scrolled on a phone and
 *    every attempt moved a level. The track is now pan-y and a touch on it
 *    waits: a drag across sets the value, a drag down scrolls. The thumb
 *    still answers at once. A wheel is taken only once the pointer has really
 *    moved onto the control since the page last scrolled.
 */

/**
 * Wheel delta that counts as one notch. Chrome reports 100 to 120 per mouse
 * detent, so one detent is one notch. A trackpad's much smaller deltas
 * accumulate until they reach it.
 */
const WHEEL_NOTCH = 100

/**
 * Firefox reports scrolls in lines rather than pixels, at 3 lines per detent.
 * 40 is the conventional line height for this normalisation, which puts a
 * Firefox detent at 120 and level with Chrome's.
 */
const WHEEL_LINE = 40

/** Page-mode wheels are rare and have no pixel value to read. */
const WHEEL_PAGE = 800

/** One event should never slam the value across the range. */
const MAX_NOTCHES = 5

/**
 * When the page last scrolled under a wheel no slider took. A slider takes the
 * wheel only if the pointer has moved onto it since: a scroll that pauses with
 * the cursor resting on one, or drags one under a cursor held still, carries
 * on scrolling. Pointer events fired as content scrolls under the cursor
 * report no movement, so they don't count as aiming.
 */
let pageWheelAt = 0
let watchingPageWheel = false
function watchPageWheel() {
  if (watchingPageWheel) return
  watchingPageWheel = true
  // Bubble phase, after any slider has had the event and prevented it.
  document.addEventListener(
    "wheel",
    (event) => {
      if (!event.defaultPrevented) pageWheelAt = event.timeStamp
    },
    { passive: true }
  )
}

/** How far a finger on the track moves before it counts as a drag or a scroll. */
const TOUCH_SLOP = 8

const THUMB = '[data-slot="slider-thumb"]'

type SliderProps = Omit<
  SliderPrimitive.Root.Props,
  "onValueChange" | "onValueCommitted"
> &
  Pick<SliderPrimitive.Thumb.Props, "getAriaLabel" | "getAriaValueText"> & {
    /**
     * The second argument is optional so the wheel and double-click paths can
     * call these without manufacturing a Base UI event-details object. Handlers
     * taking fewer arguments stay assignable, so both still pass to Root.
     */
    onValueChange?: (
      value: number | readonly number[],
      eventDetails?: SliderPrimitive.Root.ChangeEventDetails
    ) => void
    onValueCommitted?: (
      value: number | readonly number[],
      eventDetails?: SliderPrimitive.Root.CommitEventDetails
    ) => void
    /** Wheel over the control moves the value this much per notch. */
    wheelStep?: number
    /** Double-click sets this value. */
    resetValue?: number
  }

/** Both affordances need to know the current value, so both are controlled-scalar only. */
const isScalar = (value: unknown): value is number => typeof value === "number"

/** Onto the step grid and inside the range, as Base UI rounds its own values. */
function snap(
  raw: number,
  { min, max, step }: { min: number; max: number; step: number }
) {
  const snapped = step > 0 ? Math.round((raw - min) / step) * step + min : raw
  return Math.min(max, Math.max(min, Number(snapped.toFixed(5))))
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  wheelStep,
  resetValue,
  onValueChange,
  onValueCommitted,
  getAriaLabel,
  getAriaValueText,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-valuetext": ariaValueText,
  ...props
}: SliderProps) {
  const thumbCount = Array.isArray(value)
    ? value.length
    : Array.isArray(defaultValue)
      ? defaultValue.length
      : 1

  const controlRef = React.useRef<HTMLDivElement>(null)
  // Set from a layout effect, so the second pass lands before paint.
  const [controlMounted, setControlMounted] = React.useState(false)
  React.useLayoutEffect(() => setControlMounted(true), [])
  const wheelAcc = React.useRef(0)
  /** When the pointer last really moved over the control. */
  const aimedAt = React.useRef(0)

  // The wheel listener is attached once, so it reads props from here rather
  // than closing over them.
  const live = React.useRef({
    value,
    min,
    max,
    step,
    wheelStep,
    disabled: props.disabled,
    onValueChange,
    onValueCommitted,
  })
  React.useEffect(() => {
    live.current = {
      value,
      min,
      max,
      step,
      wheelStep,
      disabled: props.disabled,
      onValueChange,
      onValueCommitted,
    }
  })

  // Change then commit: the commit is what lets a consumer treat this as a
  // finished interaction rather than a frame of a drag.
  const emit = React.useCallback((next: number) => {
    live.current.onValueChange?.(next)
    live.current.onValueCommitted?.(next)
  }, [])

  React.useEffect(() => {
    const control = controlRef.current
    if (!control) return
    watchPageWheel()

    // Native and non-passive: React registers onWheel passively at the root,
    // and only preventDefault stops whatever scrolls underneath moving at the
    // same time.
    const onWheel = (event: WheelEvent) => {
      const s = live.current
      if (s.wheelStep == null || s.disabled || !isScalar(s.value)) return
      // Not aimed at since the page last scrolled: a scroll passing over.
      if (aimedAt.current <= pageWheelAt) return

      event.preventDefault()

      const unit =
        event.deltaMode === 1
          ? WHEEL_LINE
          : event.deltaMode === 2
            ? WHEEL_PAGE
            : 1
      wheelAcc.current += event.deltaY * unit
      const counted = Math.trunc(wheelAcc.current / WHEEL_NOTCH)
      if (counted === 0) return
      // Cleared rather than carrying the remainder: a 120px detent against a
      // 100px notch would otherwise bank 20 each time and slip in a double
      // step every fifth click of the wheel.
      wheelAcc.current = 0
      const notches = Math.max(-MAX_NOTCHES, Math.min(MAX_NOTCHES, counted))

      // Wheel up reports a negative deltaY and should raise the value.
      const next = snap(s.value - notches * s.wheelStep, s)
      if (next !== s.value) emit(next)
    }

    // Base UI presses the track from its own touchstart listener on the
    // control, which no prop can veto. Stopped one level up, on the way down,
    // for any touch that isn't on the thumb; the pointer path below decides
    // what that touch was.
    const root = control.parentElement
    const onTouchStart = (event: TouchEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(THUMB))
        event.stopPropagation()
    }

    control.addEventListener("wheel", onWheel, { passive: false })
    root?.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    })
    return () => {
      control.removeEventListener("wheel", onWheel)
      root?.removeEventListener("touchstart", onTouchStart, { capture: true })
    }
  }, [emit])

  /**
   * A finger on the track: once it has moved TOUCH_SLOP across, it drags the
   * value from where it is; moved down first, it is a scroll, which pan-y has
   * already handed to the browser, and it lets go.
   */
  const trackTouch = (event: React.PointerEvent) => {
    const control = controlRef.current
    if (!control) return
    const { pointerId, clientX: x0, clientY: y0 } = event
    let dragging = false
    let last: number | null = null

    const valueAt = (x: number) => {
      const s = live.current
      const rect = control.getBoundingClientRect()
      // Edge alignment: the thumb's centre travels inset by half its width.
      const inset =
        (control.querySelector<HTMLElement>(THUMB)?.offsetWidth ?? 0) / 2
      let ratio = (x - rect.left - inset) / Math.max(1, rect.width - 2 * inset)
      if (getComputedStyle(control).direction === "rtl") ratio = 1 - ratio
      ratio = Math.min(1, Math.max(0, ratio))
      return snap(s.min + ratio * (s.max - s.min), s)
    }

    const doc = control.ownerDocument
    const stop = () => {
      doc.removeEventListener("pointermove", onMove)
      doc.removeEventListener("pointerup", onUp)
      doc.removeEventListener("pointercancel", stop)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (!dragging) {
        const dx = Math.abs(e.clientX - x0)
        const dy = Math.abs(e.clientY - y0)
        if (dy > TOUCH_SLOP && dy >= dx) return stop()
        if (dx <= TOUCH_SLOP) return
        dragging = true
      }
      const next = valueAt(e.clientX)
      if (next !== (last ?? live.current.value)) {
        last = next
        live.current.onValueChange?.(next)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      stop()
      if (dragging && last !== null) live.current.onValueCommitted?.(last)
    }
    doc.addEventListener("pointermove", onMove)
    doc.addEventListener("pointerup", onUp)
    doc.addEventListener("pointercancel", stop)
  }

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      // A slider in a bottom sheet is a control, not a handle: a drag that
      // starts on it, or wanders off its axis, must not swipe the sheet away.
      data-base-ui-swipe-ignore=""
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      step={step}
      thumbAlignment="edge"
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <SliderPrimitive.Control
        ref={controlRef}
        onPointerMove={(event) => {
          if (event.movementX || event.movementY)
            aimedAt.current = event.timeStamp
        }}
        onPointerDown={(event) => {
          if (
            event.pointerType !== "touch" ||
            props.disabled ||
            !isScalar(value) ||
            (event.target instanceof Element && event.target.closest(THUMB))
          )
            return
          event.preventBaseUIHandler()
          trackTouch(event)
        }}
        onDoubleClick={() => {
          if (resetValue == null || !isScalar(value)) return
          if (resetValue !== value) emit(resetValue)
        }}
        // The control's own box is only as tall as the 4px track, since the
        // thumb is absolutely positioned. The hit band is a pseudo-element
        // rather than padding: padding would grow the box and every card that
        // measures itself around one, while an absolutely positioned ::before
        // adds no layout box, so getBoundingClientRect and all of Base UI's
        // pointer maths are unchanged, and it still hit-tests as the control.
        // 12px per side is the ceiling, not a preference: it exactly fills a
        // grid card's bottom padding, and anything more would be clipped by the
        // card or reach into the gap below it. On touch the band can grow to a
        // full 44px: the control is pan-y and a track touch waits to see which
        // way it goes (see trackTouch), so a scroll can start anywhere on it.
        className="relative flex w-full touch-pan-y items-center select-none before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] data-dragging:cursor-grabbing pointer-coarse:before:-inset-y-5 data-disabled:opacity-38 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-vertical:before:-inset-x-3 data-vertical:before:inset-y-0"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-track select-none data-horizontal:h-1 data-horizontal:w-full data-horizontal:after:absolute data-horizontal:after:top-1/2 data-horizontal:after:right-0 data-horizontal:after:size-1 data-horizontal:after:-translate-y-1/2 data-horizontal:after:rounded-full data-horizontal:after:bg-outline pointer-coarse:data-horizontal:h-1.5 data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: controlMounted ? thumbCount : 0 }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-valuetext={ariaValueText}
            getAriaLabel={getAriaLabel}
            getAriaValueText={getAriaValueText}
            // Murmur's thumb: a brand-filled circle cut out of the surface it
            // sits on by a 3px border, growing slightly on hover and while held.
            // A finger gets a 24px one, a size it can see past its own tip.
            // touch-none: a finger on the thumb drags at once, never scrolls.
            className="block size-4 shrink-0 cursor-grab touch-none rounded-full border-[3px] border-background bg-primary shadow-sm transition-transform select-none disabled:pointer-events-none disabled:opacity-38 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring data-dragging:ring-4 data-dragging:ring-ring/25 motion-safe:hover:scale-[1.15] motion-safe:data-dragging:scale-[1.15] pointer-coarse:size-6 pointer-coarse:border-4"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
