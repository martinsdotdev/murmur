/**
 * The landing page and the /app mixer share one theme contract:
 * localStorage['theme'] holds the *preference* ('light' | 'dark' | 'system')
 * and <html data-theme> holds the *resolution* ('light' | 'dark').
 *
 * ThemeBootstrap.astro does the first resolution before paint. A stored
 * 'system' is neither 'light' nor 'dark', so it falls through to its matchMedia
 * branch. This module keeps the two in step afterwards.
 *
 * ThemeToggle.astro on the landing page writes only 'light' or 'dark', so it
 * can override a stored 'system' but cannot restore it. Only Preferences can.
 */

export type ThemeMode = "system" | "light" | "dark"

export const THEME_KEY = "theme"

export function readThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === "light" || v === "dark" || v === "system") return v
  } catch {
    /* Private mode, so follow the OS. */
  }
  return "system"
}

export function writeThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {
    /* The choice holds for this session only. */
  }
}

/**
 * Runs a theme change as a crossfade where the browser has View Transitions,
 * since otherwise every surface changes colour in one frame. The swap runs
 * inside the transition, so the new snapshot is the new theme. It's opacity
 * only, so it stays under reduced motion; without the API it's instant.
 */
export function crossfadeTheme(swap: () => void): void {
  if (typeof document.startViewTransition === "function") {
    document.startViewTransition(swap)
  } else {
    swap()
  }
}

export function applyTheme(mode: ThemeMode): void {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.dataset.theme = dark ? "dark" : "light"
}

/**
 * The app's colour scheme, beside the theme: Amber, or Amber turned round
 * the hue wheel (see scripts/schemes.ts). It sits in data-scheme, which only
 * the app's stylesheet reads, so the landing page keeps Murmur's amber.
 * ThemeBootstrap.astro applies it before paint, as it does the theme.
 */
export const SCHEMES = ["amber", "rose", "sage", "sky", "violet"] as const
export type Scheme = (typeof SCHEMES)[number]

/**
 * Degrees each scheme turns Amber's hues, measured from its accent at about
 * 62°: Rose to about 10°, Sage 145°, Sky 230°, Violet 290°. The generator and
 * the Preferences swatches both read this.
 */
export const SCHEME_TURNS: Record<Exclude<Scheme, "amber">, number> = {
  rose: -52,
  sage: 83,
  sky: 168,
  violet: -132,
}

const SCHEME_KEY = "scheme"
/** "black" or absent: pure black surfaces whenever the theme is dark. */
const NIGHT_KEY = "night"

export function readScheme(): Scheme {
  try {
    const v = localStorage.getItem(SCHEME_KEY)
    if ((SCHEMES as readonly string[]).includes(v ?? "")) return v as Scheme
  } catch {
    /* Private mode, so Amber. */
  }
  return "amber"
}

export function writeScheme(scheme: Scheme): void {
  try {
    if (scheme === "amber") localStorage.removeItem(SCHEME_KEY)
    else localStorage.setItem(SCHEME_KEY, scheme)
  } catch {
    /* The choice holds for this session only. */
  }
}

/** Amber is the absence of the attribute: its tokens are the originals. */
export function applyScheme(scheme: Scheme): void {
  if (scheme === "amber") delete document.documentElement.dataset.scheme
  else document.documentElement.dataset.scheme = scheme
}

export function readBlackNight(): boolean {
  try {
    return localStorage.getItem(NIGHT_KEY) === "black"
  } catch {
    return false
  }
}

export function writeBlackNight(on: boolean): void {
  try {
    if (on) localStorage.setItem(NIGHT_KEY, "black")
    else localStorage.removeItem(NIGHT_KEY)
  } catch {
    /* The choice holds for this session only. */
  }
}

export function applyBlackNight(on: boolean): void {
  if (on) document.documentElement.dataset.night = "black"
  else delete document.documentElement.dataset.night
}
