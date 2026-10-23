/**
 * User-supplied names: mix names, file names, YouTube titles, names arriving in
 * a shared link. Handled as graphemes, so a flag, a family emoji or an accent
 * built from combining marks is never cut in half.
 */

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null

export function graphemes(text: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(text), (s) => s.segment)
    : Array.from(text)
}

/** At most `max` graphemes, trimmed. */
export function clampName(text: string, max: number): string {
  const chars = graphemes(text.trim())
  return chars.length > max
    ? chars.slice(0, max).join("").trim()
    : chars.join("")
}

/**
 * A name set inside a sentence of UI text, isolated from it (U+2068 FIRST
 * STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE), so a right-to-left name
 * takes its own direction without reordering the quotes and punctuation
 * around it.
 */
export function isolate(name: string): string {
  return `⁨${name}⁩`
}

/**
 * A sound's name from a file name or a link's path: the last segment, decoded,
 * without its extension, its separators as spaces and its first letter raised,
 * so "ocean-waves_at-dawn.mp3" reads "Ocean waves at dawn". The rest keeps its
 * case, so "NYC traffic" survives. Empty when there is no file name to read.
 */
export function nameFromFile(path: string): string {
  let last = path.split("/").filter(Boolean).at(-1) ?? ""
  try {
    last = decodeURIComponent(last)
  } catch {
    /* A stray % stays as it is. */
  }
  const words = last
    .replace(/\.[^.]+$/, "")
    .replace(/[-_.\s]+/g, " ")
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
