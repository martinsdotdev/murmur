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
 * A wheel arriving sooner than this after the pointer entered is a scroll
 * passing over the control, not an aim at it. Scrolling a list under a
 * stationary cursor re-fires pointerenter for every slider dragged past it,
 * and each one arrives with a fresh timestamp.
 */
const WHEEL_SETTLE_MS = 120

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
  const enteredAt = React.useRef(0)

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

    // Native and non-passive: React registers onWheel passively at the root,
    // and only preventDefault stops whatever scrolls underneath moving at the
    // same time.
    const onWheel = (event: WheelEvent) => {
      const s = live.current
      if (s.wheelStep == null || s.disabled || !isScalar(s.value)) return
      if (event.timeStamp - enteredAt.current < WHEEL_SETTLE_MS) return

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
      const raw = s.value - notches * s.wheelStep
      const snapped =
        s.step > 0 ? Math.round((raw - s.min) / s.step) * s.step + s.min : raw
      const next = Math.min(
        s.max,
        Math.max(s.min, Number(snapped.toFixed(5)))
      )
      if (next !== s.value) emit(next)
    }

    control.addEventListener("wheel", onWheel, { passive: false })
    return () => control.removeEventListener("wheel", onWheel)
  }, [emit])

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
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
        onPointerEnter={(event) => {
          enteredAt.current = event.timeStamp
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
        // card or reach into the gap below it. The control is also touch-none
        // and Base UI takes a track press on touchstart, so every pixel here is
        // a pixel a phone cannot start a scroll from.
        className="relative flex w-full touch-none items-center select-none before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] data-disabled:opacity-50 data-dragging:cursor-grabbing data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-vertical:before:inset-y-0 data-vertical:before:-inset-x-3"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-track select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
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
            className="block size-4 shrink-0 cursor-grab rounded-full border-[3px] border-background bg-primary shadow-sm transition-transform select-none hover:scale-[1.15] focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-dragging:scale-[1.15] data-dragging:ring-4 data-dragging:ring-ring/25"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
