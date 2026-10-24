/**
 * Every number, time, list and language name the app shows, in its language.
 *
 * The language can't change without a reload (see chooseLocale), so each Intl
 * formatter is built once, on first use, which is after startAppLocale() has
 * settled the language. Nothing here runs at module load.
 */
import { m } from "@/paraglide/messages.js"
import { getLocale, type Locale } from "@/paraglide/runtime.js"

/** The app's language with the browser's region where the two agree, so
 * en-GB keeps its 24-hour clock under English. */
function formatLocale(): string {
  const locale = getLocale()
  const language = locale.split("-")[0].toLowerCase()
  return (
    navigator.languages.find(
      (tag) => tag.split("-")[0].toLowerCase() === language
    ) ?? locale
  )
}

const numberFormats = new Map<string, Intl.NumberFormat>()
function numberFormat(options: Intl.NumberFormatOptions) {
  const key = JSON.stringify(options)
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(formatLocale(), options)
    numberFormats.set(key, format)
  }
  return format
}

let clock: Intl.DateTimeFormat | undefined
let list: Intl.ListFormat | undefined
let languages: Intl.DisplayNames | undefined

/** A countdown: "9:05", and from an hour "1:04:59" rather than "64:59". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.ceil(totalSeconds)
  const pad = (n: number) => String(n).padStart(2, "0")
  const h = Math.floor(s / 3600)
  const min = Math.floor(s / 60) % 60
  return h ? `${h}:${pad(min)}:${pad(s % 60)}` : `${min}:${pad(s % 60)}`
}

/** The wall clock at a moment, for "Stops at": "21:30", or "9:30 PM". */
export function formatTime(ms: number): string {
  clock ??= new Intl.DateTimeFormat(formatLocale(), {
    hour: "numeric",
    minute: "2-digit",
  })
  return clock.format(ms)
}

/** A timer length as people say it: "45 min", "1 h", "1 h 15 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return m.duration_minutes({ minutes: rest })
  return rest
    ? m.duration_hours_minutes({ hours, minutes: rest })
    : m.duration_hours({ hours })
}

/** A timer preset as a chip can hold it: "45 min", "1 h", "1½ h". */
export function formatPreset(minutes: number): string {
  return minutes === 90 ? m.duration_hour_and_half() : formatDuration(minutes)
}

/** A short time as Preferences shows it: "1.5s", "30s". */
export function formatSeconds(seconds: number, digits: number): string {
  return numberFormat({
    style: "unit",
    unit: "second",
    unitDisplay: "narrow",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(seconds)
}

/** A level as a screen reader says it: "70%", or "70 %" in Spanish. */
export function formatPercent(pct: number): string {
  return numberFormat({ style: "percent" }).format(pct / 100)
}

/** A file size: "18 MB", one decimal under 10 MB ("2.4 MB"), kB below 1 MB. */
export function formatBytes(bytes: number): string {
  const kb = bytes < 1e6
  const value = kb ? Math.max(1, bytes / 1e3) : bytes / 1e6
  return numberFormat({
    style: "unit",
    unit: kb ? "kilobyte" : "megabyte",
    maximumFractionDigits: !kb && value < 10 ? 1 : 0,
  }).format(value)
}

/** "Rain, Fireplace and Birds", joined as the language joins a list. */
export function formatList(items: string[]): string {
  list ??= new Intl.ListFormat(formatLocale(), { type: "conjunction" })
  return list.format(items)
}

/** A language's name in the app's language, capitalised as a list item is:
 * Portuguese and Spanish write them in lower case. */
export function formatLanguage(locale: Locale): string {
  const current = getLocale()
  languages ??= new Intl.DisplayNames([current], {
    type: "language",
    languageDisplay: "standard",
  })
  const name = languages.of(locale) ?? locale
  return name.charAt(0).toLocaleUpperCase(current) + name.slice(1)
}
