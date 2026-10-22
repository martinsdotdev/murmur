import * as React from "react"

const QUERY = "(pointer: coarse)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/**
 * Whether the primary pointer is a finger. For what renders, where Tailwind's
 * pointer-coarse: variant only covers how it looks: a control that should not
 * exist on touch has to be left unmounted, not hidden.
 */
export function useCoarsePointer(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches
  )
}
