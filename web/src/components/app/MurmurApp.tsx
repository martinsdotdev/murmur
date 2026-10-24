"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { Popover } from "@base-ui/react/popover"
import {
  Archive01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  AudioWave01Icon,
  BrowserIcon,
  Cancel01Icon,
  Delete02Icon,
  Copy01Icon,
  DarkModeIcon,
  Database01Icon,
  Download04Icon,
  FavouriteIcon,
  File01Icon,
  FloppyDiskIcon,
  GithubIcon,
  GridViewIcon,
  HeadphonesIcon,
  InstallingUpdates01Icon,
  LeftToRightListBulletIcon,
  MinusSignCircleIcon,
  Moon02Icon,
  MoreHorizontalIcon,
  MusicNote01Icon,
  PauseIcon,
  PanelRightIcon,
  PencilEdit02Icon,
  PlayIcon,
  PlusSignIcon,
  RefreshIcon,
  Settings01Icon,
  Share01Icon,
  Sun03Icon,
  Tick02Icon,
  Upload04Icon,
  VolumeHighIcon,
  VolumeOffIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Slider } from "@/components/ui/slider"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Toaster } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { categoryLabel, sounds, type SoundCategory } from "@/data/sounds"
import { repoUrl, sponsorUrl } from "@/data/site"
import {
  DEFAULT_MASTER,
  DEFAULT_PREFS,
  DEV_FIXTURE,
  MIX_NAME_MAX,
  SOUND_NAME_MAX,
  customName,
  loadPersisted,
  mixLabel,
  parseBackupData,
  savePersisted,
  type CustomSound,
  type PersistedState,
  type Prefs,
  type SavedMix,
  type View,
} from "@/lib/app-state"
import { BackupError, buildBackup, readBackup } from "@/lib/backup"
import { deleteBlob, getAllBlobs, putBlob } from "@/lib/blob-store"
import { levelsFromGains } from "@/lib/levels"
import {
  Mixer,
  canPlayOgg,
  decodeMix,
  encodeMix,
  type MixerState,
  type VolumeRamp,
} from "@/lib/mixer"
import { isVideoId, parseYouTubeUrl } from "@/lib/youtube"
import {
  applyTheme,
  crossfadeTheme,
  readThemeMode,
  writeThemeMode,
  type ThemeMode,
  type Scheme,
  readScheme,
  writeScheme,
  applyScheme,
  readBlackNight,
  writeBlackNight,
  applyBlackNight,
} from "@/lib/theme"
import { clampName, isolate, nameFromFile } from "@/lib/text"
import { cn } from "@/lib/utils"
import {
  formatBytes,
  formatCountdown,
  formatDuration,
  formatList,
  formatPercent,
  formatPreset,
  formatSeconds,
  formatTime,
} from "@/lib/format"
import { aboutPath, startAppLocale } from "@/lib/i18n"
import { getLocale } from "@/paraglide/runtime.js"
import { runs } from "@/lib/markup"
import { m } from "@/paraglide/messages.js"

import { DevDataToggle } from "./DevDataToggle"
import { MiddleTruncate } from "./MiddleTruncate"
import { SoundIcon } from "./SoundIcon"
import { useCoarsePointer } from "./use-coarse-pointer"
import { useLevelDrag } from "./use-level-drag"
import {
  LanguageRow,
  ShortcutsRow,
  PrefInfo,
  PrefRow,
  PrefSection,
  PrefSlider,
  PreferencesSheet,
  SchemePicker,
  ThemePicker,
  aboutRow,
  prefGroup,
} from "./preferences"
import { persistStorage, usePwa } from "./use-pwa"

/** Vite inlines this at build time, in client islands as well as .astro files. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

// Before the first render: messages and formatters read the language when
// they're first called, and nothing at module level calls them.
startAppLocale()

const TIMER_PRESETS = [15, 30, 45, 60, 90]
const CATEGORIES: SoundCategory[] = ["nature", "urban", "generated"]
/** The built-in sounds in the grid's order, which Now playing lists in too. */
const CATALOG_ORDER = CATEGORIES.flatMap((category) =>
  sounds.filter((s) => s.category === category).map((s) => s.id)
)
/** A level, about 6 dB under full: room above it, and close to as loud as
 *  the 0.7 gain it replaced. */
const DEFAULT_TOGGLE_VOLUME = 0.8
const CATALOG_IDS = new Set(sounds.map((s) => s.id))

/** YouTube's player ignores setVolume on iPhone; iPadOS lets it through. */
const IS_IPHONE = /iPhone|iPod/.test(navigator.userAgent)
/**
 * iPhone or iPad Safari, where installing is Share, then Add to Home Screen.
 * iPadOS reports itself as a Mac, so a Mac with a touch screen counts.
 */
const IS_APPLE_TOUCH =
  IS_IPHONE ||
  /iPad/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
const MUSIC_ICON =
  "M9 18V5l12-2v13 M3 18A3 3 0 1 0 9 18A3 3 0 1 0 3 18Z M15 16A3 3 0 1 0 21 16A3 3 0 1 0 15 16Z"

/** A screen and a play triangle: enough to tell a video apart from a file. */
const VIDEO_ICON =
  "M2 7.5a2.5 2.5 0 0 1 2.5-2.5h15a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5h-15a2.5 2.5 0 0 1-2.5-2.5z M10 9.5 15 12 10 14.5Z"

/**
 * A YouTube sound's id *is* its video id, and that one choice is what makes
 * sharing work: "#mix=yt_dQw4w9WgXcQ:0.5,rain:0.3" round-trips through
 * encodeMix/decodeMix with no new syntax, and re-adding a video lands on the
 * card that already exists instead of stacking a second player behind it.
 */
const YT_PREFIX = "yt_"

const ytSoundId = (videoId: string) => `${YT_PREFIX}${videoId}`

const ytVideoId = (id: string): string | null => {
  if (!id.startsWith(YT_PREFIX)) return null
  const videoId = id.slice(YT_PREFIX.length)
  return isVideoId(videoId) ? videoId : null
}

/**
 * A sound this device sets the level of itself: on iPhone a YouTube sound
 * plays at the phone's volume whatever a slider says, so it gets this note
 * where a slider would be.
 */
const deviceSetsLevel = (id: string) => IS_IPHONE && ytVideoId(id) !== null

/**
 * The free-standing mark: the tile is dropped because the sidebar is already a
 * shape. currentColor rather than the design's fixed amber, so it follows
 * --brand across themes.
 */
function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="168 156 432 432"
      width={size}
      height={size}
      className="shrink-0 text-brand"
      aria-hidden="true"
    >
      <rect
        x="192"
        y="216"
        width="96"
        height="312"
        rx="48"
        fill="currentColor"
      />
      <rect
        x="336"
        y="384"
        width="96"
        height="144"
        rx="48"
        fill="currentColor"
      />
      <rect
        x="480"
        y="216"
        width="96"
        height="312"
        rx="48"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * A cell of All mixes' action shelf: an icon over its label, as a segment.
 * Five to a row on a phone is 51px each, narrower than one word in some
 * languages ("Compartilhar"), so a label hyphenates in the page's language,
 * and breaks anywhere where the browser can't. One that takes a third line
 * makes the row taller rather than pushing its icon out of the cell.
 */
const shelfCell =
  "flex min-h-16 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-m3-xs bg-grouped px-0.5 py-1 text-center text-label-small hyphens-auto wrap-anywhere state-layer transition-[background-color,translate] first:rounded-s-(--segment-radius) last:rounded-e-(--segment-radius) motion-safe:active:translate-y-px"

/** A mix's loudest sound stands in for it, so "Rainy café" reads as a café. */
function mixIconPath(mix: MixerState) {
  let top = ""
  let loudest = 0
  for (const [id, volume] of Object.entries(mix)) {
    if (volume > loudest) {
      loudest = volume
      top = id
    }
  }
  return sounds.find((s) => s.id === top)?.iconPath ?? MUSIC_ICON
}

/** A mix's sound names, loudest first, leaving out any sound since removed. */
function soundsByLevel(
  mix: MixerState,
  nameOf: (id: string) => string | undefined
) {
  return Object.entries(mix)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => nameOf(id))
    .filter((name): name is string => name !== undefined)
}

/**
 * The name Save offers: the loudest sound, and the next if both fit, so
 * "Rain and Coffee shop". Numbered past any mix already called that, since
 * saving under a taken name replaces it and accepting the offer shouldn't.
 */
function suggestMixName(
  mix: MixerState,
  nameOf: (id: string) => string | undefined,
  taken: (name: string) => boolean
) {
  const [first, second] = soundsByLevel(mix, nameOf)
  if (!first) return ""
  const both = second ? m.mix_name_pair({ first, second }) : first
  const base =
    clampName(both, MIX_NAME_MAX) === both
      ? both
      : clampName(first, MIX_NAME_MAX)
  let name = base
  for (let n = 2; taken(name); n++) {
    name = `${clampName(base, MIX_NAME_MAX - ` ${n}`.length)} ${n}`
  }
  return name
}

/**
 * What a mix is made of, loudest first: "Rain", "Rain and Fireplace",
 * "Rain, Fireplace and Birds", "Rain, Fireplace and 3 more". Two mixes can
 * share a name; they rarely share their sounds.
 */
function mixSummary(
  mix: MixerState,
  nameOf: (id: string) => string | undefined
) {
  const names = soundsByLevel(mix, nameOf).map(isolate)
  if (names.length <= 3) return formatList(names)
  return formatList([
    ...names.slice(0, 2),
    m.mix_more({ count: names.length - 2 }),
  ])
}

interface MixRowProps {
  name: string
  mix: MixerState
  loaded: boolean
  dirty?: boolean
  /**
   * A line under the name, which also makes the row the phone sheet's
   * comfortable one: 20px icon and M3 list type, where the sidebar's is
   * compact.
   */
  detail?: string
  onApply: () => void
  onRemove?: () => void
  /** On the button, e.g. a taller row where a finger has to hit it. */
  className?: string
}

/**
 * The leading slot always shows the mix's loudest sound, so "Rainy café" reads
 * as a café rather than a word.
 *
 * Colours follow Fluent 2's vertical TabList: the selected row is neutral
 * (background-3 behind foreground-1) and the indicator bar is the only brand
 * element in it. The row used to be brand all over, which read as a filled
 * button, and Fluent reserves that weight for the one primary action in a
 * layout. So the rail carries both bits of state: full brand means the row
 * matches what is saved, half means you have edited it since.
 *
 * Renders the contents of a SidebarMenuItem, not the item itself: the saved
 * rows need the <li> to be the context-menu trigger, and a trigger wrapped
 * around the item would put a <div> between the <ul> and its children.
 */
function MixRow({
  name,
  mix,
  loaded,
  dirty,
  detail,
  onApply,
  onRemove,
  className,
}: MixRowProps) {
  return (
    <>
      {/* Fluent's rail marks the sidebar's row. The sheet's row is filled
          whole by its caller instead, ··· included, as an M3 list's is. */}
      {loaded && detail === undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "mm-rail absolute top-1/2 left-0 z-10 h-4 w-[3px] -translate-y-1/2 rounded-[2px]",
            dirty ? "bg-brand/50" : "bg-brand"
          )}
        />
      )}
      {/* Metrics are the design's; the selected colours are the variant's own
          data-active pair, which already resolves to the two neutral tokens
          Fluent asks for. What the primitive also contributes is the pr-8 it
          adds whenever a menu-action is present, and the truncate on the label. */}
      <SidebarMenuButton
        onClick={onApply}
        isActive={loaded}
        className={cn(
          // data-active:font-semibold because the variant's data-active sets
          // font-medium, and the row's weight is fixed at 600 by the design.
          "h-auto min-h-8 gap-2 rounded px-2.5 py-1.5 text-label-large font-semibold data-active:font-semibold",
          !loaded && "text-foreground/85",
          detail !== undefined &&
            "min-h-14 gap-4 rounded-m3-md py-2 text-body-large font-normal data-active:bg-transparent data-active:font-normal",
          className
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center",
            detail !== undefined ? "size-5" : "size-3.5"
          )}
        >
          <SoundIcon
            path={mixIconPath(mix)}
            size={detail !== undefined ? 20 : 13}
            strokeWidth={detail !== undefined ? 2 : 1.9}
          />
        </span>
        {detail !== undefined ? (
          <span className="min-w-0 flex-1">
            {/* "(edited)" as Now playing writes it, since there's no rail here
                to dim. */}
            <span className="flex min-w-0">
              <MiddleTruncate text={name} />
              {dirty && (
                <span className="shrink-0 whitespace-pre text-muted-foreground">
                  {m.mix_edited()}
                </span>
              )}
            </span>
            {/* A sentence around isolated names, so it keeps the page's
                direction; dir="auto" would take an Arabic name's. */}
            <span className="block truncate text-body-medium text-muted-foreground">
              {detail}
            </span>
          </span>
        ) : (
          <MiddleTruncate text={name} />
        )}
      </SidebarMenuButton>
      {/* The component centres itself with top-*, keyed to the peer button's
          data-size. top-2 centres a 20px action in the default 36px row. This
          row is 32 with a 22px action, so the override has to be that same peer
          variant: a plain top-* loses to it, and a translate on top of the 8px
          it resolves to lifts the × clean out of the row. */}
      {onRemove && (
        <SidebarMenuAction
          showOnHover
          // [&>svg]:size-3 rather than a size on the icon: the base sets
          // [&>svg]:size-4 with no opt-out, and a descendant rule outranks a
          // class on the child. Same utility family, so cn() dedupes it.
          className="right-1 size-[22px] w-[22px] rounded state-layer text-muted-foreground peer-data-[size=default]/menu-button:top-[5px] hover:text-foreground [&>svg]:size-3"
          aria-label={m.mix_delete_named({ name })}
          title={m.mix_delete()}
          onClick={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
        </SidebarMenuAction>
      )}
    </>
  )
}

/**
 * One per kind of thing renamed, rather than one whose title switches: a
 * shared dialog would flip to the other title while it fades out.
 */
function RenameDialog({
  open,
  title,
  placeholder,
  value,
  maxLength,
  onValueChange,
  onRename,
  onCancel,
}: {
  open: boolean
  title: string
  placeholder: string
  value: string
  maxLength: number
  onValueChange: (value: string) => void
  onRename: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      {/* Full height on a phone, M3's compact form dialog: the keyboard then
          has nothing to squeeze. */}
      <DialogContent className="content-start max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="done"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRename()
          }}
        />
        <DialogFooter>
          <Button shape="fluent" variant="outline" onClick={onCancel}>
            {m.action_cancel()}
          </Button>
          <Button shape="fluent" onClick={onRename}>
            {m.action_rename()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The row's phone form: below md the sidebar is gone and mixes become chips.
 * The loaded one is outlined in brand rather than filled with it: white on the
 * light theme's filled amber is 4:1, short of AA for text this size.
 */
function MixChip({
  label,
  iconPath,
  active,
  onClick,
}: {
  label: string
  iconPath?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-10 max-w-[14rem] shrink-0 items-center gap-2 rounded-lg border px-3.5 text-label-large font-semibold whitespace-nowrap transition-colors pointer-coarse:hit-target",
        active
          ? "border-brand bg-secondary text-foreground"
          : "bg-muted state-layer text-foreground/85"
      )}
    >
      {/* M3's filter chip: a check replaces the leading icon once selected. */}
      {active ? (
        <HugeiconsIcon
          icon={Tick02Icon}
          strokeWidth={2}
          className="size-[13px] shrink-0 text-brand"
        />
      ) : (
        iconPath && (
          <SoundIcon
            path={iconPath}
            size={13}
            strokeWidth={1.9}
            className="size-[13px] shrink-0"
          />
        )
      )}
      <MiddleTruncate text={label} />
    </button>
  )
}

/**
 * A card's level where it has no slider: on touch, where a thumb in the
 * scrolling grid would take the swipe meant to scroll it. The card itself is
 * the control there (see useLevelDrag), and this follows it, mirrored right to
 * left as the slider is. h-1 is the slider's own box (its thumb overhangs it),
 * so the card still measures the 83px the "Add sound" tile copies. With
 * showValue the number rides the fill's end while a finger drags the card,
 * as it rides a slider's thumb (.value-head in tailwind.css).
 */
function LevelBar({
  level,
  live = false,
  showValue = false,
  valueShown = false,
}: {
  level: number
  /** Under a finger: the fill keeps up with it rather than easing after. */
  live?: boolean
  showValue?: boolean
  /** The number is up: while dragged, and a moment after. */
  valueShown?: boolean
}) {
  return (
    <div className="relative">
      <LevelTrack level={level} live={live} />
      {/* Beside the track, not in it: the track clips. aria-hidden, as Now
          playing's slider says the level. */}
      {showValue && (
        <span
          aria-hidden="true"
          className="value-head"
          data-open={valueShown ? "" : undefined}
          style={{ "--r": level } as React.CSSProperties}
        >
          <span className="value-pill sheen [--sheen-color:var(--brand)]">
            <span>{Math.round(level * 100)}</span>
          </span>
        </span>
      )}
    </div>
  )
}

