/**
 * Which language the site speaks. The landing page is built once per locale and
 * takes it from its path. The app reads the visitor's stored choice, else the
 * browser's languages.
 *
 * Paraglide's own localStorage and preferredLanguage strategies are not used:
 * the first getLocale() writes whatever it detected back to storage, which
 * would turn "follow the browser" into a choice nobody made. So Paraglide only
 * holds the locale (globalVariable), and this module decides it.
 */
import {
  baseLocale,
  getLocale,
  locales,
  setLocale,
  toLocale,
  type Locale,
} from "@/paraglide/runtime.js"

/** Each language in its own name, which is how people find theirs in a list. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
  es: "Español",
  ja: "日本語",
}

/** A locale's path segment: none for English, "pt-br" for the rest,
 * lowercase as paths are. */
export function localeSegment(locale: Locale): string | undefined {
  return locale === baseLocale ? undefined : locale.toLowerCase()
}

/** "/" for English, "/pt-br/" for the rest. */
export function localePath(locale: Locale): string {
  const segment = localeSegment(locale)
  return segment ? `/${segment}/` : "/"
}

/** The locale a built page is for, from the first segment of its path. */
export function localeFromPath(pathname: string): Locale {
  return toLocale(pathname.split("/")[1]) ?? baseLocale
}

const STORAGE_KEY = "locale"

/** The language picked in Preferences or the landing page's footer, or null
 * to follow the browser. */
export function readLocaleChoice(): Locale | null {
  try {
    return toLocale(localStorage.getItem(STORAGE_KEY)) ?? null
  } catch {
    return null
  }
}

export function writeLocaleChoice(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Private browsing. The choice holds until the page closes.
  }
}

/** The first of the browser's languages we have: its exact tag, else any
 * locale of the same language, so pt-PT gets pt-BR and es-MX gets es. */
export function browserLocale(
  languages: readonly string[] = navigator.languages
): Locale {
  for (const tag of languages) {
    const language = tag.split("-")[0].toLowerCase()
    const match =
      toLocale(tag) ??
      locales.find((l) => l.split("-")[0].toLowerCase() === language)
    if (match) return match
  }
  return baseLocale
}

/** Points every message at the app's language. Runs before the first render,
 * since messages read the locale when they're called. */
export function startAppLocale() {
  const locale = readLocaleChoice() ?? browserLocale()
  setLocale(locale, { reload: false })
  document.documentElement.lang = locale
}

/** Preferences' Language row. Every string was read in the old language, so
 * a change of language reloads; the mix comes back, paused. */
export function chooseLocale(locale: Locale) {
  writeLocaleChoice(locale)
  if (locale !== getLocale()) location.reload()
}

type Message = (inputs: object, options: { locale: Locale }) => string

/** Whether text is what a message says in any language. For names the app
 * writes itself and stores, such as "New mix", which a later visit in another
 * language should still recognise as its own. */
export function fromAnyLocale(message: Message, text: string) {
  return locales.some((locale) => message({}, { locale }) === text)
}
