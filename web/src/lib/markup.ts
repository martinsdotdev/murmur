/**
 * Messages with markup in them: "Watch the {#link}GitHub repo{/link}…" or
 * "Press {#key/} to open this". The translator decides where the tag sits and
 * what it wraps; the page decides what element it becomes.
 */
import type { MessagePart } from "@/paraglide/runtime.js"

/** A message as runs of plain text and tagged text. A self-closing tag is a
 * run with no text of its own. One level deep, as these messages are. */
export type Run = { text: string; tag?: string }

export function runs(parts: MessagePart[]): Run[] {
  const out: Run[] = []
  let open: Run | null = null
  for (const part of parts) {
    if (part.type === "text") {
      if (open) open.text += part.value
      else out.push({ text: part.value })
    } else if (part.type === "markup-start") {
      open = { text: "", tag: part.name }
    } else if (part.type === "markup-end" && open) {
      out.push(open)
      open = null
    } else if (part.type === "markup-standalone") {
      out.push({ text: "", tag: part.name })
    }
  }
  return out
}