function LevelTrack({ level, live }: { level: number; live: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        // As a slider's track: 4px, thickening to 6px under a finger, by a
        // clip on a 6px box whose margins keep the 4px in the layout.
        "relative -my-px h-1.5 overflow-hidden rounded-full transition-[background-color,clip-path] duration-150 ease-(--ease-out) motion-reduce:transition-none rtl:-scale-x-100",
        level > 0 ? "bg-track" : "bg-transparent",
        live
          ? "[clip-path:inset(0_round_9999px)]"
          : "[clip-path:inset(1px_0_round_9999px)]",
        // Highlighted under a finger, as a slider's track is under the pointer.
        live &&
          level > 0 &&
          "bg-[color-mix(in_oklab,var(--track),var(--foreground)_8%)]"
      )}
    >
      {/* Full width and slid into place rather than sized: a transform
          animates without layout, and the clipped track keeps the fill's
          rounded end whatever the level. */}
      <div
        className={cn(
          "h-full rounded-full bg-primary sheen bg-right bg-no-repeat transition-transform duration-150 ease-out motion-reduce:transition-none",
          live && "transition-none"
        )}
        // The sheen spans the visible part only, as it spans a slider's fill.
        style={{
          transform: `translateX(${Math.round(level * 100) - 100}%)`,
          backgroundSize: `${Math.round(level * 100)}% 100%`,
        }}
      />
    </div>
  )
}

/**
 * One line of Now playing. The name column is plain text, so a swipe that
 * starts on it still scrolls the sheet; only the slider takes the touch.
 */
function NowPlayingRow({
  icon,
  name,
  level,
  note,
  resetLevel,
  onDrag,
  onCommit,
  onTurnOff,
}: {
  icon: React.ReactNode
  name: string
  level: number
  /**
   * Shown in place of the slider, for a sound whose level this device sets
   * itself: a slider there would move and change nothing.
   */
  note?: string
  /** What a double-click on the slider goes back to, as on the cards. */
  resetLevel: number
  onDrag: (level: number) => void
  onCommit: (level: number) => void
  /** Absent for the master row, which has nothing to turn off. */
  onTurnOff?: () => void
}) {
  const pct = Math.round(level * 100)
  return (
    <div className="flex min-h-14 items-center gap-3 py-1">
      <span className="flex size-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="w-24 shrink-0">
        <span
          dir="auto"
          title={name}
          className={cn(
            "block truncate text-sm font-semibold",
            level === 0 && "text-muted-foreground"
          )}
        >
          {name}
        </span>
      </span>
      {note ? (
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{note}</p>
      ) : (
        <>
          {/* Width on a wrapper: the Slider root's own data-horizontal:w-full
              outranks any sizing passed to it. */}
          <div className="min-w-0 flex-1">
            <Slider
              value={pct}
              min={0}
              max={100}
              step={1}
              wheelStep={5}
              resetValue={Math.round(resetLevel * 100)}
              aria-label={m.sound_volume({ name })}
              aria-valuetext={formatPercent(pct)}
              showValue
              onValueChange={(value) => onDrag((value as number) / 100)}
              onValueCommitted={(value) => onCommit((value as number) / 100)}
            />
          </div>
        </>
      )}
      {onTurnOff ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-muted-foreground pointer-coarse:hit-target"
          aria-label={
            level > 0
              ? m.sound_turn_off_named({ name })
              : m.sound_release_named({ name })
          }
          onClick={onTurnOff}
        >
          <HugeiconsIcon
            icon={MinusSignCircleIcon}
            strokeWidth={2}
            className="size-5"
          />
        </Button>
      ) : (
        <span aria-hidden="true" className="w-11 shrink-0" />
      )}
    </div>
  )
}

interface RenderableSound {
  id: string
  name: string
  iconPath: string
}

/** What Clear all took, held for its Undo. */
interface ClearedData {
  saved: SavedMix[]
  customs: CustomSound[]
  vols: MixerState
}

/**
 * What opening a shared link changed. Nothing in a link needs a warning up
 * front: volumes are bounded, ids are held to the catalog and to YouTube's
 * alphabet, and the app boots paused. What it can do is overwrite the mix on
 * screen and add sounds to the mixer, so arrival is announced with an Undo.
 */
interface LinkArrival {
  /** The mix that was on before the link, which Undo puts back. */
  previous: Pick<PersistedState, "vols" | "mixName" | "dirty">
  /** No saved mix holds the previous one, so Undo is the only way back to it. */
  replacedUnsaved: boolean
  /** Ids of the YouTube sounds the link created, which Undo removes. */
  addedVideos: string[]
}

function sameMix(a: MixerState, b: MixerState) {
  const ids = Object.keys(a)
  return (
    ids.length === Object.keys(b).length && ids.every((id) => a[id] === b[id])
  )
}

/**
 * Touches localStorage, so this only works because the island is client:only.
 * loadPersisted() also runs the v1 migration; it must stay on this synchronous
 * first-render path, ahead of the IndexedDB sweep effect. See lib/app-state.ts.
 */
function readInitialState(): {
  state: PersistedState
  /** Set whenever the URL carried a mix, applied or not, so the hash is cleared. */
  link: LinkArrival | null
} {
  const state = loadPersisted()

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const shared = params.get("mix")
  if (shared === null) return { state, link: null }

  const link: LinkArrival = {
    previous: { vols: state.vols, mixName: state.mixName, dirty: state.dirty },
    replacedUnsaved: false,
    addedVideos: [],
  }

  // Catalog sounds travel, and so do YouTube ones since the id is the whole
  // reference. A file import is a blob in the sender's browser and a link
  // import may not be public, so neither resolves to anything here.
  // A link with no v= is from before levels and carries gains, which play
  // as they did once converted.
  const decoded = decodeMix(shared)
  const levels = params.has("v") ? decoded : levelsFromGains(decoded)
  const mix = Object.fromEntries(
    Object.entries(levels).filter(
      ([id]) => CATALOG_IDS.has(id) || ytVideoId(id)
    )
  )
  if (!Object.keys(mix).length || sameMix(mix, state.vols)) {
    return { state, link }
  }

  link.replacedUnsaved =
    Object.keys(state.vols).length > 0 &&
    (state.dirty || !state.saved.some((s) => s.name === state.mixName))
  state.vols = mix
  state.mixName = clampName(params.get("n") ?? "", MIX_NAME_MAX) || {
    untitled: "shared",
  }
  state.dirty = false

  // A link can name a video this browser has never seen, so its custom has
  // to exist before the mixer goes looking.
  for (const id of Object.keys(mix)) {
    const videoId = ytVideoId(id)
    if (!videoId || state.customs.some((c) => c.id === id)) continue
    state.customs.push({ id, videoId })
    link.addedVideos.push(id)
  }

  return { state, link }
}

/** Where the Now playing pane fits: the desktop shell, from 840px. */
const PANE_QUERY =
  "(width >= 52.5rem) and (not ((pointer: coarse) and (height < 30rem)))"

