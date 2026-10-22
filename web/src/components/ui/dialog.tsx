"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

const SHEET_QUERY = "(width < 40rem)"

function subscribeSheet(onChange: () => void) {
  const media = window.matchMedia(SHEET_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** Below sm, where a dialog is a bottom sheet that can be swiped away. */
function useSheet() {
  return React.useSyncExternalStore(
    subscribeSheet,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false
  )
}

/**
 * DIVERGES FROM THE REGISTRY: below sm the root is Base UI's Drawer, which is
 * Dialog plus swipe gestures, so a phone sheet can be swiped down to dismiss.
 * Title, Description and Close are the same parts under either root. Crossing
 * sm remounts the dialog, which only happens mid-resize.
 */
function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  const sheet = useSheet()
  return sheet ? (
    <DrawerPrimitive.Root
      swipeDirection="down"
      {...(props as DrawerPrimitive.Root.Props)}
    />
  ) : (
    <DialogPrimitive.Root data-slot="dialog" {...props} />
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  instant = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** No open or close motion, for a dialog a keyboard shortcut drives. */
  instant?: boolean
}) {
  const sheet = useSheet()
  const popupClassName = cn(
    // Padding is stated once, unprefixed, so a caller's p-0 actually wins:
    // tailwind-merge only dedupes within a variant group, and an sm:p-6 here
    // would survive alongside p-0 and re-inset the content. select-none for
    // the same reason the app shell carries it: a dialog is chrome, not a
    // document. It has to be repeated here because the portal renders this
    // outside the shell's subtree.
    "fixed inset-x-0 bottom-0 z-50 grid max-h-[85dvh] w-full gap-6 overflow-y-auto rounded-t-2xl bg-dialog p-6 text-sm text-popover-foreground shadow-xl outline-none select-none max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
    "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:ring-1 sm:ring-foreground/5 dark:sm:ring-foreground/10",
    className
  )
  const close = showCloseButton && (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      render={
        <Button
          variant="ghost"
          className="absolute top-4 right-4 rounded-full bg-secondary"
          size="icon-sm"
        />
      }
    >
      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  )

  // DIVERGES FROM THE REGISTRY: below sm this is a bottom sheet, not a
  // centred card, because a phone modal belongs under the thumb, and it can be
  // swiped down to close. Both forms share data-slot, classes and the motion
  // rules in tailwind.css. `shadcn add dialog` will drop all of it.
  if (sheet) {
    return (
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop
          data-slot="dialog-overlay"
          data-instant={instant || undefined}
          className="fixed inset-0 isolate z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm"
        />
        <DrawerPrimitive.Viewport className="fixed inset-0 z-50">
          <DrawerPrimitive.Popup
            data-slot="dialog-content"
            data-instant={instant || undefined}
            className={popupClassName}
            {...(props as DrawerPrimitive.Popup.Props)}
          >
            {/* The sheet really does follow a finger now, so it says so. */}
            <span
              aria-hidden="true"
              className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-foreground/20"
            />
            {children}
            {close}
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay data-instant={instant || undefined} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-instant={instant || undefined}
        className={popupClassName}
        {...props}
      >
        {children}
        {close}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
