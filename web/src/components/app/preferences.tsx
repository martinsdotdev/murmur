/**
 * Preferences' building blocks, and the sheet that holds them: a main page of
 * rows, and the language and keyboard shortcut pages it pushes. MurmurApp writes the main page, since
 * its rows are the app's state; the sheet owns which page is up.
 */
import * as React from "react"
import { flushSync } from "react-dom"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  KeyboardIcon,
  LanguageSquareIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { formatLanguage } from "@/lib/format"
import { LOCALE_NAMES, chooseLocale } from "@/lib/i18n"
import { SCHEMES, SCHEME_TURNS, type Scheme, type ThemeMode } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { m } from "@/paraglide/messages.js"
import { getLocale, locales } from "@/paraglide/runtime.js"

/**
 * Preferences' lists, segmented as the Claude app and Android settings draw
 * theirs. The group's outer corners are 16px inside the phone sheet's 28px,
 * and 8px in the desktop dialog, so a group never rounds more than its frame.
 */
export const prefGroup =
  "segmented-list [--segment-radius:var(--radius-m3-lg)] sm:[--segment-radius:var(--radius-lg)]"

/** About's links and actions, as rows of the list like every other one. */
export const aboutRow =
  "flex min-h-14 items-center gap-4 state-layer px-4 py-3 text-left text-body-large transition-colors"

/** Whether this browser can turn the tokens (see scripts/schemes.ts). */
const SCHEMES_SUPPORTED =
  typeof CSS !== "undefined" && CSS.supports("color", "oklch(from red l c h)")

/** Getters, as the sound and category names are: read in the app's language
 * when shown, not when this module loads. */
const SCHEME_LABEL: Readonly<Record<Scheme, string>> = {
  get amber() {
    return m.scheme_amber()
  },
  get rose() {
    return m.scheme_rose()
  },
  get sage() {
    return m.scheme_sage()
  },
  get sky() {
    return m.scheme_sky()
  },
  get violet() {
    return m.scheme_violet()
  },
}

/**
 * A colour scheme in Preferences, beside the theme swatches and built like
 * them. Its dot is the scheme's own accent whatever scheme is active: the
 * dark accent, turned by the scheme's angle, which reads on both themes.
 */
function SchemeSwatch({
  scheme,
  active,
  onSelect,
}: {
  scheme: Scheme
  active: boolean
  onSelect: () => void
}) {
  const turn = scheme === "amber" ? 0 : SCHEME_TURNS[scheme]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-m3-xs border state-layer px-1 pt-2.5 pb-2 transition-[color,background-color,border-color,translate] first:rounded-s-(--segment-radius) last:rounded-e-(--segment-radius) motion-safe:active:translate-y-px",
        active
          ? "border-brand bg-secondary text-brand"
          : "border-transparent bg-grouped text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className="size-5 rounded-full ring-1 ring-foreground/10"
        style={{
          // Unitless: h is a number here, and an angle would void it.
          background: `oklch(from #d18a2c l c calc(h + ${turn}))`,
        }}
      />
      <span className="text-xs font-semibold">{SCHEME_LABEL[scheme]}</span>
    </button>
  )
}

function ThemeSwatch({
  mode,
  active,
  onSelect,
}: {
  mode: ThemeMode
  active: boolean
  onSelect: () => void
}) {
  const label =
    mode === "system"
      ? m.theme_auto()
      : mode === "light"
        ? m.theme_light()
        : m.theme_dark()
  const pane = (tone: "light" | "dark", half: boolean) => (
    <div
      className="flex flex-1 flex-col justify-end gap-[3px] p-1"
      style={{ background: `var(--swatch-${tone}-bg)` }}
    >
      {!half && (
        <span
          className="h-1 w-3/5 rounded-full"
          style={{ background: `var(--swatch-${tone}-line)` }}
        />
      )}
      <span
        className="h-1 w-full rounded-full"
        style={{ background: `var(--swatch-${tone}-accent)` }}
      />
    </div>
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-m3-xs border state-layer p-[9px_9px_8px] text-left transition-[color,background-color,border-color,translate] first:rounded-s-(--segment-radius) last:rounded-e-(--segment-radius) motion-safe:active:translate-y-px",
        // Selected as everywhere else: the raised container plus amber. The
        // rest are tiles like the list beneath them, with no outline, and
        // hover and press as the buttons do.
        active ? "border-brand bg-secondary" : "border-transparent bg-grouped"
      )}
    >
      <span className="flex h-8 overflow-hidden rounded border border-border">
        {mode === "system" ? (
          <>
            {pane("light", true)}
            {pane("dark", true)}
          </>
        ) : (
          pane(mode === "light" ? "light" : "dark", false)
        )}
      </span>
      <span
        className={cn(
          "mt-2 block text-xs font-semibold",
          active ? "text-brand" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  )
}

