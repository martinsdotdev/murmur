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
