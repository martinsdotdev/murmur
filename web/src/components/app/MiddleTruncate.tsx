import { cn } from "@/lib/utils"
import { graphemes } from "@/lib/text"

/**
 * A name cut in the middle rather than at the end, so names that differ only
 * at the end ("… copy", "… copy 2") stay distinguishable. The head takes
 * the ellipsis; the tail gives way only when nothing of the head is left. dir="auto" lays a right-to-left name
 * out in its own direction, so it keeps its own beginning and end. The full
 * name is always one hover away in the title.
 */
export function MiddleTruncate({
  text,
  tail = 9,
  className,
}: {
  text: string
  /** Graphemes kept whole at the end. */
  tail?: number
  className?: string
}) {
  const chars = graphemes(text)
  // Short enough that cutting would save less than it hides.
  if (chars.length <= tail * 2) {
    return (
      <span
        dir="auto"
        title={text}
        className={cn("block min-w-0 truncate", className)}
      >
        {text}
      </span>
    )
  }
  return (
    <span dir="auto" title={text} className={cn("flex min-w-0", className)}>
      <span className="truncate">{chars.slice(0, -tail).join("")}</span>
      {/* Gives way only once the head is gone, so the box never overflows. */}
      <span className="min-w-0 shrink-[0.001] overflow-hidden whitespace-pre">
        {chars.slice(-tail).join("")}
      </span>
    </span>
  )
}