/**
 * Preferences' way into the language page, saying which language is in use,
 * whether the browser's or one picked.
 */
/** The theme: following the system, light or dark, as three swatches. */
export function ThemePicker({
  mode,
  onSelect,
}: {
  mode: ThemeMode
  onSelect: (mode: ThemeMode) => void
}) {
  return (
    <div className="mb-2 grid grid-cols-3 gap-0.5 [--segment-radius:var(--radius-m3-lg)] sm:[--segment-radius:var(--radius-lg)]">
      {(["system", "light", "dark"] as const).map((option) => (
        <ThemeSwatch
          key={option}
          mode={option}
          active={mode === option}
          onSelect={() => onSelect(option)}
        />
      ))}
    </div>
  )
}

/**
 * The colour scheme, as five swatches. Schemes are relative colour, so a
 * browser without it is offered none rather than five that do nothing.
 */
export function SchemePicker({
  scheme,
  onSelect,
}: {
  scheme: Scheme
  onSelect: (scheme: Scheme) => void
}) {
  if (!SCHEMES_SUPPORTED) return null
  return (
    <div
      role="group"
      aria-label={m.colour()}
      className="mb-2 grid grid-cols-5 gap-0.5 [--segment-radius:var(--radius-m3-lg)] sm:[--segment-radius:var(--radius-lg)]"
    >
      {SCHEMES.map((s) => (
        <SchemeSwatch
          key={s}
          scheme={s}
          active={scheme === s}
          onSelect={() => onSelect(s)}
        />
      ))}
    </div>
  )
}

export function LanguageRow({ onOpen }: { onOpen: () => void }) {
  const current = getLocale()
  return (
    <button
      type="button"
      data-opens="language"
      className={aboutRow}
      onClick={onOpen}
    >
      <HugeiconsIcon
        icon={LanguageSquareIcon}
        strokeWidth={2}
        className="size-5 shrink-0"
      />
      <span className="flex-1">{m.pref_language_title()}</span>
      <span
        lang={current}
        className="text-right text-body-medium text-muted-foreground"
      >
        {LOCALE_NAMES[current]}
      </span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        className="size-4 shrink-0 text-muted-foreground"
      />
    </button>
  )
}

/**
 * Preferences' language page. Each language is in its own name, which is how
 * people find theirs, with the name in the language on screen beneath, for
 * someone setting it up for someone else. Until anyone picks, nothing is
 * stored and the app follows the browser. Picking another reloads.
 */
