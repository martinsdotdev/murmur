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
