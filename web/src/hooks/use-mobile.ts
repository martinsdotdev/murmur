import * as React from "react"

/** The negation of tailwind.css's `wide` variant: the phone shell. */
const PHONE_SHELL =
  "not all and (width >= 48rem) and (not ((pointer: coarse) and (height < 30rem)))"

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(PHONE_SHELL)
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