function LanguagePage() {
  const current = getLocale()
  return (
    <>
      <div className={prefGroup}>
        {locales.map((locale) => {
          const own = LOCALE_NAMES[locale]
          const here = formatLanguage(locale)
          const chosen = locale === current
          return (
            <button
              key={locale}
              type="button"
              aria-pressed={chosen}
              // Focus lands on what's chosen, where the row that opened this
              // page was.
              autoFocus={chosen}
              className={aboutRow}
              onClick={() => chooseLocale(locale)}
            >
              <span className="min-w-0 flex-1">
                <span lang={locale} className="block">
                  {own}
                </span>
                {here !== own && (
                  <span className="mt-0.5 block text-body-medium text-muted-foreground">
                    {here}
                  </span>
                )}
              </span>
              {chosen && (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  strokeWidth={2}
                  className="size-5 shrink-0 text-brand"
                />
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-3 px-4 text-body-medium text-muted-foreground">
        {m.pref_language_description()}
      </p>
    </>
  )
}

export function ShortcutsRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      data-opens="shortcuts"
      className={aboutRow}
      onClick={onOpen}
    >
      <HugeiconsIcon
        icon={KeyboardIcon}
        strokeWidth={2}
        className="size-5 shrink-0"
      />
      <span className="flex-1">{m.pref_shortcuts_title()}</span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        className="size-4 shrink-0 text-muted-foreground"
      />
    </button>
  )
}

/** The modifier key as this platform's keyboard prints it. */
const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl"

/**
 * Preferences' keyboard shortcuts page: every shortcut the app answers, each
 * key a <kbd>, and both ways in for the one that has two.
 */
function ShortcutsPage() {
  const shortcuts: [string, string[][]][] = [
    [m.shortcut_play_pause(), [[m.key_space()]]],
    [m.master_volume(), [["↑"], ["↓"]]],
    [m.action_share(), [["S"]]],
    [m.timer_title(), [["T"]]],
    [m.preferences(), [[","], [MOD, "P"]]],
    [m.action_turn_all_off(), [[MOD, "R"]]],
    [m.add_own_sound(), [[MOD, "I"]]],
    [m.shortcut_view(), [[MOD, "G"]]],
  ]
  return (
    <dl className={prefGroup}>
      {shortcuts.map(([action, ways]) => (
        <div
          key={action}
          className="flex min-h-12 items-center gap-4 px-4 py-2.5"
        >
          <dt className="min-w-0 flex-1 text-body-large">{action}</dt>
          <dd className="flex shrink-0 items-center gap-3">
            {ways.map((keys) => (
              <span key={keys.join("+")} className="flex gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-6 rounded-m3-xs border border-border bg-background px-1.5 py-0.5 text-center font-mono text-xs text-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function PrefRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: IconSvgElement
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-4 state-layer px-4 py-3 transition-colors">
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-body-large">{title}</span>
        <span className="mt-0.5 block text-body-medium text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/**
 * A Preferences row that reports a state rather than switching one, with its
 * actions trailing. They wrap under the text when the row is too narrow.
 */
export function PrefInfo({
  icon,
  title,
  description,
  children,
}: {
  icon: IconSvgElement
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 shrink-0" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-body-large">{title}</p>
        {description && (
          <p className="mt-0.5 text-body-medium text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="ml-auto flex gap-2">{children}</div>}
    </div>
  )
}

export function PrefSlider({
  icon,
  title,
  value,
  display,
  min,
  max,
  step,
  largeStep,
  resetValue,
  onChange,
}: {
  icon: IconSvgElement
  title: string
  value: number
  display: string
  min: number
  max: number
  step: number
  largeStep?: number
  resetValue: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-4 px-4 pt-3 pb-4">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className="mt-0.5 size-5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body-large">{title}</span>
          <span className="text-body-medium text-muted-foreground tabular-nums">
            {display}
          </span>
        </div>
        <div className="mt-4">
          <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            largeStep={largeStep}
            wheelStep={step}
            resetValue={resetValue}
            aria-label={title}
            // These values are milliseconds and seconds, so the bare number a
            // screen reader would otherwise announce is a lie. `display` is the
            // same string shown above the track.
            aria-valuetext={display}
            // The same string rides the thumb while the value is being set,
            // as on every level slider. The one above stays for reading it
            // at rest, since a setting's unit isn't in the track's position.
            showValue
            valueLabel={display}
            onValueChange={(v) => onChange(v as number)}
          />
        </div>
      </div>
    </div>
  )
}

export function PrefSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2 px-4 text-label-small text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Which page is up, and how it got there, which says where it slides in from. */
type Subpage = "language" | "shortcuts"
type View = { page: "main" | Subpage; arrived: "open" | "forward" | "back" }

/**
 * A page or its title coming in: from the side its row points to, back the
 * other way, and not at all when the sheet opens. A fade alone where motion is
 * reduced. A transition from @starting-style, not an animation: the scroller's
 * animation property belongs to scroll-fade, whose edges are a scroll-driven
 * animation, and an entrance keyframe there replaced it.
 */
const ENTER: Record<View["arrived"], string> = {
  open: "",
  forward:
    "transition-[opacity,translate] duration-200 ease-(--ease-out) starting:opacity-0 motion-safe:starting:translate-x-6",
  back: "transition-[opacity,translate] duration-200 ease-(--ease-out) starting:opacity-0 motion-safe:starting:-translate-x-6",
}

/**
 * A page's scroller. both-edges, not stable: the scrollbar was eating 10px of
 * the right padding, so the content sat 20px from the left and 30 from the
 * right. Reserving the gutter on both sides keeps it symmetric, and reserving
 * it at all stops the jump when a pref toggle changes the content past the
 * scroll threshold.
 */
const PAGE =
  "flex min-h-0 flex-1 scroll-fade [scrollbar-gutter:stable_both-edges] flex-col overflow-y-auto px-5 py-4 scroll-fade-5"

export function PreferencesSheet({
  open,
  onOpenChange,
  footer,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The main page's command bar. */
  footer: React.ReactNode
  /** The main page, given the way into a subpage. */
  children: (open: (page: Subpage) => void) => React.ReactNode
}) {
  const [view, setView] = React.useState<View>({
    page: "main",
    arrived: "open",
  })
  const main = React.useRef<HTMLDivElement>(null)
  const subpage = view.page === "main" ? null : view.page
  const openPage = (page: Subpage) => setView({ page, arrived: "forward" })
  // Focus goes back to the row that opened the page, which the main page,
  // drawn again, has just put back.
  const back = () => {
    const from = view.page
    flushSync(() => setView({ page: "main", arrived: "back" }))
    main.current?.querySelector<HTMLElement>(`[data-opens=${from}]`)?.focus()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setView({ page: "main", arrived: "open" })
      }}
    >
      {/* A column that clips: the base DialogContent scrolls itself, which
          put a second scrollbar on this dialog and let the header and footer
          scroll away with the content. Only the page below scrolls. Its
          height is fixed at the most the dialog may take, the sheet's 85% on
          a phone and up to 760px on a desktop with 2rem clear above and
          below, which the main page always fills. The language page is
          short, and a sheet that shrank under it and grew back would jump. */}
      <DialogContent className="flex h-[85dvh] flex-col gap-0 overflow-hidden p-0 max-sm:pt-8 max-sm:pb-0 sm:h-[min(calc(100dvh-4rem),47.5rem)] sm:max-w-lg">
        <DialogHeader className="shrink-0 px-5 py-4">
          {subpage ? (
            <div className={cn("flex items-center gap-3", ENTER[view.arrived])}>
              {/* The close button's look, on the other side: -my-1 keeps the
                  header the title's height. */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="-my-1 rounded-full bg-secondary"
                aria-label={m.action_back()}
                // The shortcuts page has nothing to focus, so focus waits
                // here, where the way back is.
                autoFocus={subpage === "shortcuts"}
                onClick={back}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              </Button>
              {/* Where this page sits, at the title's size: the parent muted
                  and a way back too, the page itself the title. */}
              <Breadcrumb aria-label={m.breadcrumb()} className="min-w-0">
                <BreadcrumbList className="gap-1.5 font-heading text-lg leading-none font-medium sm:gap-1.5">
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      render={
                        <button
                          type="button"
                          className="cursor-pointer rounded-sm pointer-coarse:hit-target"
                          onClick={back}
                        />
                      }
                    >
                      {m.preferences()}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-muted-foreground [&>svg]:size-4" />
                  <BreadcrumbItem>
                    <DialogTitle
                      aria-current="page"
                      className="text-lg text-foreground"
                    >
                      {subpage === "language"
                        ? m.pref_language_title()
                        : m.pref_shortcuts_title()}
                    </DialogTitle>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          ) : (
            <DialogTitle className={cn("text-lg", ENTER[view.arrived])}>
              {m.preferences()}
            </DialogTitle>
          )}
        </DialogHeader>

        {/* Keyed, so each page is a new element: the transition starts
            from @starting-style only when its element is inserted, and React
            would otherwise reuse one div for both. */}
        {subpage ? (
          <div key={subpage} className={cn(PAGE, ENTER[view.arrived])}>
            {subpage === "language" ? <LanguagePage /> : <ShortcutsPage />}
          </div>
        ) : (
          <div
            key="main"
            ref={main}
            className={cn(PAGE, "gap-5", ENTER[view.arrived])}
          >
            {children(openPage)}
          </div>
        )}

        {/* This dialog sets p-0, which takes the sheet's safe-area padding
            with it, so the footer has to clear the home indicator itself. It
            sits a layer below the dialog's background-3, on the background-2
            popovers use, the way a WinUI ContentDialog's command area does, so
            it reads as the dialog's base rather than more of its content. The
            language page has nothing for it to do, so there it slides down
            out of the sheet and goes inert, keeping its place so the page
            above doesn't jump. */}
        <div
          inert={subpage !== null}
          className={cn(
            "flex shrink-0 items-center gap-3 border-t border-border bg-popover px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground transition-[opacity,translate] duration-200 ease-(--ease-out) sm:pb-3",
            subpage && "opacity-0 motion-safe:translate-y-full"
          )}
        >
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  )
}
