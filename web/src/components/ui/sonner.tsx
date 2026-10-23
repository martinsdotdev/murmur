"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Alert02Icon,
  MultiplicationSignCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"

/** The caller passes `theme`; the site's own contract resolves it. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-4 animate-spin"
          />
        ),
      }}
      // The night-coloured surface (see --toast in tailwind.css), in place of
      // the popover cream that made a toast read as one more card.
      style={
        {
          "--normal-bg": "var(--toast)",
          "--normal-text": "var(--toast-foreground)",
          "--normal-border": "var(--toast-border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // M3 elevation level 2, the same as menus: a toast is a transient
      // surface over the content. Sonner's own rules outrank utilities, hence
      // the !s. Its action is a stock inverted chip and its description a
      // fixed grey; here the action is the app's amber text button, with the
      // state layer's hover and the app's focus ring, and the description the
      // toast's own muted cream. A success takes the amber on its tick.
      toastOptions={{
        classNames: {
          toast: "gap-3! text-sm! shadow-level-2!",
          description: "text-(--toast-muted)!",
          actionButton:
            "h-8! rounded-full! bg-transparent! px-3! text-sm! font-semibold! text-(--toast-action)! hover:bg-(--toast-action-hover)! focus-visible:outline-3! focus-visible:outline-offset-2! focus-visible:outline-ring!",
          success: "[&_[data-icon]]:text-(--toast-action)",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
