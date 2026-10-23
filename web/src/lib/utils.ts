import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The M3 tokens in tailwind.css, so cn() knows what they are. Unregistered,
// text-label-small reads as a colour and is dropped beside text-muted-foreground.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "body-medium",
        "body-small",
        "label-large",
        "label-medium",
        "label-small",
        "title-small",
        "title-medium",
      ],
      shadow: ["level-1", "level-2", "level-3"],
      radius: [
        "m3-xs",
        "m3-sm",
        "m3-md",
        "m3-lg",
        "m3-xl",
        "m3-xxl",
        "m3-full",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
