let issued = 0

/**
 * An id no other element in the build shares, for markup a page can repeat,
 * such as a gradient inside an inline SVG. Module state, so it outlives one
 * component's render.
 */
export function uniqueId(prefix: string): string {
  return `${prefix}-${++issued}`
}