function subscribePane(onChange: () => void) {
  const media = window.matchMedia(PANE_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function usePaneFits() {
  return React.useSyncExternalStore(
    subscribePane,
    () => window.matchMedia(PANE_QUERY).matches,
    () => false
  )
}

/**
 * The wall clock, for "Stops at", read through a store so rendering stays
 * pure. It ticks only while something shows it.
 */
let clockNow = Date.now()
function subscribeClock(onChange: () => void) {
  clockNow = Date.now()
  const id = window.setInterval(() => {
    clockNow = Date.now()
    onChange()
  }, 15_000)
  return () => window.clearInterval(id)
}
function useClock() {
  return React.useSyncExternalStore(
    subscribeClock,
    () => clockNow,
    () => clockNow
  )
}

/**
 * The sleep timer's dialog body. Idle: one length, set by a chip for the usual
 * ones or the slider for any other, shown large with when it would stop, and
 * Start. Running: the time left and when that is, with more time or off, and
 * nothing that restarts it by accident. Its own component so the clock behind
 * "Stops at" ticks only while the dialog is open.
 */
function SleepTimerPanel({
  running,
  left,
  end,
  choice,
  fadeSeconds,
  onChoose,
  onStart,
  onExtend,
  onStop,
}: {
  running: boolean
  /** Seconds left, while running. */
  left: number
  /** When it stops, in ms, while running. */
  end: number
  /** The length in minutes to start, while idle. */
  choice: number
  fadeSeconds: number
  onChoose: (minutes: number) => void
  onStart: () => void
  onExtend: () => void
  onStop: () => void
}) {
  const now = useClock()
  // The one large thing: tabular figures, so a ticking countdown holds still.
  const readout = (value: string, caption: string) => (
    <div className="py-1 text-center">
      <p className="text-5xl font-medium tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-body-medium text-muted-foreground">{caption}</p>
    </div>
  )

  if (running) {
    return (
      <>
        {readout(
          formatCountdown(left),
          left <= fadeSeconds
            ? m.timer_fading()
            : m.timer_stops_at({ time: formatTime(end) })
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={onExtend}>
            {m.timer_extend({ duration: formatDuration(15) })}
          </Button>
          <Button variant="ghost" className="h-11" onClick={onStop}>
            {m.action_turn_off()}
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      {readout(
        formatDuration(choice),
        m.timer_stops_at({ time: formatTime(now + choice * 60_000) })
      )}
      <div className="flex flex-col gap-5">
        {/* A segmented row, as the theme swatches are. A chip reads as chosen
            whenever the slider sits on its length. */}
        <div className="grid grid-cols-5 gap-0.5 [--segment-radius:var(--radius-m3-lg)] sm:[--segment-radius:var(--radius-lg)]">
          {TIMER_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={choice === minutes}
              onClick={() => onChoose(minutes)}
              className={cn(
                "h-11 cursor-pointer rounded-m3-xs border state-layer text-sm font-medium whitespace-nowrap transition-[background-color,border-color,translate] first:rounded-s-(--segment-radius) last:rounded-e-(--segment-radius) motion-safe:active:translate-y-px",
                choice === minutes
                  ? "border-brand bg-secondary text-brand"
                  : "border-transparent bg-grouped"
              )}
            >
              {formatPreset(minutes)}
            </button>
          ))}
        </div>
        <Slider
          value={choice}
          min={5}
          max={240}
          step={5}
          wheelStep={5}
          resetValue={30}
          aria-label={m.timer_length()}
          aria-valuetext={formatDuration(choice)}
          // The same length rides the thumb, as on every slider; the large
          // readout above stays for reading it across the room.
          showValue
          valueLabel={formatDuration(choice)}
          onValueChange={(value) => onChoose(value as number)}
        />
      </div>
      <Button className="h-11 w-full" onClick={onStart}>
        {m.action_start()}
      </Button>
    </>
  )
}

/**
 * A start offset from the sound's id, 0 to 0.9s, so meters on different cards
 * don't rise and fall in lockstep. Stable per sound, so a card keeps its
 * rhythm across renders.
 */
function meterPhase(id: string): number {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return (hash % 10) / 10
}

function EqBars({ phase, paused }: { phase: number; paused: boolean }) {
  return (
    <div className="flex h-3 items-end gap-0.5" aria-hidden="true">
      {[0.9, 1.2, 0.7].map((duration, i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-brand"
          style={{
            height: "100%",
            animation: `murmur-eq ${duration}s ease-in-out ${-(i * 0.3 + phase)}s infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      ))}
    </div>
  )
}

/**
 * Coalesces writes to one per animation frame. Base UI reports a drag from a
 * document-level pointermove, so a 120Hz pointer would otherwise re-render this
 * whole component 120 times a second and schedule as many gain changes. Keyed,
 * because a wheel over one slider and a drag on another can land in the same
 * frame and both have to survive.
 */
function useFrameQueue() {
  const pending = React.useRef(new Map<string, () => void>())
  // requestAnimationFrame ids are always positive, so 0 reads as "none".
  const frame = React.useRef(0)

  const flush = React.useCallback(() => {
    frame.current = 0
    const writes = [...pending.current.values()]
    pending.current.clear()
    for (const write of writes) write()
  }, [])

  const queue = React.useCallback(
    (key: string, write: () => void) => {
      pending.current.set(key, write)
      if (!frame.current) frame.current = requestAnimationFrame(flush)
    },
    [flush]
  )

  const drop = React.useCallback((key: string) => {
    pending.current.delete(key)
  }, [])

  React.useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    },
    []
  )

  return { queue, drop }
}

/**
 * Stops propagation so removing never also toggles the card it sits in. On
 * touch the hit area grows to 44px past the 22px it draws; removing comes with
 * Undo, so a near miss costs a tap, not a sound.
 */
function RemoveSoundButton({
  name,
  className,
  onRemove,
}: {
  name: string
  className?: string
  onRemove: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={m.sound_remove_named({ name })}
      title={m.action_remove()}
      className={cn(
        "relative size-[22px] shrink-0 state-layer text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-[11px]",
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        onRemove()
      }}
    >
      <HugeiconsIcon
        icon={Delete02Icon}
        strokeWidth={2}
        className="size-[12px]"
      />
    </Button>
  )
}

export function MurmurApp() {
  const boot = React.useMemo(() => readInitialState(), [])
  const initial = boot.state

  // The mixer resolves a sound id to a URL at first activation, which can
  // happen in the same tick a custom is added, so it reads a ref, kept in
  // lockstep with state by commitCustoms, rather than the state itself.
  const customsRef = React.useRef<CustomSound[]>(initial.customs)
  const blobUrls = React.useRef(new Map<string, string>())

  // The Mixer constructor is inert. The AudioContext is created lazily on the
  // first real volume change, which always originates in a user gesture.
  const mixerRef = React.useRef<Mixer | null>(null)
  if (!mixerRef.current) {
    mixerRef.current = new Mixer((id) => {
      const custom = customsRef.current.find((c) => c.id === id)
      if (custom) return custom.url ?? blobUrls.current.get(id) ?? ""
      return `${BASE}/sounds/${id}.ogg`
    })
  }
  const mixer = mixerRef.current
  const [vols, setVols] = React.useState<MixerState>(initial.vols)
  const [master, setMaster] = React.useState(initial.master)
  const [mixName, setMixName] = React.useState(initial.mixName)
  const mixTitle = mixLabel(mixName)
  const [dirty, setDirty] = React.useState(initial.dirty)
  const [view, setView] = React.useState<View>(initial.view)
  const [pane, setPane] = React.useState(initial.pane)
  /**
   * The pane's motion, as Spotify's Now Playing view moves: opened from its
   * button it slides in from the right edge, and closed it slides back out
   * the same way, kept mounted until it has. A pane that was open at launch
   * is simply there.
   */
  const [paneMotion, setPaneMotion] = React.useState<
    "still" | "entering" | "leaving"
  >("still")
  const paneToggle = React.useRef<HTMLButtonElement>(null)
  /** Hiding the pane lets go of its held rows, as closing the sheet does. */
  const showPane = (open: boolean) => {
    setPane(open)
    releaseRows()
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setPaneMotion(still ? "still" : open ? "entering" : "leaving")
  }
  const paneFits = usePaneFits()
  const [saved, setSaved] = React.useState<SavedMix[]>(initial.saved)
  const [customs, setCustoms] = React.useState<CustomSound[]>(initial.customs)
  const [playing, setPlaying] = React.useState(false)
  const [timerEnd, setTimerEnd] = React.useState(0)
  const [timerLeft, setTimerLeft] = React.useState(0)
  const [saveOpen, setSaveOpen] = React.useState(false)
  // Not persisted: a reload brings the starters back, so dismissing declutters
  // the session without losing the only invitation an empty sidebar has.
  const [allMixesOpen, setAllMixesOpen] = React.useState(false)
  const [nowPlayingOpen, setNowPlayingOpen] = React.useState(false)
  /** The All mixes row whose Rename · Duplicate · Delete strip is open. */
  const [mixActionsFor, setMixActionsFor] = React.useState<string | null>(null)
  /** Each All mixes row's ··· button, so a Delete can hand focus on. */
  const mixMoreButtons = React.useRef(new Map<string, HTMLButtonElement>())
  /** Each All mixes row, which its actions popover anchors to. */
  const mixRows = React.useRef(new Map<string, HTMLDivElement>())
  /**
   * Sounds dragged to zero in Now playing. Zero is off, so their rows would
   * vanish from under the pointer mid-drag; they stay, at zero, until the list
   * is put away or the sound is turned off or on some other way.
   */
  const [heldRows, setHeldRows] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const holdRow = (id: string) =>
    setHeldRows((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  const releaseRow = (id: string) =>
    setHeldRows((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  const releaseRows = () =>
    setHeldRows((prev) => (prev.size ? new Set() : prev))
  // One sheet at a time, and the next one waits until the first has gone:
  // opened together, their two blurred backdrops stack and flash darker.
  const afterClose = React.useRef<(() => void) | null>(null)
  const runAfterClose = () => {
    const next = afterClose.current
    afterClose.current = null
    next?.()
  }
  const [timerOpen, setTimerOpen] = React.useState(false)
  const [timerChoice, setTimerChoice] = React.useState(initial.timerChoice)
  const [addOpen, setAddOpen] = React.useState(false)
  const [saveName, setSaveName] = React.useState("")
  const [addName, setAddName] = React.useState("")
  const [addUrl, setAddUrl] = React.useState("")
  const [prefs, setPrefs] = React.useState<Prefs>(initial.prefs)
  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }))
  const prefsAreDefault = (Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]).every(
    (key) => prefs[key] === DEFAULT_PREFS[key]
  )

  // Theme is the site's, not the app's: it lives under its own localStorage key
  // so the landing page's toggle and this picker move the same setting.
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(readThemeMode)
  // Applied and committed inside the crossfade, so the new snapshot already
  // has the new colours and the picker's new selection.
  const selectTheme = (mode: ThemeMode) =>
    crossfadeTheme(() => {
      applyTheme(mode)
      flushSync(() => setThemeMode(mode))
      writeThemeMode(mode)
    })
  // The app's colour scheme and pure black night, each under its own key as
  // the theme is, and changed the same way, inside the crossfade.
  const [scheme, setScheme] = React.useState<Scheme>(readScheme)
  const [blackNight, setBlackNight] = React.useState(readBlackNight)
  const selectScheme = (next: Scheme) =>
    crossfadeTheme(() => {
      applyScheme(next)
      flushSync(() => setScheme(next))
      writeScheme(next)
    })
  const changeBlackNight = (on: boolean) =>
    crossfadeTheme(() => {
      applyBlackNight(on)
      flushSync(() => setBlackNight(on))
      writeBlackNight(on)
    })
  const appearanceIsDefault = scheme === "amber" && !blackNight
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [pageHidden, setPageHidden] = React.useState(() => document.hidden)
  React.useEffect(() => {
    const sync = () => setPageHidden(document.hidden)
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])
  const [renaming, setRenaming] = React.useState<string | null>(null)
  /** An imported sound being renamed; the rename dialog serves both. */
  const [renamingSound, setRenamingSound] = React.useState<string | null>(null)
  // When a card's menu last opened, so the tap that ends a long press on it
  // doesn't also toggle the sound underneath.
  const menuOpenedAt = React.useRef(0)
  const [renameValue, setRenameValue] = React.useState("")
  /**
   * Your own sounds whose file the browser has deleted to free space. The
   * record stays, so the tile can say so and take the file back under the
   * same id, and every saved mix that names it works again.
   */
  const [missing, setMissing] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const relinkInput = React.useRef<HTMLInputElement>(null)
  const relinkTarget = React.useRef<string | null>(null)
  /** Finishes the last Clear all, if its toast is still open. */
  const pendingClear = React.useRef<(() => void) | null>(null)
  const importInput = React.useRef<HTMLInputElement>(null)
  /** Clear all's first press arms it; it disarms itself after 3s. */
  const [dataArmed, setDataArmed] = React.useState(false)

  const pwa = usePwa()
  // Where installing is possible at all: a prompt to show, or a touch device
  // whose browser has an Add to Home Screen of its own.
  const installRow =
    !pwa.installed && (pwa.canInstall || navigator.maxTouchPoints > 0)
  const coarse = useCoarsePointer()
  // Touch shows tiles only, since list rows are built around their sliders.
  // The saved view is left as it was, for the next session with a mouse.
  const shownView: View = coarse ? "grid" : view
  const audioStarted = React.useRef(false)
  const fadeMult = React.useRef(1)
  // Ids that failed to load while offline, so reconnecting can offer them back
  // rather than leaving the user to rediscover which cards went dark.
  const offlineFailures = React.useRef(new Set<string>())
  // Seeded from boot state so a reload doesn't forget the level of a sound that
  // is already audible.
  const lastNonZero = React.useRef<MixerState>({ ...initial.vols })
  const lastMaster = React.useRef(initial.master || DEFAULT_MASTER)
  /** Bumped by the arrow-key shortcut, so the header master shows its level. */
  const [masterFlash, setMasterFlash] = React.useState(0)
  const { queue: queueFrame, drop: dropFrame } = useFrameQueue()

  const activeIds = Object.keys(vols).filter((id) => (vols[id] ?? 0) > 0)
  const timerOn = timerEnd > 0

  /**
   * Autoplay gate: the app always loads paused and pushes nothing into the
   * mixer until the first gesture, because a context created outside one starts
   * suspended and would never produce sound.
   */
  const ensureAudio = React.useCallback(() => {
    if (audioStarted.current) return
    audioStarted.current = true
    mixer.setMasterVolume(master * fadeMult.current)
    for (const [id, v] of Object.entries(vols)) {
      if (v > 0) void mixer.setVolume(id, v)
    }
  }, [mixer, master, vols])

  /** Undefined for a sound since removed, which a mix can still list. */
  const soundName = (id: string) => {
    const custom = customsRef.current.find((c) => c.id === id)
    return (
      sounds.find((s) => s.id === id)?.name ?? (custom && customName(custom))
    )
  }
  const nameFor = (id: string) => soundName(id) ?? m.sound_that()

  /**
   * setVolume reports a failed fetch or decode by silently returning the volume
   * to zero, notably on Safari, which cannot decode OGG Vorbis. Nothing else
   * observes that, so without this a dead sound leaves its card lit and the
   * header counting it while the room stays quiet.
   *
   * Dropping the id from `vols` is what corrects the card, the slider and the
   * count together: all three read from it. One toast id, because on a browser
   * that can decode none of them every sound fails and a stack helps no one.
   */
  const applyVolume = async (id: string, v: number, ramp: VolumeRamp) => {
    await mixer.setVolume(id, v, ramp)
    if (v === 0 || mixer.getVolume(id) > 0) return
    // navigator.onLine === false is definitive; true only means there is a
    // link. So it picks the wording and never gates the attempt. Without this
    // an offline user is told their browser cannot play OGG, which is a lie
    // now that the sounds are supposed to be cached.
    if (!navigator.onLine) offlineFailures.current.add(id)
    toast(
      navigator.onLine
        ? m.toast_load_failed({ name: isolate(nameFor(id)) })
        : m.toast_not_offline({ name: isolate(nameFor(id)) }),
      {
        id: "sound-load-failed",
      }
    )
    setVols((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  /**
   * "adjust" is a control the user is working right now (drag, wheel,
   * double-click reset). "fade" is a sound arriving or leaving (card toggle,
   * mix apply, reset, timer) and is what the fade preference is named after.
   */
  const changeVolume = (
    id: string,
    value: number,
    opts: { keepName?: boolean; ramp?: VolumeRamp } = {}
  ) => {
    const { keepName = false, ramp = "fade" } = opts
    ensureAudio()
    const v = Math.max(0, Math.min(1, value))
    // Paired with toggleSound's write, and neither is redundant: that one
    // covers a level that arrived without passing through here (a mix applied,
    // boot state), this one covers a slider dragged to zero, which used to come
    // back at DEFAULT_TOGGLE_VOLUME rather than where the user left it.
    if (v > 0) lastNonZero.current[id] = v
    setVols((prev) => {
      const next = { ...prev }
      if (v > 0) next[id] = v
      else delete next[id]
      return next
    })
    if (!keepName) setDirty(true)
    if (v > 0 && !playing) {
      setPlaying(true)
      mixer.setPlaying(true)
    }
    void applyVolume(id, v, ramp)
  }

  /**
   * ensureAudio runs here and not only inside the queued write: a frame
   * callback is not a user gesture, and Safari will only start an AudioContext
   * from one.
   */
  const dragVolume = (id: string, v: number) => {
    ensureAudio()
    queueFrame(`vol:${id}`, () => changeVolume(id, v, { ramp: "adjust" }))
  }

  /** Drops the queued frame first, or a stale one lands after the final value. */
  const commitVolume = (id: string, v: number) => {
    ensureAudio()
    dropFrame(`vol:${id}`)
    changeVolume(id, v, { ramp: "adjust" })
  }

  /** On touch, where a card has no slider, a drag across it sets the level. */
  const levelDrag = useLevelDrag({ onDrag: dragVolume, onCommit: commitVolume })

  /** Ref first so the mixer can resolve a brand-new import immediately. */
  const commitCustoms = (next: CustomSound[]) => {
    customsRef.current = next
    setCustoms(next)
  }

  /**
   * Adding a video already in the mixer raises the card that exists rather
   * than stacking a second player behind it, a consequence of deriving the
   * id from the video.
   */
  const addYouTube = (videoId: string) => {
    const id = ytSoundId(videoId)
    const name = addName.trim()
    const existing = customsRef.current.find((c) => c.id === id)
    setAddOpen(false)

    if (existing) {
      if (name && name !== existing.name) {
        commitCustoms(
          customsRef.current.map((c) => (c.id === id ? { ...c, name } : c))
        )
      }
      changeVolume(id, Math.max(vols[id] ?? 0, DEFAULT_TOGGLE_VOLUME), {
        keepName: true,
      })
      toast(m.toast_video_exists())
      return
    }

    commitCustoms([
      ...customsRef.current,
      {
        id,
        // Left unnamed, the player supplies the video's title.
        ...(name && { name: clampName(name, SOUND_NAME_MAX) }),
        videoId,
      },
    ])
    // Registered before the volume change, so the mixer recognises the id as a
    // stream instead of going looking for /sounds/yt_<id>.ogg.
    mixer.registerStream(id, videoId)
    changeVolume(id, DEFAULT_TOGGLE_VOLUME, { keepName: true })
  }

  const addFromUrl = () => {
    const url = addUrl.trim()
    if (!url) return
    const videoId = parseYouTubeUrl(url)
    if (videoId) {
      addYouTube(videoId)
      return
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      toast(m.toast_not_a_link())
      return
    }
    // The file's own name says what it is; the host only where there's none,
    // or two links from one site would share a name.
    const name =
      addName.trim() ||
      nameFromFile(parsed.pathname) ||
      parsed.hostname.replace(/^www\./, "")
    const id = `cu${Date.now()}`
    commitCustoms([
      ...customsRef.current,
      { id, name: clampName(name, SOUND_NAME_MAX), url },
    ])
    setAddOpen(false)
    changeVolume(id, DEFAULT_TOGGLE_VOLUME, { keepName: true })
  }

  /** A missing sound takes its file back under the same id. */
  const relinkFile = (id: string, file: File) => {
    // A node the mixer made while the file was gone holds its empty source;
    // dropping it lets the next play build one from the new file.
    mixer.unregister(id)
    blobUrls.current.set(id, URL.createObjectURL(file))
    setMissing((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    void putBlob(id, file).then((stored) => {
      if (stored) persistStorage()
    })
    toast.success(m.toast_sound_back({ name: isolate(nameFor(id)) }))
  }

  const addFromFile = (file: File) => {
    const id = `cf${Date.now()}`
    blobUrls.current.set(id, URL.createObjectURL(file))
    const name = clampName(
      addName.trim() || nameFromFile(file.name) || file.name,
      SOUND_NAME_MAX
    )
    commitCustoms([...customsRef.current, { id, name }])
    setAddOpen(false)
    changeVolume(id, DEFAULT_TOGGLE_VOLUME, { keepName: true })
    void putBlob(id, file).then((stored) => {
      if (stored) {
        persistStorage()
        commitCustoms(
          customsRef.current.map((c) =>
            c.id === id ? { ...c, hasFile: true } : c
          )
        )
      } else {
        toast(m.toast_file_not_saved())
      }
    })
  }

  const removeCustom = (id: string) => {
    if (audioStarted.current) void mixer.setVolume(id, 0)
    // Streams are dropped from the mixer outright, not just silenced: a saved
    // mix that still names this id would otherwise start a fresh player for a
    // sound the user deleted.
    if (ytVideoId(id)) mixer.unregister(id)
    const objectUrl = blobUrls.current.get(id)
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      blobUrls.current.delete(id)
    }
    void deleteBlob(id)
    setMissing((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    commitCustoms(customsRef.current.filter((c) => c.id !== id))
    setVols((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  /**
   * Remove with Undo, like every other delete. A file outlives the toast so
   * Undo can bring it back, and is deleted once the toast closes; a tab closed
   * first leaves it to the boot-time sweep.
   */
  const removeSound = (id: string) => {
    const at = customsRef.current.findIndex((c) => c.id === id)
    if (at < 0) return
    const custom = customsRef.current[at]
    const level = vols[id] ?? 0
    if (audioStarted.current) void mixer.setVolume(id, 0)
    if (ytVideoId(id)) mixer.unregister(id)
    commitCustoms(customsRef.current.filter((c) => c.id !== id))
    setVols((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    let settled = false
    const purge = () => {
      if (settled) return
      settled = true
      const objectUrl = blobUrls.current.get(id)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      blobUrls.current.delete(id)
      void deleteBlob(id)
      setMissing((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
    // One toast per sound, so removing two in a row settles neither early.
    toast(m.toast_sound_removed({ name: isolate(customName(custom)) }), {
      id: `sound-removed:${id}`,
      onAutoClose: purge,
      onDismiss: purge,
      action: {
        label: m.action_undo(),
        onClick: () => {
          if (settled) return
          settled = true
          undoRef.current.undoRemoveSound(custom, at, level)
        },
      },
    })
  }

  const undoRemoveSound = (custom: CustomSound, at: number, level: number) => {
    if (customsRef.current.some((c) => c.id === custom.id)) return
    const next = [...customsRef.current]
    next.splice(Math.min(at, next.length), 0, custom)
    commitCustoms(next)
    if (custom.videoId) mixer.registerStream(custom.id, custom.videoId)
    if (level > 0) {
      setVols((prev) => ({ ...prev, [custom.id]: level }))
      if (audioStarted.current) void applyVolume(custom.id, level, "fade")
    }
  }

  const toggleSound = (id: string) => {
    // Its file is gone; the tile asks for it instead (see renderSound).
    if (missing.has(id)) return
    releaseRow(id)
    const current = vols[id] ?? 0
    if (current > 0) {
      lastNonZero.current[id] = current
      changeVolume(id, 0)
    } else {
      changeVolume(id, lastNonZero.current[id] ?? DEFAULT_TOGGLE_VOLUME)
    }
  }

  const togglePlay = () => {
    // Nothing on, nothing to play: Space does what the disabled button does.
    if (!playing && activeIds.length === 0) return
    ensureAudio()
    const next = !playing
    setPlaying(next)
    mixer.setPlaying(next)
  }

  const changeMaster = (value: number, ramp: VolumeRamp = "adjust") => {
    ensureAudio()
    const v = Math.max(0, Math.min(1, Math.round(value * 100) / 100))
    if (v > 0) lastMaster.current = v
    setMaster(v)
    mixer.setMasterVolume(v * fadeMult.current, ramp)
  }

  /** The header's speaker: unmuting returns to the last level heard. */
  const toggleMute = () =>
    changeMaster(master > 0 ? 0 : lastMaster.current, "fade")

  const dragMaster = (v: number) => {
    ensureAudio()
    queueFrame("master", () => changeMaster(v))
  }

  const commitMaster = (v: number) => {
    ensureAudio()
    dropFrame("master")
    changeMaster(v)
  }

  const applyMix = (name: string, mix: MixerState) => {
    // Only what can play is asked to: not a file the browser deleted (its
    // tile says so), nor a sound removed since the mix was saved.
    const playable: MixerState = {}
    const lost: string[] = []
    for (const [id, v] of Object.entries(mix)) {
      if (missing.has(id)) lost.push(id)
      else if (
        CATALOG_IDS.has(id) ||
        customsRef.current.some((c) => c.id === id)
      )
        playable[id] = v
    }
    ensureAudio()
    releaseRows()
    // Walk the union so sounds dropped by the incoming mix are actively zeroed.
    const union = new Set([...Object.keys(vols), ...Object.keys(playable)])
    setVols({ ...playable })
    setMixName(name)
    setDirty(false)
    const audible = Object.keys(playable).length > 0
    if (audible) setPlaying(true)
    union.forEach((id) => void applyVolume(id, playable[id] ?? 0, "fade"))
    if (audible) mixer.setPlaying(true)
    if (lost.length) {
      toast(
        lost.length === 1
          ? m.toast_missing_one({ name: isolate(nameFor(lost[0])) })
          : m.toast_missing_many({ count: lost.length }),
        { id: "sound-missing" }
      )
    }
  }

  const allMixes = saved

  const cycleMix = (delta: number) => {
    if (allMixes.length < 2) return
    const at = allMixes.findIndex((s) => s.name === mixName)
    const next = allMixes[(at + delta + allMixes.length) % allMixes.length]
    applyMix(next.name, next.mix)
  }

  const resetMix = () => {
    releaseRows()
    for (const id of Object.keys(vols)) {
      if (audioStarted.current) void mixer.setVolume(id, 0)
    }
    setVols({})
    setDirty(true)
  }

  const renameSound = () => {
    const id = renamingSound
    const to = renameValue.trim()
    if (!id || !to) return
    commitCustoms(
      customsRef.current.map((c) => (c.id === id ? { ...c, name: to } : c))
    )
    setRenamingSound(null)
  }

  const renameMix = () => {
    const from = renaming
    const to = renameValue.trim()
    if (!from || !to) return
    setSaved((prev) =>
      prev
        .filter((s) => s.name !== to)
        .map((s) => (s.name === from ? { ...s, name: to } : s))
    )
    if (mixName === from) setMixName(to)
    setRenaming(null)
  }

  /** Desktop's context menu and the phone's All mixes, both undoable. */
  const removeSaved = (name: string) => {
    const at = saved.findIndex((s) => s.name === name)
    if (at < 0) return
    const removed = saved[at]
    setSaved((prev) => prev.filter((s) => s.name !== name))
    // Still loaded but no longer stored, so it must read as unsaved.
    if (name === mixName) setDirty(true)
    toast(m.toast_mix_deleted({ name: isolate(name) }), {
      id: "mix-deleted",
      action: {
        label: m.action_undo(),
        onClick: () => undoRef.current.undoDelete(removed, at),
      },
    })
  }

  const undoDelete = (mix: SavedMix, at: number) => {
    setSaved((prev) =>
      // A mix saved under the same name since then wins.
      prev.some((s) => s.name === mix.name)
        ? prev
        : [...prev.slice(0, at), mix, ...prev.slice(at)]
    )
    // Saved again, so a loaded copy is clean if it still matches.
    if (mix.name === mixName) setDirty(!sameMix(vols, mix.mix))
  }

  /** The mix menu's "Save changes": this saved mix takes the faders' levels. */
  const saveChanges = (name: string) => {
    const previous = saved.find((s) => s.name === name)?.mix
    if (!previous) return
    const mix: MixerState = {}
    for (const [id, v] of Object.entries(vols)) if (v > 0) mix[id] = v
    setSaved((prev) => prev.map((s) => (s.name === name ? { ...s, mix } : s)))
    setDirty(false)
    toast.success(m.toast_changes_saved({ name: isolate(name) }), {
      id: "mix-saved",
      action: {
        label: m.action_undo(),
        onClick: () => undoRef.current.undoSaveChanges(name, previous),
      },
    })
  }

  const undoSaveChanges = (name: string, previous: MixerState) => {
    setSaved((prev) =>
      prev.map((s) => (s.name === name ? { ...s, mix: previous } : s))
    )
    if (name === mixName) setDirty(!sameMix(vols, previous))
  }

  const duplicateMix = (mix: SavedMix) => {
    // Desktop leaves the active mix alone after duplicating.
    // The suffix is what tells the copies apart, so the original's name gives
    // way to it at the length limit, never the other way round.
    const copy = (suffix: string) =>
      `${clampName(mix.name, MIX_NAME_MAX - suffix.length)}${suffix}`
    let name = copy(m.mix_copy_suffix())
    for (let n = 2; saved.some((s) => s.name === name); n++)
      name = copy(m.mix_copy_suffix_numbered({ n }))
    setSaved((prev) => {
      const at = prev.findIndex((s) => s.name === mix.name)
      const next = [...prev]
      next.splice(at + 1, 0, { name, mix: { ...mix.mix } })
      return next
    })
    toast.success(m.toast_duplicated({ name: isolate(name) }))
  }

  /**
   * Everything this browser holds for Murmur, as one file: saved mixes, your
   * own sounds with their audio, and preferences. A missing file goes as its
   * record alone and comes back as a missing tile.
   */
  const exportBackup = async () => {
    const stored = await getAllBlobs()
    const blobs = new Map(
      [...stored].filter(([id]) =>
        customsRef.current.some((c) => c.id === id && c.hasFile)
      )
    )
    const file = buildBackup(
      { saved, customs: customsRef.current, prefs },
      blobs
    )
    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = url
    link.download = `murmur-backup-${new Date().toISOString().slice(0, 10)}.murmur`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    // A sound whose file isn't stored goes as its record alone; say so, or
    // the backup reads as complete when it isn't.
    const withoutFile = customsRef.current.filter(
      (c) => c.hasFile && !blobs.has(c.id)
    ).length
    if (withoutFile) {
      toast(
        m.toast_backup_partial({
          size: formatBytes(file.size),
          count: withoutFile,
        })
      )
    } else {
      toast.success(m.toast_backup_saved({ size: formatBytes(file.size) }))
    }
  }

  /**
   * Adds a backup to what is here, with Undo. Mixes already here, same name
   * and same levels, are skipped; a clashing name gets a number. Your sounds
   * are matched by id, and one whose file is missing takes the backup's.
   * Preferences stay this device's own.
   */
  const importBackup = async (file: File) => {
    let read: Awaited<ReturnType<typeof readBackup>>
    try {
      read = await readBackup(file)
    } catch (error) {
      toast.error(
        error instanceof BackupError ? error.message : m.backup_not_murmur()
      )
      return
    }
    const incoming = parseBackupData(read.contents, read.version)

    const current = customsRef.current
    const seen = new Set(current.map((c) => c.id))
    const added = incoming.customs.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    const relinked = incoming.customs
      .filter((c) => missing.has(c.id) && read.blobs.has(c.id))
      .map((c) => c.id)
    // Records before blobs: the boot-time sweep deletes any blob with none.
    commitCustoms([...current, ...added])
    for (const c of added) {
      if (c.videoId) mixer.registerStream(c.id, c.videoId)
    }
    const written: string[] = []
    const stillMissing: string[] = []
    for (const id of [
      ...added.filter((c) => c.hasFile).map((c) => c.id),
      ...relinked,
    ]) {
      const blob = read.blobs.get(id)
      if (!blob) {
        stillMissing.push(id)
        continue
      }
      mixer.unregister(id)
      blobUrls.current.set(id, URL.createObjectURL(blob))
      written.push(id)
    }
    if (written.length) {
      persistStorage()
      void Promise.all(
        written.map((id) => putBlob(id, read.blobs.get(id) as Blob))
      ).then((stored) => {
        if (stored.includes(false)) {
          toast(m.toast_files_not_saved())
        }
      })
    }
    setMissing((prev) => {
      const next = new Set(prev)
      for (const id of relinked) next.delete(id)
      for (const id of stillMissing) next.add(id)
      return next
    })

    const names = new Set(saved.map((s) => s.name))
    const addedMixes: SavedMix[] = []
    for (const mix of incoming.saved) {
      if (saved.some((x) => x.name === mix.name && sameMix(x.mix, mix.mix)))
        continue
      let name = mix.name
      for (let n = 2; names.has(name); n++) {
        name = `${clampName(mix.name, MIX_NAME_MAX - ` (${n})`.length)} (${n})`
      }
      names.add(name)
      addedMixes.push({ name, mix: mix.mix })
    }
    setSaved((prev) => [...prev, ...addedMixes])

    if (!addedMixes.length && !added.length && !relinked.length) {
      toast(m.toast_backup_nothing_new())
      return
    }
    const mixCount = m.count_mixes({ count: addedMixes.length })
    const soundCount = m.count_sounds({ count: added.length })
    toast.success(
      relinked.length
        ? m.toast_imported_relinked({
            mixes: mixCount,
            sounds: soundCount,
            files: m.count_missing_files({ count: relinked.length }),
          })
        : m.toast_imported({ mixes: mixCount, sounds: soundCount }),
      {
        id: "backup-imported",
        action: {
          label: m.action_undo(),
          onClick: () => undoRef.current.undoImport(addedMixes, added),
        },
      }
    )
  }

  /** Takes back exactly what an import added; files it brought back stay. */
  const undoImport = (mixes: SavedMix[], sounds: CustomSound[]) => {
    setSaved((prev) => prev.filter((s) => !mixes.includes(s)))
    for (const c of sounds) removeCustom(c.id)
  }

  /**
   * The one delete that asks first, since it takes everything at once: the
   * first press arms the button and the second clears. Undo stays as well.
   * The sound files outlive the toast's Undo and are only deleted once it
   * closes; a tab closed first leaves them to the boot-time sweep.
   */
  const armClearData = () => {
    setDataArmed(true)
    window.setTimeout(() => setDataArmed(false), 3000)
  }

  const clearData = () => {
    setDataArmed(false)
    // A second clear replaces the first one's toast without closing it, so
    // the first is settled here or its files would stay until the next boot.
    pendingClear.current?.()
    const cleared: ClearedData = {
      saved,
      customs: customsRef.current,
      vols,
    }
    for (const c of cleared.customs) {
      if (audioStarted.current) void mixer.setVolume(c.id, 0)
      if (c.videoId) mixer.unregister(c.id)
    }
    commitCustoms([])
    setSaved([])
    setVols((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => CATALOG_IDS.has(id))
      )
    )
    let settled = false
    const purge = () => {
      if (settled) return
      settled = true
      for (const c of cleared.customs) {
        const url = blobUrls.current.get(c.id)
        if (url) URL.revokeObjectURL(url)
        blobUrls.current.delete(c.id)
        void deleteBlob(c.id)
      }
    }
    pendingClear.current = purge
    toast.success(m.toast_cleared(), {
      id: "data-cleared",
      onAutoClose: purge,
      onDismiss: purge,
      action: {
        label: m.action_undo(),
        onClick: () => {
          if (settled) return
          settled = true
          undoRef.current.undoClear(cleared)
        },
      },
    })
  }

  const undoClear = (cleared: ClearedData) => {
    // Anything saved or added since the clear stays alongside.
    setSaved((prev) => [
      ...cleared.saved,
      ...prev.filter((s) => !cleared.saved.some((c) => c.name === s.name)),
    ])
    commitCustoms([
      ...cleared.customs,
      ...customsRef.current.filter(
        (s) => !cleared.customs.some((c) => c.id === s.id)
      ),
    ])
    const levels: MixerState = {}
    for (const c of cleared.customs) {
      const v = cleared.vols[c.id]
      if (v) levels[c.id] = v
    }
    // clearData unregistered the YouTube streams; they have to be known to
    // the mixer again before a level can reach them.
    for (const c of cleared.customs) {
      if (c.videoId) mixer.registerStream(c.id, c.videoId)
    }
    setVols((prev) => ({ ...prev, ...levels }))
    if (audioStarted.current) {
      for (const [id, v] of Object.entries(levels))
        void applyVolume(id, v, "fade")
    }
  }

  const saveMix = () => {
    const name = saveName.trim() || saveSuggestion
    if (!name) return
    const mix: MixerState = {}
    for (const [id, v] of Object.entries(vols)) if (v > 0) mix[id] = v
    setSaved((prev) => [...prev.filter((s) => s.name !== name), { name, mix }])
    setMixName(name)
    setDirty(false)
    setSaveOpen(false)
    toast.success(m.toast_saved({ name: isolate(name) }))
  }

  /** What a bug report needs: which build, and which browser rendered it. */
  const copyBuildInfo = () => {
    const info = `Murmur ${__APP_VERSION__}\n${navigator.userAgent}`
    if (!navigator.clipboard) {
      toast(m.toast_no_clipboard())
      return
    }
    navigator.clipboard.writeText(info).then(
      () => toast.success(m.toast_build_copied()),
      () => toast(m.toast_build_copy_failed())
    )
  }

  /**
   * Copies a link that rebuilds `levels` under `name`, or with no name for an
   * untitled mix, which the recipient's app then calls a shared one in their
   * own language. The header shares the mix on the faders; a saved mix's menu
   * shares that mix without loading it.
   */
  const shareMix = (
    name: string | undefined,
    levels: MixerState,
    current: boolean
  ) => {
    const mix: MixerState = {}
    for (const [id, v] of Object.entries(levels)) {
      // YouTube sounds travel: the id carries the whole reference. Files and
      // links don't. One is a blob only this browser holds, the other may not
      // be reachable from anywhere else.
      if (v > 0 && (CATALOG_IDS.has(id) || ytVideoId(id))) {
        mix[id] = Math.round(v * 100) / 100
      }
    }
    const droppedCustoms = customs.some(
      (c) => !c.videoId && (levels[c.id] ?? 0) > 0
    )
    const fragment = encodeMix(mix)
    if (!fragment) {
      toast(
        droppedCustoms
          ? current
            ? m.share_only_own_playing()
            : m.share_only_own_mix()
          : current
            ? m.share_nothing_playing()
            : m.share_mix_empty()
      )
      return
    }
    // v=2: the numbers are levels. An older link has none and carries gains.
    const url = `${window.location.origin}${window.location.pathname}#mix=${fragment}&v=2${name ? `&n=${encodeURIComponent(name)}` : ""}`
    const done = () =>
      droppedCustoms
        ? toast.success(m.toast_link_copied_partial())
        : toast.success(m.toast_link_copied())
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done, done)
    } else {
      window.history.replaceState(null, "", url)
      toast(m.toast_link_in_address_bar())
    }
  }

  const share = () =>
    shareMix(typeof mixName === "string" ? mixName : undefined, vols, true)

  const startTimer = (minutes: number) => {
    fadeMult.current = 1
    setTimerOpen(false)
    setTimerEnd(Date.now() + minutes * 60_000)
    setTimerLeft(minutes * 60)
  }

  /** Off before its time: the level comes back if the fade had begun. */
  const stopTimer = () => {
    fadeMult.current = 1
    setTimerOpen(false)
    setTimerEnd(0)
    setTimerLeft(0)
    if (audioStarted.current) mixer.setMasterVolume(master)
  }

  /**
   * More time on a running timer. During the fade-out this brings the level
   * back: the interval below works the fade from the time left.
   */
  const extendTimer = (minutes: number) => {
    setTimerEnd((end) => end + minutes * 60_000)
    setTimerLeft((left) => left + minutes * 60)
  }

  React.useEffect(() => {
    if (!timerEnd) return
    const id = window.setInterval(() => {
      const left = Math.max(0, (timerEnd - Date.now()) / 1000)
      fadeMult.current = left <= prefs.sleepFade ? left / prefs.sleepFade : 1
      if (audioStarted.current) mixer.setMasterVolume(master * fadeMult.current)
      if (left <= 0) {
        fadeMult.current = 1
        setPlaying(false)
        setTimerEnd(0)
        setTimerLeft(0)
        if (audioStarted.current) {
          mixer.setPlaying(false)
          mixer.setMasterVolume(master)
        }
      } else {
        setTimerLeft(left)
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [timerEnd, master, mixer, prefs.sleepFade])

  // The web's RestoreSavedAsync. Every saved YouTube sound has to be known to
  // the mixer before a gesture can ask for it, and this creates no players:
  // the first rise above zero does that, so launch spends no network on a
  // sound nobody plays.
  React.useEffect(() => {
    for (const c of customsRef.current) {
      if (c.videoId) mixer.registerStream(c.id, c.videoId)
    }
  }, [mixer])

  // A stream can fail, or learn its own name, long after the call that started
  // it, so both come back through the mixer rather than a return value.
  React.useEffect(() => {
    mixer.onStreamTitle = (id, title) => {
      commitCustoms(
        customsRef.current.map((c) =>
          // Only fills a missing name: a name the user typed is theirs.
          c.id === id && c.name === undefined
            ? { ...c, name: clampName(title, SOUND_NAME_MAX) }
            : c
        )
      )
    }
    // The mixer has already zeroed the sound by the time this runs; what's
    // left is to catch React's copy of the volume up with it.
    mixer.onStreamError = (id, message) => {
      if (!navigator.onLine) offlineFailures.current.add(id)
      toast(message)
      setVols((prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
    return () => {
      mixer.onStreamTitle = null
      mixer.onStreamError = null
    }
  }, [mixer])

  /**
   * Puts a whole mix back without touching play state, for the Undos below.
   * `skip` names sounds already silenced some other way.
   */
  const restoreMix = (
    previous: LinkArrival["previous"],
    skip: string[] = []
  ) => {
    // A link's "previous" is read at boot, before missing files are known,
    // so a sound whose file is gone must not come back lit.
    const restored = Object.fromEntries(
      Object.entries(previous.vols).filter(([id]) => !missing.has(id))
    )
    if (audioStarted.current) {
      for (const id of new Set([
        ...Object.keys(vols),
        ...Object.keys(restored),
      ])) {
        if (skip.includes(id)) continue
        void applyVolume(id, restored[id] ?? 0, "fade")
      }
    }
    setVols(restored)
    setMixName(previous.mixName)
    setDirty(previous.dirty)
  }

  const undoLink = (link: LinkArrival) => {
    for (const id of link.addedVideos) removeCustom(id)
    // removeCustom already silenced and unregistered these.
    restoreMix(link.previous, link.addedVideos)
  }

  // Latest-ref: an Undo can fire after other changes, and has to walk the
  // volumes as they are then, not as they were when its toast went up.
  const undoRef = React.useRef({
    undoLink,
    restoreMix,
    undoDelete,
    undoSaveChanges,
    undoClear,
    undoRemoveSound,
    undoImport,
  })
  React.useEffect(() => {
    undoRef.current = {
      undoLink,
      restoreMix,
      undoDelete,
      undoSaveChanges,
      undoClear,
      undoRemoveSound,
      undoImport,
    }
  })

  /**
   * The card menu's "Play only this": every other sound off, this one on at
   * its level (or the last it had, or 70%), playing, with Undo.
   */
  const playOnly = (id: string) => {
    const before = { vols, mixName, dirty }
    const level = vols[id] || lastNonZero.current[id] || DEFAULT_TOGGLE_VOLUME
    ensureAudio()
    for (const [other, v] of Object.entries(vols)) {
      if (other === id) continue
      lastNonZero.current[other] = v
      void applyVolume(other, 0, "fade")
    }
    lastNonZero.current[id] = level
    void applyVolume(id, level, "fade")
    setVols({ [id]: level })
    setDirty(true)
    const wasPlaying = playing
    if (!playing) {
      setPlaying(true)
      mixer.setPlaying(true)
    }
    toast(m.toast_playing_only({ name: isolate(nameFor(id)) }), {
      id: "play-only",
      action: {
        label: m.action_undo(),
        onClick: () => {
          undoRef.current.restoreMix(before)
          // This started playback, so undoing it pauses again.
          if (!wasPlaying) {
            setPlaying(false)
            mixer.setPlaying(false)
          }
        },
      },
    })
  }

  /** Now playing's "Turn all off". No confirmation, since Undo is right there. */
  const turnAllOff = () => {
    const before = { vols, mixName, dirty }
    resetMix()
    toast(m.toast_turned_off(), {
      id: "turn-all-off",
      action: {
        label: m.action_undo(),
        onClick: () => undoRef.current.restoreMix(before),
      },
    })
  }

  React.useEffect(() => {
    const link = boot.link
    if (!link) return
    // Consumed. Left in the address bar, every reload would apply the link
    // again over whatever the user has changed since.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    )

    const added = link.addedVideos.length
    const videos = m.count_youtube_sounds({ count: added })
    const message = link.replacedUnsaved
      ? added
        ? m.link_replaced_added({ videos })
        : m.link_replaced()
      : added
        ? m.link_added({ videos })
        : null
    if (!message) return
    toast(message, {
      id: "shared-link",
      duration: 10_000,
      action: {
        label: m.action_undo(),
        onClick: () => undoRef.current.undoLink(link),
      },
    })
  }, [boot.link])

  // Restore file imports from IndexedDB. Blobs with no metadata are deleted;
  // metadata whose blob is gone (the browser evicted it) stays, marked missing.
  React.useEffect(() => {
    let cancelled = false
    void getAllBlobs().then((blobs) => {
      if (cancelled) return
      // A dev fixture's customs aren't the user's, so its blobs aren't orphans.
      if (!DEV_FIXTURE) {
        for (const id of blobs.keys()) {
          if (!customsRef.current.some((c) => c.id === id)) void deleteBlob(id)
        }
      }
      const lost = new Set<string>()
      for (const c of customsRef.current) {
        if (!c.hasFile) continue
        const blob = blobs.get(c.id)
        if (blob) blobUrls.current.set(c.id, URL.createObjectURL(blob))
        else lost.add(c.id)
      }
      if (!lost.size) return
      setMissing(lost)
      setVols((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => !lost.has(id)))
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      savePersisted({
        vols,
        master,
        mixName,
        dirty,
        view,
        pane,
        timerChoice,
        saved,
        customs,
        prefs,
      })
    }, 250)
    return () => window.clearTimeout(id)
  }, [
    vols,
    master,
    mixName,
    dirty,
    view,
    pane,
    timerChoice,
    saved,
    customs,
    prefs,
  ])

  // ThemeBootstrap resolved the theme before paint, so this only re-resolves
  // after a picker change, and tracks the OS while the preference is 'system'.
  React.useEffect(() => {
    applyTheme(themeMode)
    if (themeMode !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [themeMode])

  // The browser drops the lock on tab hide, hence the visibilitychange re-acquire.
  React.useEffect(() => {
    if (!prefs.keepAwake || !playing || !("wakeLock" in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let released = false
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen")
      } catch {
        /* Denied (background tab, battery saver). Nothing to do. */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void acquire()
    }
    void acquire()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      released = true
      document.removeEventListener("visibilitychange", onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [prefs.keepAwake, playing])

  React.useEffect(() => {
    mixer.fadeInMs = prefs.fadeMs
  }, [mixer, prefs.fadeMs])

  // iOS gives Web Audio the "ambient" session unless told otherwise, so the
  // silent switch mutes it and locking the screen stops it: the bedside use
  // case, gone. "playback" survives both but pauses other apps' audio, which
  // is why mixing with them is the opt-in. Safari only; elsewhere there is no
  // audioSession and this does nothing.
  React.useEffect(() => {
    const session = (navigator as { audioSession?: { type: string } })
      .audioSession
    if (session) session.type = prefs.mixWithOthers ? "ambient" : "playback"
  }, [prefs.mixWithOthers])

  // Said once, up front, rather than as one card failing at a time.
  React.useEffect(() => {
    if (canPlayOgg()) return
    toast(m.toast_ogg_unsupported(), {
      id: "ogg-unsupported",
      duration: Infinity,
    })
  }, [])

  // "Pause in background tabs": stop on hide, resume only if we were the one
  // who paused, so a deliberate pause isn't undone on return. A ref, because
  // pausing changes `playing` and re-runs the effect, which would reset a
  // local flag before the tab comes back.
  const pausedByUs = React.useRef(false)
  React.useEffect(() => {
    if (!prefs.pauseHidden) return
    const onVisibility = () => {
      if (document.hidden) {
        if (playing) {
          pausedByUs.current = true
          setPlaying(false)
          mixer.setPlaying(false)
        }
      } else if (pausedByUs.current) {
        pausedByUs.current = false
        setPlaying(true)
        mixer.setPlaying(true)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [prefs.pauseHidden, playing, mixer])

  React.useEffect(() => {
    document.title = playing ? `${mixTitle} · Murmur` : "Murmur"
  }, [playing, mixTitle])

  // A waiting worker never takes over on its own: the reload it costs would cut
  // a mix mid-play, and with client:only that reload is a 600 KB parse, a fresh
  // AudioContext and a re-decode of every active buffer. Ignoring the toast is
  // a valid answer; workbox-window re-fires `waiting` on the next launch, so
  // the offer returns without anything having to remember it was dismissed.
  const { needRefresh, updateNow } = pwa
  React.useEffect(() => {
    if (!needRefresh) return
    toast(m.toast_update_ready(), {
      id: "app-update",
      duration: Infinity,
      action: { label: m.action_reload(), onClick: () => void updateNow() },
    })
  }, [needRefresh, updateNow])

  // Latest-ref so the listener below can stay mounted across renders. It would
  // otherwise be added and removed once per frame during a slider drag.
  const changeVolumeRef = React.useRef(changeVolume)
  React.useEffect(() => {
    changeVolumeRef.current = changeVolume
  })

  React.useEffect(() => {
    const onOnline = () => {
      const ids = [...offlineFailures.current]
      if (!ids.length) return
      // Cleared here, so the offer appears once per outage rather than on
      // every flap of a bad connection.
      offlineFailures.current.clear()
      toast(m.toast_back_online(), {
        id: "back-online",
        action: {
          label: m.action_play_back({ count: ids.length }),
          onClick: () => {
            for (const id of ids) {
              changeVolumeRef.current(
                id,
                lastNonZero.current[id] ?? DEFAULT_TOGGLE_VOLUME
              )
            }
          },
        },
      })
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [])

  // Latest-ref, so the session below is rebuilt when what the OS shows
  // changes, not on every frame of a slider drag.
  const mediaActions = React.useRef({ togglePlay, cycleMix })
  React.useEffect(() => {
    mediaActions.current = { togglePlay, cycleMix }
  })

  // Next/Previous cycle presets, mirroring how the desktop maps SMTC.
  React.useEffect(() => {
    if (!("mediaSession" in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Murmur",
      artist: mixTitle,
      album: m.media_album(),
      // The "any" icons, not the maskable pair, which a media notification
      // would crop wrongly. Both are precached, because the OS fetches these
      // at a moment when the app may well be offline.
      artwork: [
        {
          src: `${BASE}/icons/icon-192.png`,
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: `${BASE}/icons/icon-512.png`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    })
    navigator.mediaSession.playbackState = playing ? "playing" : "paused"
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => !playing && mediaActions.current.togglePlay()],
      ["pause", () => playing && mediaActions.current.togglePlay()],
      ["nexttrack", () => mediaActions.current.cycleMix(1)],
      ["previoustrack", () => mediaActions.current.cycleMix(-1)],
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        /* Browsers throw on actions they don't implement; the rest still bind. */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          /* Same: an action that never bound cannot be unbound. */
        }
      }
    }
  }, [mixTitle, playing])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      // Desktop accelerators. Ctrl+P is the browser's print shortcut, so it
      // has to be actively claimed to match the desktop's Preferences binding.
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase()
        if (key === "r" && !e.shiftKey) {
          e.preventDefault()
          if (Object.keys(vols).length) turnAllOff()
        } else if (key === "i") {
          e.preventDefault()
          setAddName("")
          setAddUrl("")
          setAddOpen(true)
        } else if (key === "g") {
          e.preventDefault()
          setView(view === "grid" ? "list" : "grid")
        } else if (key === "p") {
          e.preventDefault()
          setSettingsOpen((o) => !o)
        }
        return
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === ",") {
        e.preventDefault()
        setSettingsOpen((o) => !o)
        return
      }
      if (e.key === " ") {
        e.preventDefault()
        togglePlay()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        changeMaster(master + 0.05)
        setMasterFlash((n) => n + 1)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        changeMaster(master - 0.05)
        setMasterFlash((n) => n + 1)
      } else if (e.key === "s" || e.key === "S") {
        share()
      } else if (e.key === "t" || e.key === "T") {
        setTimerOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // The phone bar shows the countdown in its own timer button, so it takes
  // playStatus; the header has no such button and gets the full line.
  const playStatus =
    activeIds.length === 0
      ? m.status_nothing()
      : playing
        ? m.status_playing({ count: activeIds.length })
        : m.status_paused({ count: activeIds.length })
  const status = timerOn
    ? m.status_sleeps({ status: playStatus, time: formatCountdown(timerLeft) })
    : playStatus

  // A name from the sounds, shown in the empty field and used if it's left
  // empty. Not filled in: iOS Safari often ignores the select-on-focus, which
  // left the keyboard typing onto the end of it.
  const saveSuggestion = saveOpen
    ? suggestMixName(vols, soundName, (name) =>
        saved.some((s) => s.name === name)
      )
    : ""
  const openSaveDialog = () => {
    // A clean mix with a name (a shared one) still starts from its own name.
    setSaveName(!dirty && typeof mixName === "string" ? mixName : "")
    setSaveOpen(true)
  }
  // What the level meters claim is sound reaching the speakers, so they stop
  // when it doesn't: muted, or once the sleep timer starts fading the mix out.
  const audible =
    playing && master > 0 && !(timerOn && timerLeft <= prefs.sleepFade)
  // And they hold still while nobody can see them: a hidden page, or a dialog
  // whose blurred backdrop covers the grid, where every frame they animate
  // also costs a blur.
  const anyDialogOpen =
    nowPlayingOpen ||
    allMixesOpen ||
    saveOpen ||
    addOpen ||
    timerOpen ||
    settingsOpen ||
    renaming !== null ||
    renamingSound !== null
  const metersPaused = pageHidden || anyDialogOpen

  // Nothing new to save when the loaded mix is a saved one, unedited.
  const canSave =
    activeIds.length > 0 && (dirty || !saved.some((s) => s.name === mixName))

  // Starters stand in for an empty list, so they return if every mix is deleted.

  // Base UI's long press doesn't swallow the click that can follow it, so a
  // trigger that also acts on a tap ignores one landing just after its menu
  // opened: the cards, the phone's mix chips, the tablet's mix name.
  const noteMenuOpen = (open: boolean) => {
    if (open) menuOpenedAt.current = performance.now()
  }
  const guardAfterMenu = (act: () => void) => () => {
    if (performance.now() - menuOpenedAt.current < 600) return
    act()
  }

  /** A sound's menu, the same on its card and on its Now playing row. */
  const soundMenu = (sound: RenderableSound, removable: boolean) => {
    const volume = vols[sound.id] ?? 0
    const active = volume > 0
    const lost = missing.has(sound.id)
    const videoId = ytVideoId(sound.id)
    return (
      <ContextMenuContent>
        <ContextMenuItem
          // Already the only sound playing, so there is nothing to turn off.
          disabled={lost || (playing && active && activeIds.length === 1)}
          onClick={() => playOnly(sound.id)}
        >
          <HugeiconsIcon icon={HeadphonesIcon} strokeWidth={2} />
          {m.action_play_only()}
        </ContextMenuItem>
        {/* Disabled rather than hidden, as M3 and Windows menus do, so the
            menu keeps its shape and says what it can do. */}
        <ContextMenuItem
          disabled={
            deviceSetsLevel(sound.id) ||
            !active ||
            volume === DEFAULT_TOGGLE_VOLUME
          }
          onClick={() => changeVolume(sound.id, DEFAULT_TOGGLE_VOLUME)}
        >
          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
          {m.action_reset_level()}
        </ContextMenuItem>
        {removable && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                setRenameValue(sound.name)
                setRenamingSound(sound.id)
              }}
            >
              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
              {m.action_rename_ellipsis()}
            </ContextMenuItem>
            {videoId && (
              <ContextMenuItem
                onClick={() =>
                  window.open(
                    `https://www.youtube.com/watch?v=${videoId}`,
                    "_blank",
                    "noopener"
                  )
                }
              >
                <HugeiconsIcon icon={YoutubeIcon} strokeWidth={2} />
                {m.action_open_youtube()}
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => removeSound(sound.id)}
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              {m.action_remove()}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    )
  }

  /** A Now playing row's sound as its card renders it, so the menus agree. */
  const soundById = (id: string): [RenderableSound, boolean] | null => {
    const builtIn = sounds.find((s) => s.id === id)
    if (builtIn) return [builtIn, false]
    const custom = customs.find((c) => c.id === id)
    if (!custom) return null
    const iconPath = custom.videoId ? VIDEO_ICON : MUSIC_ICON
    return [{ id, name: customName(custom), iconPath }, true]
  }

  /** A saved mix's menu: the sidebar's, the phone strip's and the header's. */
  const mixMenu = (mix: SavedMix) => {
    const loaded = mix.name === mixName
    return (
      <ContextMenuContent>
        <ContextMenuItem
          disabled={!(loaded && dirty)}
          onClick={() => saveChanges(mix.name)}
        >
          <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} />
          {m.action_save_changes()}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => shareMix(mix.name, mix.mix, false)}>
          <HugeiconsIcon icon={Share01Icon} strokeWidth={2} />
          {m.action_share()}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            setRenameValue(mix.name)
            setRenaming(mix.name)
          }}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
          {m.action_rename_ellipsis()}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateMix(mix)}>
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
          {m.action_duplicate()}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => removeSaved(mix.name)}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          {m.action_delete()}
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }

  // The header's mix name: a saved mix's own menu, or what an unsaved one
  // can do, the header's actions in its words.
  const currentSaved = saved.find((s) => s.name === mixName)
  const currentMixMenu = currentSaved ? (
    mixMenu(currentSaved)
  ) : (
    <ContextMenuContent>
      <ContextMenuItem disabled={!canSave} onClick={openSaveDialog}>
        <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} />
        {m.action_save_mix_ellipsis()}
      </ContextMenuItem>
      <ContextMenuItem onClick={share}>
        <HugeiconsIcon icon={Share01Icon} strokeWidth={2} />
        {m.action_share()}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={activeIds.length === 0} onClick={turnAllOff}>
        <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
        {m.action_turn_all_off()}
      </ContextMenuItem>
    </ContextMenuContent>
  )

  // A row holds the pressed layer while its menu is open, as a card does, so
  // the menu reads as belonging to it. Pulled out by its own padding, so the
  // row's content stays where it was.
  const rowTrigger = (
    <div className="-mx-2 rounded-m3-md px-2 transition-colors data-popup-open:bg-foreground/[0.06]" />
  )

  // Now playing's body, shared by the phone sheet and the desktop pane: the
  // master, every sound that's on, and what to do with them. In the grid's
  // order, so a row keeps its place however the sounds were turned on, and a
  // sound taken to zero and back up comes back where it was. The stragglers
  // line is a guard: every id that can be on is a built-in or one of yours.
  const knownOrder = [...CATALOG_ORDER, ...customs.map((c) => c.id)]
  const nowPlayingIds = [
    ...knownOrder.filter((id) => (vols[id] ?? 0) > 0 || heldRows.has(id)),
    ...activeIds.filter((id) => !knownOrder.includes(id)),
  ]
  const nowPlayingRows = (
    <div className="flex flex-col">
      <ContextMenu>
        <ContextMenuTrigger render={rowTrigger}>
          <NowPlayingRow
            icon={
              <HugeiconsIcon
                icon={VolumeHighIcon}
                strokeWidth={2}
                className="size-[18px]"
              />
            }
            name={m.master()}
            level={master}
            resetLevel={DEFAULT_MASTER}
            onDrag={dragMaster}
            onCommit={commitMaster}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={master === DEFAULT_MASTER}
            onClick={() => changeMaster(DEFAULT_MASTER)}
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
            {m.action_reset_level()}
          </ContextMenuItem>
          <ContextMenuItem onClick={toggleMute}>
            <HugeiconsIcon
              icon={master > 0 ? VolumeOffIcon : VolumeHighIcon}
              strokeWidth={2}
            />
            {master > 0 ? m.action_mute() : m.action_unmute()}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Separator className="my-1" />
      {nowPlayingIds.length ? (
        nowPlayingIds.map((id) => {
          const found = soundById(id)
          const row = (
            <NowPlayingRow
              icon={
                <SoundIcon
                  path={
                    sounds.find((s) => s.id === id)?.iconPath ??
                    (ytVideoId(id) ? VIDEO_ICON : MUSIC_ICON)
                  }
                  size={18}
                  className={
                    (vols[id] ?? 0) > 0 ? "text-brand" : "text-muted-foreground"
                  }
                />
              }
              name={nameFor(id)}
              level={vols[id] ?? 0}
              note={deviceSetsLevel(id) ? m.sound_device_level() : undefined}
              resetLevel={DEFAULT_TOGGLE_VOLUME}
              onDrag={(v) => {
                if (v === 0) holdRow(id)
                dragVolume(id, v)
              }}
              onCommit={(v) => {
                if (v === 0) holdRow(id)
                commitVolume(id, v)
              }}
              // A row held at zero is already off, so its button only lets it go.
              onTurnOff={() =>
                (vols[id] ?? 0) > 0 ? toggleSound(id) : releaseRow(id)
              }
            />
          )
          return found ? (
            <ContextMenu key={id}>
              <ContextMenuTrigger render={rowTrigger}>{row}</ContextMenuTrigger>
              {soundMenu(...found)}
            </ContextMenu>
          ) : (
            <React.Fragment key={id}>{row}</React.Fragment>
          )
        })
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {m.now_playing_empty()}
        </p>
      )}
    </div>
  )
  const nowPlayingActions = (onSave: () => void) => (
    <>
      {canSave ? (
        <Button variant="outline" className="h-11 px-5" onClick={onSave}>
          {m.action_save_mix()}
        </Button>
      ) : (
        <span />
      )}
      <Button
        variant="ghost"
        className="h-11 px-5"
        disabled={activeIds.length === 0}
        onClick={turnAllOff}
      >
        {m.action_turn_all_off()}
      </Button>
    </>
  )

  const renderSound = (sound: RenderableSound, removable = false) => {
    const volume = vols[sound.id] ?? 0
    const active = volume > 0
    const pct = Math.round(volume * 100)
    // A file the browser deleted: the tile stays, says so, and takes it back.
    const lost = missing.has(sound.id)
    const fixedLevel = deviceSetsLevel(sound.id)
    const dragsLevel = coarse && !lost && !fixedLevel
    const dragged = levelDrag.draggingId === sound.id

    // Stop pointer events from the slider bubbling into the card's toggle.
    const sliderGuard = {
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
      onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
    }

    const slider = (
      <Slider
        value={pct}
        min={0}
        max={100}
        step={1}
        wheelStep={5}
        resetValue={Math.round(DEFAULT_TOGGLE_VOLUME * 100)}
        aria-label={m.sound_volume({ name: sound.name })}
        aria-valuetext={formatPercent(pct)}
        showValue
        onValueChange={(value) => dragVolume(sound.id, (value as number) / 100)}
        onValueCommitted={(value) =>
          commitVolume(sound.id, (value as number) / 100)
        }
      />
    )

    // Card draws its edge as a ring, not a border, so hover goes on the ring.
    // A press settles the card slightly, under a finger or a mouse: the
    // answer to a tap before the sound arrives. Not when the press is on the
    // card's slider or its remove button, which aren't the card.
    // While its menu is open the card holds M3's 10% pressed layer, so the
    // menu reads as belonging to it.
    // On is the raised fill alone, with the amber left to the icon, slider
    // and meters inside: an amber edge as well, on every card that's on,
    // made a playing mix the loudest thing on the page.
    const tileState = cn(
      "rounded-lg shadow-level-1 [transition:background-color_150ms_ease,box-shadow_150ms_ease,scale_120ms_var(--ease-out)] hover:ring-brand/40 data-popup-open:bg-[color-mix(in_srgb,var(--tile-bg),currentColor_10%)] dark:hover:ring-brand/40 motion-safe:[&:active:not(:has([data-slot=slider]:active,button:active))]:scale-[0.98]",
      active
        ? "bg-secondary [--tile-bg:var(--secondary)]"
        : "[--tile-bg:var(--card)]"
    )
    // With the card, not after it: an icon that snaps while its card fades
    // reads as two changes.
    const iconState = cn(
      "[transition:color_150ms_ease]",
      active ? "text-brand" : "text-muted-foreground"
    )

    const askRemove = () => removeSound(sound.id)
    const menu = soundMenu(sound, removable)
    // Click and Enter both come here: a missing sound asks for its file.
    const activate = () => {
      if (lost) {
        relinkTarget.current = sound.id
        relinkInput.current?.click()
        return
      }
      toggleSound(sound.id)
    }
    const toggle = guardAfterMenu(activate)

    if (shownView === "list") {
      return (
        <ContextMenu key={sound.id} onOpenChange={noteMenuOpen}>
          <ContextMenuTrigger
            render={
              <Card
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") activate()
                }}
                className={cn(
                  "group flex cursor-pointer flex-row items-center gap-3 px-4 py-3",
                  tileState
                )}
              />
            }
          >
            <SoundIcon path={sound.iconPath} size={17} className={iconState} />
            <span
              className={cn(
                "w-28 shrink-0 truncate text-xs sm:w-40 lg:w-56",
                active ? "font-semibold" : "font-medium"
              )}
              dir="auto"
              title={sound.name}
            >
              {sound.name}
            </span>
            {lost ? (
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {m.sound_missing_note()}
              </span>
            ) : (
              <>
                <div className="min-w-0 flex-1" {...sliderGuard}>
                  {slider}
                </div>
              </>
            )}
            {removable && (
              <RemoveSoundButton name={sound.name} onRemove={askRemove} />
            )}
          </ContextMenuTrigger>
          {menu}
        </ContextMenu>
      )
    }

    return (
      <ContextMenu key={sound.id} onOpenChange={noteMenuOpen}>
        <ContextMenuTrigger
          render={
            <Card
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === "Enter") activate()
              }}
              {...(dragsLevel && levelDrag.bind(sound.id, volume))}
              // Across is the level, down is the grid's scroll, and a pinch
              // still zooms.
              className={cn(
                "group cursor-pointer gap-0 p-3",
                dragsLevel && "touch-pan-y touch-pinch-zoom",
                tileState
              )}
            />
          }
        >
          <div className="flex items-start gap-1.5">
            <SoundIcon path={sound.iconPath} size={19} className={iconState} />
            <div className="flex-1" />
            {active && audible && prefs.eq && (
              <EqBars phase={meterPhase(sound.id)} paused={metersPaused} />
            )}
            {removable && (
              <RemoveSoundButton
                name={sound.name}
                className="-mt-1 -mr-1.5"
                onRemove={askRemove}
              />
            )}
          </div>
          {/* The name, and a missing file's badge beside it, inside one line
            box so the card still measures the 83px the "Add sound" tile
            hard-codes. The level's number rides the thumb or the level bar. */}
          <div className="mt-2 mb-3 flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs",
                active ? "font-semibold" : "font-medium"
              )}
              dir="auto"
              title={sound.name}
            >
              {sound.name}
            </span>
            {lost && (
              <span className="shrink-0 text-[0.6875rem] text-destructive">
                {m.sound_missing_badge()}
              </span>
            )}
          </div>
          {lost ? (
            // The slider's own 4px box, so the card keeps its height.
            <div
              aria-hidden="true"
              className="h-1 rounded-full border-t border-dashed border-outline"
            />
          ) : fixedLevel ? (
            // An iPhone is always coarse, so this is the bar, not a slider.
            // Full while on: it plays at whatever the phone's volume is.
            <LevelBar level={active ? 1 : 0} />
          ) : coarse ? (
            <LevelBar
              level={volume}
              live={dragged}
              showValue
              valueShown={levelDrag.showingId === sound.id}
            />
          ) : (
            <div {...sliderGuard}>{slider}</div>
          )}
        </ContextMenuTrigger>
        {menu}
      </ContextMenu>
    )
  }

  return (
    // SidebarProvider is the app root rather than a wrapper around it: Sidebar
    // reads its context even under collapsible="none", and with the inset
    // variant inside, it paints the frame the header and sidebar share.
    <SidebarProvider
      // select-none because this reads as an app, not a document: dragging a
      // slider or a card would otherwise smear a text selection across the
      // labels beside it. Dialogs and toasts portal to <body>, outside this
      // subtree, so anything genuinely worth copying stays selectable.
      // The side insets keep a landscape phone's notch off the brand and grid;
      // viewport-fit=cover would otherwise draw them underneath it.
      className="h-dvh flex-col overflow-hidden grain pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-foreground select-none"
      // 15rem, not the component's 16rem default: the sidebar was 240px and
      // the sound grid's column count is tuned against the width that leaves.
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      {/* From md up the header sits on the frame beside the sidebar, the two
          reading as one title bar over the inset panel. On a phone there is
          no panel, so it keeps its own surface and rule. */}
      <header className="@container flex shrink-0 items-center border-b bg-background grain py-3 wide:border-b-0 wide:bg-transparent wide:bg-none">
        {/* Exactly the sidebar's width, so the controls start where the
            panel does; pl-5 is the sidebar's own inset. */}
        <div className="flex shrink-0 items-center gap-2 pl-4 @max-5xl:w-auto! wide:w-(--sidebar-width) wide:pl-5">
          <BrandMark />
          <span className="font-serif text-[1.0625rem]">Murmur</span>
        </div>

        {/* px-6 is the panel's p-6, so the play button and Share sit on the
            grid's content edges. */}
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 medium:px-6">
          {/* Play, title and status move to the phone transport bar. */}
          {/* Play keeps the amber itself: an icon needs 3:1, which it clears,
              where the labelled buttons' darker fill is for text. */}
          <Button
            size="icon-lg"
            className="hidden size-12 bg-primary sheen sheen-round hover:bg-primary/80 wide:inline-flex"
            disabled={!playing && activeIds.length === 0}
            aria-label={playing ? m.action_pause() : m.action_play()}
            onClick={togglePlay}
          >
            <HugeiconsIcon
              icon={playing ? PauseIcon : PlayIcon}
              strokeWidth={2}
              className="size-5"
            />
          </Button>

          {/* On touch the name is the way into Now playing, as it is in the
              phone bar. */}
          {coarse ? (
            <ContextMenu onOpenChange={noteMenuOpen}>
              <ContextMenuTrigger
                render={
                  <button
                    type="button"
                    aria-haspopup={paneFits ? undefined : "dialog"}
                    aria-expanded={paneFits ? pane : undefined}
                    onClick={guardAfterMenu(() =>
                      paneFits ? showPane(!pane) : setNowPlayingOpen(true)
                    )}
                    className="hidden min-h-11 min-w-0 items-center gap-2 rounded-md text-left wide:flex"
                  />
                }
              >
                <span className="min-w-0">
                  <span className="flex min-w-0 text-sm font-medium">
                    <MiddleTruncate text={mixTitle} />
                    {dirty && (
                      <span className="shrink-0 whitespace-pre"> *</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground tabular-nums">
                    {status}
                  </span>
                </span>
                <HugeiconsIcon
                  icon={ArrowUp01Icon}
                  strokeWidth={2}
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </ContextMenuTrigger>
              {currentMixMenu}
            </ContextMenu>
          ) : (
            <ContextMenu>
              <ContextMenuTrigger
                render={<div className="hidden min-w-0 wide:block" />}
              >
                <p className="flex min-w-0 text-sm font-medium">
                  <MiddleTruncate text={mixTitle} />
                  {dirty && <span className="shrink-0 whitespace-pre"> *</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {status}
                </p>
              </ContextMenuTrigger>
              {currentMixMenu}
            </ContextMenu>
          )}

          <div className="flex-1" />

          {/* Playback, then a rule, then this mix and this view. From md, where
              the phone bar stops. The level rides the thumb while it is being
              set, as on every level slider. The speaker mutes, as on any
              player. */}
          <div className="hidden w-52 min-w-0 items-center gap-2 @max-5xl:w-28 @max-5xl:min-w-20 wide:flex">
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={master > 0 ? m.action_mute() : m.action_unmute()}
              title={master > 0 ? m.action_mute() : m.action_unmute()}
              onClick={toggleMute}
            >
              <HugeiconsIcon
                icon={master > 0 ? VolumeHighIcon : VolumeOffIcon}
                strokeWidth={2}
                className="size-4"
              />
            </Button>
            <Slider
              value={Math.round(master * 100)}
              min={0}
              max={100}
              step={1}
              wheelStep={5}
              resetValue={Math.round(DEFAULT_MASTER * 100)}
              aria-label={m.master_volume()}
              aria-valuetext={formatPercent(Math.round(master * 100))}
              showValue
              flash={masterFlash}
              onValueChange={(value) => dragMaster((value as number) / 100)}
              onValueCommitted={(value) =>
                commitMaster((value as number) / 100)
              }
            />
          </div>

          <Separator
            orientation="vertical"
            className="mx-1 hidden data-vertical:h-5 data-vertical:self-center wide:block"
          />

          {/* 16px between everything drawn, as from the speaker to the rule:
              a ghost button's 8px of padding counts toward it, so the ghosts
              sit 8px from a drawn edge and touch each other. */}
          <div className="flex items-center gap-2">
            {/* A segmented row, as the sleep timer's lengths are: two tiles
                2px apart, 4px where they meet and 8px at the ends. Each tile
                has its own shape, so each takes its own focus ring. Cut from
                the panel's surface rather than the grouped one, which in dark
                would sit above the chosen tile. */}
            <ToggleGroup
              value={[view]}
              onValueChange={(value) => {
                const next = (value as string[])[0]
                if (next === "grid" || next === "list") setView(next)
              }}
              spacing={0.5}
              size="sm"
              className={coarse ? "hidden" : "hidden sm:flex"}
            >
              {(
                [
                  ["grid", GridViewIcon, m.view_grid()],
                  ["list", LeftToRightListBulletIcon, m.view_list()],
                ] as const
              ).map(([value, icon, label]) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  aria-label={label}
                  className="rounded-m3-xs bg-background text-muted-foreground first:rounded-s-lg last:rounded-e-lg"
                >
                  <HugeiconsIcon
                    icon={icon}
                    strokeWidth={2}
                    className="size-4"
                  />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="hidden items-center wide:flex">
              {/* Shows or hides the Now playing pane; only where it fits. */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden text-muted-foreground wide:expanded:inline-flex"
                ref={paneToggle}
                aria-label={m.now_playing()}
                aria-pressed={pane}
                title={pane ? m.now_playing_hide() : m.now_playing_show()}
                onClick={() => showPane(!pane)}
              >
                <HugeiconsIcon icon={PanelRightIcon} strokeWidth={2} />
              </Button>

              {/* The same action as Now playing's "Turn all off" on a phone,
                  and the same Undo instead of a confirmation. */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label={m.action_turn_all_off()}
                title={m.turn_all_off_shortcut()}
                disabled={activeIds.length === 0}
                onClick={turnAllOff}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  strokeWidth={2}
                  className="size-4"
                />
              </Button>
            </div>

            <Button
              shape="fluent"
              variant="outline"
              size="sm"
              className="hidden wide:inline-flex"
              // The label goes below lg, so it needs a name of its own there.
              aria-label={m.action_share()}
              onClick={share}
            >
              <HugeiconsIcon
                icon={Share01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
              <span className="hidden @5xl:inline">{m.action_share()}</span>
            </Button>
          </div>

          {/* The phone header keeps two actions, at a finger's 44px. Preferences
              lives in the sidebar footer, which wide:hidden takes away; the sleep
              timer moves to the phone bar. */}
          <div className="-mr-2 flex wide:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 pointer-coarse:hit-target"
              aria-label={m.action_share()}
              onClick={share}
            >
              <HugeiconsIcon
                icon={Share01Icon}
                strokeWidth={2}
                className="size-5"
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 pointer-coarse:hit-target"
              aria-label={m.preferences()}
              onClick={() => setSettingsOpen(true)}
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                strokeWidth={2}
                className="size-5"
              />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* collapsible="none": below md the mixes become the chip strip and the
            overflow dialog, so the off-canvas drawer would be a second,
            competing answer to the same problem. */}
        <Sidebar
          variant="inset"
          collapsible="none"
          className="hidden grain wide:flex"
        >
          {/* pt-6 matches the panel's p-6, so "Your mixes" sits level with
              the first category heading. */}
          <SidebarContent className="scroll-fade gap-0 px-3 pt-6 scroll-fade-5">
            <SidebarGroup className="gap-1 p-0">
              <SidebarGroupLabel className="h-auto px-2 pb-1 text-label-small text-muted-foreground">
                {m.your_mixes()}
              </SidebarGroupLabel>
              <SidebarMenu>
                {saved.map((mix) => {
                  const loaded = mix.name === mixName
                  return (
                    <ContextMenu key={mix.name}>
                      {/* The <li> is the trigger: a trigger wrapped around the item
                      would sit between the <ul> and its children. */}
                      <ContextMenuTrigger
                        render={
                          <SidebarMenuItem className="data-popup-open:[&>[data-sidebar=menu-button]]:bg-sidebar-accent" />
                        }
                      >
                        <MixRow
                          name={mix.name}
                          mix={mix.mix}
                          loaded={loaded}
                          dirty={loaded && dirty}
                          onApply={() => applyMix(mix.name, mix.mix)}
                          onRemove={() => removeSaved(mix.name)}
                        />
                      </ContextMenuTrigger>
                      {mixMenu(mix)}
                    </ContextMenu>
                  )
                })}
              </SidebarMenu>
              <Button
                shape="fluent"
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start text-muted-foreground"
                onClick={openSaveDialog}
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  strokeWidth={2}
                  className="size-3.5"
                />
                {m.action_save_mix()}
              </Button>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="gap-0 px-3 pb-3">
            {/* The moon, as the phone bar and the dialog have it. Idle it is
                just the button, with no "Off" to say so. Running it takes the
                app's "on", the raised fill with amber inside as a playing card
                has, and the countdown in the dialog's tabular figures. */}
            <Button
              shape="fluent"
              variant="outline"
              size="sm"
              className={cn(
                "w-full justify-start",
                timerOn && "bg-secondary dark:bg-secondary"
              )}
              aria-keyshortcuts="T"
              onClick={() => setTimerOpen(true)}
            >
              <HugeiconsIcon
                icon={Moon02Icon}
                strokeWidth={2}
                className={cn("size-3.5", timerOn && "text-brand")}
              />
              {m.timer_title()}
              {timerOn && (
                <span className="ml-auto text-xs font-semibold text-brand tabular-nums">
                  {formatCountdown(timerLeft)}
                </span>
              )}
            </Button>

            <div className="mt-3 flex items-center gap-2 px-1">
              {/* The way out to the About page, in the app's own language. */}
              <a
                className="text-xs text-muted-foreground hover:text-foreground"
                href={aboutPath(getLocale())}
              >
                {m.about()}
              </a>
              <div className="flex-1" />
              <Button
                shape="fluent"
                variant="ghost"
                size="icon-sm"
                aria-label={m.preferences()}
                title={m.preferences_shortcut()}
                onClick={() => setSettingsOpen(true)}
              >
                <HugeiconsIcon
                  icon={Settings01Icon}
                  strokeWidth={2}
                  className="size-4"
                />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* overflow-hidden clips the grid's scroll fade to the inset's
            rounded corner. */}
        <SidebarInset className="min-w-0 overflow-hidden">
          {/* Below md the sidebar is hidden, so the mixes need a home of their
              own. Saving lives in Now playing, so with no saved mixes there is
              nothing for this strip to show. */}
          {saved.length > 0 && (
            <div className="flex shrink-0 flex-col px-4 pb-3 medium:px-6 wide:hidden">
              <div className="flex h-11 items-center justify-between">
                <p className="text-label-small text-muted-foreground">
                  {m.your_mixes()}
                </p>
                {/* A label, not a "···": whatever scrolls past the edge is one
                    tap away, and the tap says where it goes. */}
                <Button
                  variant="ghost"
                  className="-mr-3 h-9 px-3 text-sm font-medium text-brand hover:text-brand pointer-coarse:hit-target"
                  aria-haspopup="dialog"
                  onClick={() => setAllMixesOpen(true)}
                >
                  {m.all_mixes()}
                </Button>
              </div>
              {/* The fade is scroll-aware, so it only marks an edge that still
                  has chips behind it. */}
              {/* Room inside the scroller for the 5px focus ring and the 48px touch
                  target, which it would otherwise clip. The bottom room is
                  taken back from the padding below; the top is not, since it
                  would lie over the All mixes button. */}
              <div className="-mx-4 -mb-2 no-scrollbar flex scroll-fade-x gap-2 overflow-x-auto px-4 pt-1.5 pb-2 scroll-fade-5">
                {/* Each chip's long press opens the sidebar's mix menu. The
                    trigger is display: contents, so the chip stays the flex
                    item and its own events reach the trigger as they bubble. */}
                {saved.map((mix) => (
                  <ContextMenu key={mix.name} onOpenChange={noteMenuOpen}>
                    <ContextMenuTrigger render={<span className="contents" />}>
                      <MixChip
                        label={mix.name}
                        iconPath={mixIconPath(mix.mix)}
                        active={mix.name === mixName && !dirty}
                        onClick={guardAfterMenu(() =>
                          applyMix(mix.name, mix.mix)
                        )}
                      />
                    </ContextMenuTrigger>
                    {mixMenu(mix)}
                  </ContextMenu>
                ))}
              </div>
            </div>
          )}

          {/* M3's supporting pane: Now playing beside the grid on screens wide
              enough for both (840px), as a fixed 360px, 412px from 1200px. The
              grid's auto-fill columns make room on their own. */}
          <div className="flex min-h-0 flex-1">
            <ScrollArea
              className="min-h-0 min-w-0 flex-1"
              viewportClassName="scroll-fade scroll-fade-6"
            >
              <div className="space-y-6 p-4 medium:p-6">
                {CATEGORIES.map((category) => (
                  <section key={category}>
                    <h2 className="mb-3 text-label-small text-muted-foreground">
                      {categoryLabel[category]}
                    </h2>
                    <div
                      className={cn(
                        shownView === "grid"
                          ? "grid grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))] gap-2.5"
                          : "flex flex-col gap-1.5"
                      )}
                    >
                      {sounds
                        .filter((s) => s.category === category)
                        .map((s) => renderSound(s))}
                    </div>
                  </section>
                ))}

                <section>
                  <h2 className="mb-3 text-label-small text-muted-foreground">
                    {m.yours()}
                  </h2>
                  <div
                    className={cn(
                      shownView === "grid"
                        ? "grid grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))] gap-2.5"
                        : "flex flex-col gap-1.5"
                    )}
                  >
                    {customs.map((c) =>
                      renderSound(
                        {
                          id: c.id,
                          name: customName(c),
                          iconPath: c.videoId ? VIDEO_ICON : MUSIC_ICON,
                        },
                        true
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAddName("")
                        setAddUrl("")
                        setAddOpen(true)
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-xs font-semibold text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground",
                        // 83px is what a sound card measures. It only matters when
                        // this tile is alone, since the grid stretches it to the
                        // cards beside it otherwise, but it has to be the card's
                        // height, not a round number: the 92px that was here made
                        // the whole Yours row 9px taller than every other section.
                        shownView === "grid"
                          ? "min-h-[5.1875rem] flex-col p-3"
                          : "px-4 py-3"
                      )}
                    >
                      <HugeiconsIcon
                        icon={PlusSignIcon}
                        strokeWidth={2}
                        className="size-4"
                      />
                      {shownView === "grid" ? m.add_sound() : m.add_own_sound()}
                    </button>
                  </div>
                </section>
              </div>
            </ScrollArea>
            {(pane || paneMotion === "leaving") && (
              // The column takes its width at once, so the grid gives way in
              // one step; animating the width reflowed every card on every
              // frame. Only the pane moves, by transform: it slides in from
              // the column's right edge, and out the same way before the
              // column goes. 250ms, ease-out both ways.
              <div className="hidden w-[22.5rem] shrink-0 overflow-hidden large:w-[25.75rem] wide:expanded:flex">
                <aside
                  aria-label={m.now_playing()}
                  inert={!pane}
                  className={cn(
                    "flex w-full flex-col border-l border-border transition-[translate] duration-250 ease-(--ease-out) motion-reduce:transition-none",
                    !pane && "translate-x-full",
                    pane &&
                      paneMotion === "entering" &&
                      "starting:translate-x-full"
                  )}
                  onTransitionEnd={(e) => {
                    if (e.target === e.currentTarget) setPaneMotion("still")
                  }}
                >
                  <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
                    <div className="min-w-0">
                      <h2 className="text-title-medium">{m.now_playing()}</h2>
                      <p className="flex min-w-0 text-xs text-muted-foreground">
                        <MiddleTruncate text={mixTitle} />
                        {dirty && (
                          <span className="shrink-0 whitespace-pre">
                            {m.mix_edited()}
                          </span>
                        )}
                      </p>
                    </div>
                    {/* The dialogs' close button, so every close looks alike. */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="bg-secondary"
                      aria-label={m.now_playing_close()}
                      title={m.action_close()}
                      onClick={() => {
                        showPane(false)
                        paneToggle.current?.focus()
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                    </Button>
                  </div>
                  <ScrollArea
                    className="min-h-0 flex-1"
                    viewportClassName="scroll-fade px-5 scroll-fade-5"
                  >
                    {nowPlayingRows}
                  </ScrollArea>
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">
                    {nowPlayingActions(openSaveDialog)}
                  </div>
                </aside>
              </div>
            )}
          </div>

          {/* Phone bar. Play and what is playing live in the header on desktop;
              pinned here they survive the grid scrolling. The name opens Now
              playing, where the levels and the master volume are set, and the
              sleep timer sits beside it, counting down while it runs. Only the
              top is rounded: the bottom meets the screen's own corners. */}
          <div className="flex shrink-0 items-center gap-2.5 rounded-t-m3-xl border-x border-t bg-sidebar px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] wide:hidden">
            <Button
              size="icon"
              className="size-12 shrink-0 bg-primary sheen shadow-level-2 sheen-round hover:bg-primary/80"
              disabled={!playing && activeIds.length === 0}
              aria-label={playing ? m.action_pause() : m.action_play()}
              onClick={togglePlay}
            >
              <HugeiconsIcon
                icon={playing ? PauseIcon : PlayIcon}
                strokeWidth={2}
                className="size-[15px]"
              />
            </Button>

            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setNowPlayingOpen(true)}
              className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left pointer-coarse:hit-target"
            >
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 text-sm font-semibold">
                  <MiddleTruncate text={mixTitle} />
                  {dirty && <span className="shrink-0 whitespace-pre"> *</span>}
                </span>
                <span className="mt-px block truncate text-xs text-muted-foreground">
                  {playStatus}
                </span>
              </span>
              <HugeiconsIcon
                icon={ArrowUp01Icon}
                strokeWidth={2}
                className="size-[18px] shrink-0 text-muted-foreground"
              />
            </button>

            <Button
              variant="outline"
              // The sidebar button's states: plain while idle, the raised fill
              // and amber while running.
              className={cn(
                "h-11 shrink-0 gap-1.5 pointer-coarse:hit-target",
                timerOn
                  ? "bg-secondary px-3.5 dark:bg-secondary"
                  : "w-11 bg-transparent px-0"
              )}
              aria-label={
                timerOn
                  ? m.timer_left_named({ time: formatCountdown(timerLeft) })
                  : m.timer_title()
              }
              onClick={() => setTimerOpen(true)}
            >
              <HugeiconsIcon
                icon={Moon02Icon}
                strokeWidth={2}
                className={cn("size-4", timerOn && "text-brand")}
              />
              {timerOn && (
                <span className="text-sm font-semibold text-brand tabular-nums">
                  {formatCountdown(timerLeft)}
                </span>
              )}
            </Button>
          </div>
        </SidebarInset>
      </div>

      {/* Where levels are set on a phone or any touch screen: the master and
          only the sounds that are on, with sliders a finger can work, since
          the grid there has none. One sheet at a time, so Save closes this
          before opening its own. */}
      <Dialog
        open={nowPlayingOpen}
        onOpenChange={setNowPlayingOpen}
        onOpenChangeComplete={(open) => {
          if (open) return
          releaseRows()
          runAfterClose()
        }}
      >
        {/* A column that clips, as Preferences is: only the rows scroll, under
            a fade, and the title and the actions stay put. */}
        <DialogContent className="flex flex-col overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg">{m.now_playing()}</DialogTitle>
            <DialogDescription>
              {mixTitle}
              {dirty && m.mix_edited()}
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-6 min-h-0 flex-1 scroll-fade overflow-y-auto px-6 scroll-fade-5">
            {nowPlayingRows}
          </div>
          <DialogFooter className="shrink-0 flex-row justify-between sm:justify-between">
            {nowPlayingActions(() => {
              afterClose.current = openSaveDialog
              setNowPlayingOpen(false)
            })}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The phone's stand-in for both the sidebar list and the right-click
          menu it can't offer: every mix with what's in it, and behind each
          one's ··· a shelf of the menu's actions. A context menu is hidden by
          default, so its actions need a visible way in as well. A clipping
          column, as Now playing is: the list takes the sheet's height and
          scrolls under a fade, and the title stays put. */}
      <Dialog
        open={allMixesOpen}
        onOpenChange={(open) => {
          setAllMixesOpen(open)
          if (!open) setMixActionsFor(null)
        }}
        onOpenChangeComplete={(open) => !open && runAfterClose()}
      >
        <DialogContent className="flex flex-col overflow-hidden sm:max-w-sm">
          <DialogHeader className="shrink-0">
            <DialogTitle>{m.all_mixes()}</DialogTitle>
          </DialogHeader>
          <SidebarMenu className="-mx-6 min-h-0 w-auto flex-1 scroll-fade overflow-y-auto px-6 scroll-fade-5">
            {saved.map((mix) => {
              const open = mixActionsFor === mix.name
              return (
                <SidebarMenuItem key={mix.name}>
                  <Popover.Root
                    open={open}
                    onOpenChange={(next) =>
                      setMixActionsFor(next ? mix.name : null)
                    }
                  >
                    {/* The current mix's fill spans the whole row, ··· included,
                      so the button reads as part of it. */}
                    <div
                      ref={(el) => {
                        if (el) mixRows.current.set(mix.name, el)
                        return () => {
                          mixRows.current.delete(mix.name)
                        }
                      }}
                      className={cn(
                        "relative flex items-center rounded-m3-md",
                        mix.name === mixName && "bg-sidebar-accent"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <MixRow
                          name={mix.name}
                          mix={mix.mix}
                          loaded={mix.name === mixName}
                          dirty={mix.name === mixName && dirty}
                          detail={mixSummary(mix.mix, soundName)}
                          onApply={() => {
                            applyMix(mix.name, mix.mix)
                            setAllMixesOpen(false)
                          }}
                        />
                      </div>
                      <Popover.Trigger
                        ref={(el: HTMLButtonElement | null) => {
                          if (el) mixMoreButtons.current.set(mix.name, el)
                          return () => {
                            mixMoreButtons.current.delete(mix.name)
                          }
                        }}
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 text-muted-foreground"
                            aria-label={m.mix_more_for({ name: mix.name })}
                          />
                        }
                      >
                        <HugeiconsIcon
                          icon={MoreHorizontalIcon}
                          strokeWidth={2}
                          className="size-5"
                        />
                      </Popover.Trigger>
                    </div>
                    {/* Floats under its row, as wide as it, rather than opening
                      in the list: opened in place it pushed every row below
                      down, and a short list's sheet grew upward with it. It
                      flips above the row near the bottom, and grows from the
                      ··· it came from. */}
                    <Popover.Portal>
                      <Popover.Positioner
                        anchor={() => mixRows.current.get(mix.name) ?? null}
                        side="bottom"
                        sideOffset={4}
                        className="z-50"
                      >
                        <Popover.Popup className="w-(--anchor-width) origin-(--transform-origin) rounded-m3-lg bg-popover p-1 shadow-level-2 ring-1 ring-foreground/5 transition-[opacity,scale] duration-150 ease-(--ease-out) outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-opacity dark:ring-foreground/10">
                          {/* A segmented row, as the theme swatches are: the
                          desktop menu's actions, icons and order, one equal
                          cell each so none wraps onto a line of its own. */}
                          <div className="grid auto-cols-fr grid-flow-col gap-0.5 [--segment-radius:var(--radius-m3-md)]">
                            {mix.name === mixName && dirty && (
                              <button
                                type="button"
                                className={shelfCell}
                                onClick={() => {
                                  saveChanges(mix.name)
                                  setMixActionsFor(null)
                                }}
                              >
                                <HugeiconsIcon
                                  icon={FloppyDiskIcon}
                                  strokeWidth={2}
                                  className="size-5"
                                />
                                {m.action_save_changes()}
                              </button>
                            )}
                            <button
                              type="button"
                              className={shelfCell}
                              onClick={() => {
                                shareMix(mix.name, mix.mix, false)
                                setMixActionsFor(null)
                              }}
                            >
                              <HugeiconsIcon
                                icon={Share01Icon}
                                strokeWidth={2}
                                className="size-5"
                              />
                              {m.action_share()}
                            </button>
                            <button
                              type="button"
                              className={shelfCell}
                              onClick={() => {
                                afterClose.current = () => {
                                  setRenameValue(mix.name)
                                  setRenaming(mix.name)
                                }
                                setAllMixesOpen(false)
                                setMixActionsFor(null)
                              }}
                            >
                              <HugeiconsIcon
                                icon={PencilEdit02Icon}
                                strokeWidth={2}
                                className="size-5"
                              />
                              {m.action_rename_ellipsis()}
                            </button>
                            <button
                              type="button"
                              className={shelfCell}
                              onClick={() => {
                                duplicateMix(mix)
                                setMixActionsFor(null)
                              }}
                            >
                              <HugeiconsIcon
                                icon={Copy01Icon}
                                strokeWidth={2}
                                className="size-5"
                              />
                              {m.action_duplicate()}
                            </button>
                            <button
                              type="button"
                              className={cn(shelfCell, "text-destructive")}
                              onClick={() => {
                                // Focus moves to the next row, or the one above
                                // for the last; deleting the only mix closes the
                                // sheet, since there is nothing left in it.
                                const at = saved.indexOf(mix)
                                const neighbour = saved[at + 1] ?? saved[at - 1]
                                if (neighbour) {
                                  mixMoreButtons.current
                                    .get(neighbour.name)
                                    ?.focus()
                                } else {
                                  setAllMixesOpen(false)
                                }
                                removeSaved(mix.name)
                                setMixActionsFor(null)
                              }}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                strokeWidth={2}
                                className="size-5"
                              />
                              {m.action_delete()}
                            </button>
                          </div>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </DialogContent>
      </Dialog>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="content-start max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-lg">{m.save_title()}</DialogTitle>
            <DialogDescription>
              {activeIds.length
                ? m.save_description({ count: activeIds.length })
                : m.save_description_empty()}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={saveName}
            maxLength={MIX_NAME_MAX}
            placeholder={saveSuggestion || m.name_your_mix()}
            autoComplete="off"
            enterKeyHint="done"
            // Select the prefilled name so typing replaces it instead of
            // appending to it, the standard "save as" behaviour.
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveMix()
            }}
          />
          <DialogFooter>
            <Button
              shape="fluent"
              variant="outline"
              onClick={() => setSaveOpen(false)}
            >
              {m.action_cancel()}
            </Button>
            <Button shape="fluent" onClick={saveMix}>
              {m.action_save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="content-start max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-lg">{m.add_own_sound()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input
              value={addName}
              maxLength={SOUND_NAME_MAX}
              placeholder={m.add_name_placeholder()}
              // Otherwise phones offer the user's own name here.
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => setAddName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                value={addUrl}
                placeholder={m.add_url_placeholder()}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                className="min-w-0 flex-1"
                onChange={(e) => setAddUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addFromUrl()
                }}
              />
              <Button shape="fluent" onClick={addFromUrl}>
                {m.action_add()}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Separator className="flex-1" />
            <span className="text-[0.6875rem] text-muted-foreground">
              {m.add_or()}
            </span>
            <Separator className="flex-1" />
          </div>

          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-xs font-semibold text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
            <HugeiconsIcon
              icon={Upload04Icon}
              strokeWidth={2}
              className="size-3.5"
            />
            {m.add_choose_file()}
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) addFromFile(file)
                e.target.value = ""
              }}
            />
          </label>
        </DialogContent>
      </Dialog>

      <Dialog open={timerOpen} onOpenChange={setTimerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">{m.timer_title()}</DialogTitle>
          </DialogHeader>
          <SleepTimerPanel
            running={timerOn}
            left={timerLeft}
            end={timerEnd}
            choice={timerChoice}
            fadeSeconds={prefs.sleepFade}
            onChoose={setTimerChoice}
            onStart={() => startTimer(timerChoice)}
            onExtend={() => extendTimer(15)}
            onStop={stopTimer}
          />
        </DialogContent>
      </Dialog>
      {/* Opens with "," per the design; Ctrl+P also works, per the desktop. */}
      <PreferencesSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        footer={
          <>
            {!coarse && (
              <span>
                {/* The key sits wherever the language puts it. */}
                {runs(m.prefs_shortcut_hint.parts({})).map(({ text, tag }) =>
                  tag ? (
                    <b
                      key={tag}
                      className="rounded bg-muted px-1 py-0.5 font-mono text-foreground"
                    >
                      ,
                    </b>
                  ) : (
                    text
                  )
                )}
              </span>
            )}
            <span className="flex-1" />
            {/* Undo rather than a confirmation: this only resets the rows
                above, and on a phone a confirmation would be a second sheet
                over this one. */}
            <Button
              shape="fluent"
              variant="ghost"
              size="sm"
              disabled={prefsAreDefault && appearanceIsDefault}
              onClick={() => {
                // The colour scheme and pure black are rows above as well, so
                // they reset and undo with the rest. The theme mode doesn't:
                // it's the site's, shared with the landing page's toggle.
                const previous = { prefs, scheme, blackNight }
                setPrefs({ ...DEFAULT_PREFS })
                if (!appearanceIsDefault) {
                  crossfadeTheme(() => {
                    applyScheme("amber")
                    applyBlackNight(false)
                    flushSync(() => {
                      setScheme("amber")
                      setBlackNight(false)
                    })
                    writeScheme("amber")
                    writeBlackNight(false)
                  })
                }
                toast.success(m.toast_prefs_restored(), {
                  id: "prefs-restored",
                  action: {
                    label: m.action_undo(),
                    onClick: () => {
                      setPrefs(previous.prefs)
                      selectScheme(previous.scheme)
                      changeBlackNight(previous.blackNight)
                    },
                  },
                })
              }}
            >
              {m.restore_defaults()}
            </Button>
          </>
        }
      >
        {(open) => (
          <>
            <PrefSection title={m.section_appearance()}>
              <ThemePicker mode={themeMode} onSelect={selectTheme} />
              <SchemePicker scheme={scheme} onSelect={selectScheme} />
              <div className={prefGroup}>
                <LanguageRow onOpen={() => open("language")} />
                <PrefRow
                  icon={DarkModeIcon}
                  title={m.pref_black_title()}
                  description={m.pref_black_description()}
                  checked={blackNight}
                  onChange={changeBlackNight}
                />
                <PrefRow
                  icon={AudioWave01Icon}
                  title={m.pref_meters_title()}
                  description={m.pref_meters_description()}
                  checked={prefs.eq}
                  onChange={(v) => setPref("eq", v)}
                />
                {!coarse && <ShortcutsRow onOpen={() => open("shortcuts")} />}
              </div>
            </PrefSection>

            <PrefSection title={m.section_playback()}>
              <div className={prefGroup}>
                <PrefSlider
                  icon={ArrowDataTransferHorizontalIcon}
                  title={m.pref_fade_title()}
                  value={prefs.fadeMs}
                  display={
                    prefs.fadeMs < 100
                      ? m.pref_fade_instant()
                      : formatSeconds(prefs.fadeMs / 1000, 1)
                  }
                  min={0}
                  max={3000}
                  step={100}
                  // Base UI's largeStep default is 10, which on this scale is
                  // smaller than one press of an arrow key.
                  largeStep={500}
                  resetValue={DEFAULT_PREFS.fadeMs}
                  onChange={(v) => setPref("fadeMs", v)}
                />
                <PrefSlider
                  icon={Moon02Icon}
                  title={m.pref_sleep_fade_title()}
                  value={prefs.sleepFade}
                  display={formatSeconds(prefs.sleepFade, 0)}
                  min={2}
                  max={60}
                  step={1}
                  resetValue={DEFAULT_PREFS.sleepFade}
                  onChange={(v) => setPref("sleepFade", v)}
                />
                <PrefRow
                  icon={BrowserIcon}
                  title={m.pref_pause_title()}
                  description={m.pref_pause_description()}
                  checked={prefs.pauseHidden}
                  onChange={(v) => setPref("pauseHidden", v)}
                />
                <PrefRow
                  icon={Sun03Icon}
                  title={m.pref_awake_title()}
                  description={m.pref_awake_description()}
                  checked={prefs.keepAwake}
                  onChange={(v) => setPref("keepAwake", v)}
                />
                {"audioSession" in navigator && (
                  <PrefRow
                    icon={MusicNote01Icon}
                    title={m.pref_alongside_title()}
                    description={m.pref_alongside_description()}
                    checked={prefs.mixWithOthers}
                    onChange={(v) => setPref("mixWithOthers", v)}
                  />
                )}
              </div>
            </PrefSection>

            {/* No persistent chrome anywhere for this. A standing "offline"
                badge is redundant with the OS and the browser, and the two
                honest messages (a sound that isn't saved yet, a YouTube sound
                that needs a connection) already appear where they matter. */}
            {(pwa.audio || installRow) && (
              <PrefSection title={m.section_offline()}>
                <div className={prefGroup}>
                  {pwa.audio && (
                    <PrefInfo
                      icon={Download04Icon}
                      title={m.offline_title()}
                      description={
                        // Offline there is nothing to press, so say why.
                        !pwa.online && pwa.audio.cached < pwa.audio.total
                          ? m.offline_saved_reconnect({
                              cached: pwa.audio.cached,
                              total: pwa.audio.total,
                            })
                          : m.offline_saved({
                              cached: pwa.audio.cached,
                              total: pwa.audio.total,
                            })
                      }
                    >
                      {pwa.online && pwa.audio.cached < pwa.audio.total && (
                        <Button
                          shape="fluent"
                          variant="outline"
                          size="sm"
                          disabled={pwa.downloading}
                          onClick={pwa.downloadSounds}
                        >
                          {pwa.downloading
                            ? m.offline_downloading({
                                cached: pwa.audio.cached,
                                total: pwa.audio.total,
                              })
                            : m.offline_download({
                                size: formatBytes(pwa.audio.remainingBytes),
                              })}
                        </Button>
                      )}
                    </PrefInfo>
                  )}
                  {installRow && (
                    <PrefInfo
                      icon={InstallingUpdates01Icon}
                      title={m.install_title()}
                      // With a prompt the Install button says it all;
                      // without one, this says where the browser keeps it.
                      description={
                        pwa.canInstall
                          ? undefined
                          : IS_APPLE_TOUCH
                            ? m.install_description_apple()
                            : m.install_description_menu()
                      }
                    >
                      {pwa.canInstall && (
                        <Button
                          shape="fluent"
                          variant="outline"
                          size="sm"
                          onClick={() => void pwa.install()}
                        >
                          {m.action_install()}
                        </Button>
                      )}
                    </PrefInfo>
                  )}
                </div>
              </PrefSection>
            )}

            <PrefSection title={m.section_data()}>
              <div className={prefGroup}>
                <PrefInfo
                  icon={Database01Icon}
                  title={m.data_title()}
                  description={
                    saved.length || customs.length
                      ? m.data_summary({
                          // Only what there is: no "and 0 sounds".
                          items: formatList(
                            [
                              saved.length &&
                                m.count_saved_mixes({ count: saved.length }),
                              customs.length &&
                                m.count_own_sounds({ count: customs.length }),
                            ].filter((part) => typeof part === "string")
                          ),
                        })
                      : m.data_empty()
                  }
                >
                  {/* Armed, it turns destructive red. Both labels share one
                    grid cell and the hidden one keeps its width, so the
                    button holds the wider label's size and the text beside it
                    doesn't reflow. */}
                  <Button
                    shape="fluent"
                    variant={dataArmed ? "destructive" : "outline"}
                    size="sm"
                    disabled={saved.length === 0 && customs.length === 0}
                    onClick={dataArmed ? clearData : armClearData}
                  >
                    <span className="grid justify-items-center">
                      <span
                        className={cn(
                          "col-start-1 row-start-1",
                          dataArmed && "invisible"
                        )}
                      >
                        {m.clear_all()}
                      </span>
                      <span
                        className={cn(
                          "col-start-1 row-start-1",
                          !dataArmed && "invisible"
                        )}
                      >
                        {m.clear_sure()}
                      </span>
                    </span>
                  </Button>
                </PrefInfo>
                <PrefInfo
                  icon={Archive01Icon}
                  title={m.backup_title()}
                  description={m.backup_description()}
                >
                  <Button
                    shape="fluent"
                    variant="outline"
                    size="sm"
                    disabled={saved.length === 0 && customs.length === 0}
                    onClick={() => void exportBackup()}
                  >
                    {m.action_export()}
                  </Button>
                  <Button
                    shape="fluent"
                    variant="outline"
                    size="sm"
                    onClick={() => importInput.current?.click()}
                  >
                    {m.action_import()}
                  </Button>
                  <input
                    ref={importInput}
                    type="file"
                    accept=".murmur"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (file) void importBackup(file)
                    }}
                  />
                </PrefInfo>
              </div>
            </PrefSection>

            <PrefSection title={m.about()}>
              <div className={prefGroup}>
                <div className="flex items-center gap-4 px-4 py-3">
                  <img
                    src={`${BASE}/icon.svg`}
                    alt=""
                    width={34}
                    height={34}
                    className="block shrink-0 rounded-[7px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-lg">Murmur</span>
                      <span className="text-body-medium text-muted-foreground tabular-nums">
                        {__APP_VERSION__}
                      </span>
                    </div>
                    <p className="mt-0.5 text-body-medium text-muted-foreground">
                      {m.about_tagline()}
                    </p>
                  </div>
                </div>

                <a
                  className={aboutRow}
                  href={repoUrl}
                  target="_blank"
                  rel="noopener"
                >
                  <HugeiconsIcon
                    icon={GithubIcon}
                    strokeWidth={2}
                    className="size-5 shrink-0"
                  />
                  <span className="flex-1">{m.about_source()}</span>
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    strokeWidth={2}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </a>
                {/* The sound attribution table lives on the landing page. */}
                <a className={aboutRow} href={`${BASE}/#credits`}>
                  <HugeiconsIcon
                    icon={File01Icon}
                    strokeWidth={2}
                    className="size-5 shrink-0"
                  />
                  <span className="flex-1">{m.about_credits()}</span>
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    strokeWidth={2}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </a>
                <button
                  type="button"
                  className={aboutRow}
                  onClick={copyBuildInfo}
                >
                  <HugeiconsIcon
                    icon={Copy01Icon}
                    strokeWidth={2}
                    className="size-5 shrink-0"
                  />
                  {m.about_copy_build()}
                </button>

                {/* The tint is a gradient layer, so it lies over the tile's
                    fill rather than replacing it. Narrow, the button drops
                    under the text instead of squeezing it. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-linear-to-b from-brand/5 to-brand/5 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-body-large">{m.support_title()}</p>
                    <p className="mt-0.5 text-body-medium text-muted-foreground">
                      {m.support_description()}
                    </p>
                  </div>
                  <a
                    className="ml-auto flex h-8 shrink-0 items-center gap-2 rounded bg-filled px-3.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-filled-hover"
                    href={sponsorUrl}
                    target="_blank"
                    rel="noopener"
                  >
                    <HugeiconsIcon
                      icon={FavouriteIcon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                    {m.support_action()}
                  </a>
                </div>
              </div>
            </PrefSection>
          </>
        )}
      </PreferencesSheet>

      <RenameDialog
        open={renaming !== null}
        title={m.rename_mix()}
        placeholder={m.name_your_mix()}
        value={renameValue}
        maxLength={MIX_NAME_MAX}
        onValueChange={setRenameValue}
        onRename={renameMix}
        onCancel={() => setRenaming(null)}
      />
      <RenameDialog
        open={renamingSound !== null}
        title={m.rename_sound()}
        placeholder={m.name_your_sound()}
        value={renameValue}
        maxLength={SOUND_NAME_MAX}
        onValueChange={setRenameValue}
        onRename={renameSound}
        onCancel={() => setRenamingSound(null)}
      />

      {/* Below md the phone bar owns the bottom edge: 55px plus its padding
          over the home indicator, then an 8px gap. Sonner's own mobile switch
          is at 600px, so both of its offsets read the same variable. */}
      <Toaster
        position="bottom-center"
        theme={themeMode}
        offset={{ bottom: "var(--toast-bottom)" }}
        mobileOffset={{ bottom: "var(--toast-bottom)" }}
        className="toaster group [--toast-bottom:calc(67px_+_max(12px,env(safe-area-inset-bottom)))] wide:[--toast-bottom:24px]"
      />
      <input
        ref={relinkInput}
        type="file"
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const id = relinkTarget.current
          e.target.value = ""
          if (file && id) relinkFile(id, file)
        }}
      />
      {import.meta.env.DEV && <DevDataToggle />}
    </SidebarProvider>
  )
}
