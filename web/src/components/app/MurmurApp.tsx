"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Archive01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  AudioWave01Icon,
  BrowserIcon,
  Cancel01Icon,
  Delete02Icon,
  Clock01Icon,
  Copy01Icon,
  Database01Icon,
  Download04Icon,
  FavouriteIcon,
  File01Icon,
  FloppyDiskIcon,
  GithubIcon,
  GridViewIcon,
  HeadphonesIcon,
  InstallingUpdates01Icon,
  KeyboardIcon,
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
import { Switch } from "@/components/ui/switch"
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
  loadPersisted,
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
  readThemeMode,
  writeThemeMode,
  type ThemeMode,
} from "@/lib/theme"
import { clampName, isolate } from "@/lib/text"
import { cn } from "@/lib/utils"

import { DevDataToggle } from "./DevDataToggle"
import { MiddleTruncate } from "./MiddleTruncate"
import { SoundIcon } from "./SoundIcon"
import { useCoarsePointer } from "./use-coarse-pointer"
import { persistStorage, usePwa } from "./use-pwa"

/** Vite inlines this at build time, in client islands as well as .astro files. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const TIMER_OPTIONS = [0, 15, 30, 45, 60, 90]
const CATEGORIES: SoundCategory[] = ["nature", "urban", "generated"]
const DEFAULT_TOGGLE_VOLUME = 0.7
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

/** Stands in until the player is live and can report the real title. */
const YT_PLACEHOLDER_NAME = "YouTube sound"

/** What a list row says where a missing sound's slider would be. */
const MISSING_NOTE = "File missing from this browser. Choose it again"

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
const DEVICE_LEVEL_NOTE = "Set with your iPhone’s volume buttons"

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
 * Preferences' lists, segmented as the Claude app and Android settings draw
 * theirs. The group's outer corners are 16px inside the phone sheet's 28px,
 * and 8px in the desktop dialog, so a group never rounds more than its frame.
 */
const prefGroup =
  "segmented-list [--segment-radius:var(--radius-m3-lg)] sm:[--segment-radius:var(--radius-lg)]"

/** About's links and actions, as rows of the list like every other one. */
const aboutRow =
  "flex min-h-14 items-center gap-4 state-layer px-4 py-3 text-left text-body-large transition-colors"

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

interface MixRowProps {
  name: string
  mix: MixerState
  loaded: boolean
  dirty?: boolean
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
  onApply,
  onRemove,
  className,
}: MixRowProps) {
  return (
    <>
      {loaded && (
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
          className
        )}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          <SoundIcon path={mixIconPath(mix)} size={13} strokeWidth={1.9} />
        </span>
        <MiddleTruncate text={name} />
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
          aria-label={`Delete ${name}`}
          title="Delete mix"
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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onRename}>Rename</Button>
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
 * A card's level where it has no slider: on touch, where a slider in the
 * scrolling grid takes the swipe meant to scroll it and sets a volume instead.
 * Read-only; levels are set in Now playing. h-1 is the slider's own box (its
 * thumb overhangs it), so the card still measures the 83px the "Add sound"
 * tile copies.
 */
function LevelBar({ level }: { level: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-1 overflow-hidden rounded-full transition-colors",
        level > 0 ? "bg-track" : "bg-transparent",
        // M3's stop indicator: the track alone is 1.4:1, so its end gets a
        // 3:1 dot until the fill reaches it.
        level > 0 &&
          level < 1 &&
          "after:absolute after:inset-y-0 after:right-0 after:w-1 after:rounded-full after:bg-outline"
      )}
    >
      {/* Full width and slid into place rather than sized: a transform
          animates without layout, and the clipped track keeps the fill's
          rounded end whatever the level. */}
      <div
        className="h-full rounded-full bg-primary transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${Math.round(level * 100) - 100}%)` }}
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
          className="block truncate text-sm font-semibold"
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
              aria-label={`${name} volume`}
              aria-valuetext={`${pct}%`}
              onValueChange={(value) => onDrag((value as number) / 100)}
              onValueCommitted={(value) => onCommit((value as number) / 100)}
            />
          </div>
          <span
            aria-hidden="true"
            className="w-7 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums"
          >
            {pct}
          </span>
        </>
      )}
      {onTurnOff ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full text-muted-foreground pointer-coarse:hit-target"
          aria-label={`Turn off ${name}`}
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
  const mix = Object.fromEntries(
    Object.entries(decodeMix(shared)).filter(
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
  state.mixName = clampName(params.get("n") ?? "", MIX_NAME_MAX) || "Shared mix"
  state.dirty = false

  // A link can name a video this browser has never seen, so its custom has
  // to exist before the mixer goes looking.
  for (const id of Object.keys(mix)) {
    const videoId = ytVideoId(id)
    if (!videoId || state.customs.some((c) => c.id === id)) continue
    state.customs.push({ id, name: YT_PLACEHOLDER_NAME, videoId })
    link.addedVideos.push(id)
  }

  return { state, link }
}

function formatClock(totalSeconds: number): string {
  const s = Math.ceil(totalSeconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
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

/** A file size: "18 MB", one decimal under 10 MB ("2.4 MB"), kB below 1 MB. */
function formatBytes(bytes: number): string {
  const kb = bytes < 1e6
  const value = kb ? Math.max(1, bytes / 1e3) : bytes / 1e6
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: kb ? "kilobyte" : "megabyte",
    maximumFractionDigits: !kb && value < 10 ? 1 : 0,
  }).format(value)
}

/** A timer length as people say it: "45 min", "1 h", "1 h 15 min". */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
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

function ThemeSwatch({
  mode,
  active,
  onSelect,
}: {
  mode: ThemeMode
  active: boolean
  onSelect: () => void
}) {
  const label = mode === "system" ? "Auto" : mode === "light" ? "Light" : "Dark"
  const pane = (tone: "light" | "dark", half: boolean) => (
    <div
      className="flex flex-1 flex-col justify-end gap-[3px] p-1"
      style={{ background: tone === "light" ? "#faf6ee" : "#232017" }}
    >
      {!half && (
        <span
          className="h-1 w-3/5 rounded-full"
          style={{
            background:
              tone === "light"
                ? "rgba(33,18,14,0.18)"
                : "rgba(250,246,238,0.18)",
          }}
        />
      )}
      <span
        className="h-1 w-full rounded-full"
        style={{ background: tone === "light" ? "#b86d20" : "#f5c375" }}
      />
    </div>
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "rounded-m3-xs border p-[9px_9px_8px] text-left transition-colors first:rounded-s-(--segment-radius) last:rounded-e-(--segment-radius) hover:border-brand",
        // Selected as everywhere else: the raised container plus amber. The
        // rest are tiles like the list beneath them, with no outline.
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

function PrefRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: typeof PlayIcon
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
function PrefInfo({
  icon,
  title,
  description,
  children,
}: {
  icon: typeof PlayIcon
  title: string
  description: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 shrink-0" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-body-large">{title}</p>
        <p className="mt-0.5 text-body-medium text-muted-foreground">
          {description}
        </p>
      </div>
      {children && <div className="ml-auto flex gap-2">{children}</div>}
    </div>
  )
}

function PrefSlider({
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
  icon: typeof PlayIcon
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
            onValueChange={(v) => onChange(v as number)}
          />
        </div>
      </div>
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

function PrefSection({
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
      aria-label={`Remove ${name}`}
      title="Remove"
      className={cn(
        "relative size-[22px] shrink-0 rounded state-layer text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-[11px]",
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
  const [dirty, setDirty] = React.useState(initial.dirty)
  const [view, setView] = React.useState<View>(initial.view)
  const [pane, setPane] = React.useState(initial.pane)
  const paneToggle = React.useRef<HTMLButtonElement>(null)
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
  // One sheet at a time, and the next one waits until the first has gone:
  // opened together, their two blurred backdrops stack and flash darker.
  const afterClose = React.useRef<(() => void) | null>(null)
  const runAfterClose = () => {
    const next = afterClose.current
    afterClose.current = null
    next?.()
  }
  const [timerOpen, setTimerOpen] = React.useState(false)
  /** The length the running timer was started with, to mark its preset. */
  const [timerMinutes, setTimerMinutes] = React.useState(0)
  /** The Custom slider's length, kept between openings of the dialog. */
  const [customMinutes, setCustomMinutes] = React.useState(60)
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
  const selectTheme = (mode: ThemeMode) => {
    setThemeMode(mode)
    writeThemeMode(mode)
  }
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  // A dialog a shortcut opened or closed comes and goes without motion: the
  // keyboard is the fast path, and animating it reads as lag. Any pointer
  // input hands motion back.
  const [keyDriven, setKeyDriven] = React.useState(false)
  const [pageHidden, setPageHidden] = React.useState(() => document.hidden)
  React.useEffect(() => {
    const sync = () => setPageHidden(document.hidden)
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])
  React.useEffect(() => {
    const off = () => setKeyDriven(false)
    window.addEventListener("pointerdown", off)
    return () => window.removeEventListener("pointerdown", off)
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

  const nameFor = (id: string) =>
    sounds.find((s) => s.id === id)?.name ??
    customsRef.current.find((c) => c.id === id)?.name ??
    "that sound"

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
        ? `Couldn’t load ${isolate(nameFor(id))}. This browser may not support the file`
        : `${isolate(nameFor(id))} isn’t saved for offline use yet. Reconnect to add it`,
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
      toast("That video is already in your mixer")
      return
    }

    commitCustoms([
      ...customsRef.current,
      {
        id,
        name: clampName(name, SOUND_NAME_MAX) || YT_PLACEHOLDER_NAME,
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
    let host: string
    try {
      host = new URL(url).hostname.replace(/^www\./, "")
    } catch {
      toast("That doesn’t look like a link")
      return
    }
    const id = `cu${Date.now()}`
    commitCustoms([
      ...customsRef.current,
      { id, name: clampName(addName.trim() || host, SOUND_NAME_MAX), url },
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
    toast.success(`${isolate(nameFor(id))} is back`)
  }

  const addFromFile = (file: File) => {
    const id = `cf${Date.now()}`
    blobUrls.current.set(id, URL.createObjectURL(file))
    const name = clampName(
      addName.trim() || file.name.replace(/\.[^.]+$/, ""),
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
        toast("Couldn’t save the file. It’ll play until you close this tab")
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
    toast(`Removed “${isolate(custom.name)}”`, {
      id: `sound-removed:${id}`,
      onAutoClose: purge,
      onDismiss: purge,
      action: {
        label: "Undo",
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
          ? `${isolate(nameFor(lost[0]))} is missing from this browser. Add the file again from its tile`
          : `${lost.length} of this mix’s sounds are missing from this browser. Add their files again from their tiles`,
        { id: "sound-missing" }
      )
    }
  }

  const allMixes = saved

  const cycleMix = (delta: number) => {
    if (allMixes.length < 2) return
    const at = allMixes.findIndex((m) => m.name === mixName)
    const next = allMixes[(at + delta + allMixes.length) % allMixes.length]
    applyMix(next.name, next.mix)
  }

  const resetMix = () => {
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
    toast(`Deleted “${isolate(name)}”`, {
      id: "mix-deleted",
      action: {
        label: "Undo",
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
    toast.success(`Saved changes to “${isolate(name)}”`, {
      id: "mix-saved",
      action: {
        label: "Undo",
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
    let name = copy(" copy")
    for (let n = 2; saved.some((s) => s.name === name); n++)
      name = copy(` copy ${n}`)
    setSaved((prev) => {
      const at = prev.findIndex((s) => s.name === mix.name)
      const next = [...prev]
      next.splice(at + 1, 0, { name, mix: { ...mix.mix } })
      return next
    })
    toast.success(`Duplicated as “${isolate(name)}”`)
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
        `Backup saved (${formatBytes(file.size)}). ${withoutFile} of your own ${withoutFile === 1 ? "sounds has" : "sounds have"} no file to include`
      )
    } else {
      toast.success(`Backup saved (${formatBytes(file.size)})`)
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
        error instanceof BackupError
          ? error.message
          : "That file isn’t a Murmur backup"
      )
      return
    }
    const incoming = parseBackupData(read.contents)

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
          toast(
            "Some sound files couldn’t be saved. They’ll play until you close this tab"
          )
        }
      })
    }
    setMissing((prev) => {
      const next = new Set(prev)
      for (const id of relinked) next.delete(id)
      for (const id of stillMissing) next.add(id)
      return next
    })

    const names = new Set(saved.map((m) => m.name))
    const addedMixes: SavedMix[] = []
    for (const m of incoming.saved) {
      if (saved.some((x) => x.name === m.name && sameMix(x.mix, m.mix)))
        continue
      let name = m.name
      for (let n = 2; names.has(name); n++) {
        name = `${clampName(m.name, MIX_NAME_MAX - ` (${n})`.length)} (${n})`
      }
      names.add(name)
      addedMixes.push({ name, mix: m.mix })
    }
    setSaved((prev) => [...prev, ...addedMixes])

    if (!addedMixes.length && !added.length && !relinked.length) {
      toast("Nothing new in that backup")
      return
    }
    const parts = [
      `${addedMixes.length} ${addedMixes.length === 1 ? "mix" : "mixes"}`,
      `${added.length} ${added.length === 1 ? "sound" : "sounds"}`,
    ]
    toast.success(
      `Imported ${parts.join(" and ")}${relinked.length ? `, and brought back ${relinked.length} missing ${relinked.length === 1 ? "file" : "files"}` : ""}`,
      {
        id: "backup-imported",
        action: {
          label: "Undo",
          onClick: () => undoRef.current.undoImport(addedMixes, added),
        },
      }
    )
  }

  /** Takes back exactly what an import added; files it brought back stay. */
  const undoImport = (mixes: SavedMix[], sounds: CustomSound[]) => {
    setSaved((prev) => prev.filter((m) => !mixes.includes(m)))
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
    toast.success("Saved mixes and your own sounds cleared", {
      id: "data-cleared",
      onAutoClose: purge,
      onDismiss: purge,
      action: {
        label: "Undo",
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
    const name = saveName.trim()
    if (!name) return
    const mix: MixerState = {}
    for (const [id, v] of Object.entries(vols)) if (v > 0) mix[id] = v
    setSaved((prev) => [...prev.filter((s) => s.name !== name), { name, mix }])
    setMixName(name)
    setDirty(false)
    setSaveOpen(false)
    toast.success(`Saved “${isolate(name)}”`)
  }

  /** What a bug report needs: which build, and which browser rendered it. */
  const copyBuildInfo = () => {
    const info = `Murmur ${__APP_VERSION__}\n${navigator.userAgent}`
    if (!navigator.clipboard) {
      toast("Clipboard unavailable in this browser")
      return
    }
    navigator.clipboard.writeText(info).then(
      () => toast.success("Build info copied"),
      () => toast("Couldn’t copy the build info")
    )
  }

  /**
   * Copies a link that rebuilds `levels` under `name`. The header shares the
   * mix on the faders; a saved mix's menu shares that mix without loading it.
   */
  const shareMix = (name: string, levels: MixerState, current: boolean) => {
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
            ? "Only your own sounds are playing, and those can’t be shared"
            : "This mix only has your own sounds, and those can’t be shared"
          : current
            ? "Nothing playing to share yet"
            : "This mix has no sounds to share"
      )
      return
    }
    const url = `${window.location.origin}${window.location.pathname}#mix=${fragment}&n=${encodeURIComponent(name)}`
    const done = () =>
      droppedCustoms
        ? toast.success("Link copied. Your own sounds aren’t included")
        : toast.success("Link copied")
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done, done)
    } else {
      window.history.replaceState(null, "", url)
      toast("Link is in the address bar")
    }
  }

  const share = () => shareMix(mixName, vols, true)

  const startTimer = (minutes: number) => {
    fadeMult.current = 1
    setTimerOpen(false)
    setTimerMinutes(minutes)
    if (!minutes) {
      setTimerEnd(0)
      setTimerLeft(0)
      if (audioStarted.current) mixer.setMasterVolume(master)
      return
    }
    setTimerEnd(Date.now() + minutes * 60_000)
    setTimerLeft(minutes * 60)
  }

  /**
   * More time on a running timer. During the fade-out this brings the level
   * back: the interval below works the fade from the time left.
   */
  const extendTimer = (minutes: number) => {
    setTimerEnd((end) => end + minutes * 60_000)
    setTimerLeft((left) => left + minutes * 60)
    // No longer one of the presets, so none of them reads as chosen.
    setTimerMinutes(-1)
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
          // Only fills the placeholder: a name the user typed is theirs.
          c.id === id && c.name === YT_PLACEHOLDER_NAME
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
    toast(`Playing only ${isolate(nameFor(id))}`, {
      id: "play-only",
      action: {
        label: "Undo",
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
    toast("Turned everything off", {
      id: "turn-all-off",
      action: {
        label: "Undo",
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
    const videos = added === 1 ? "a YouTube sound" : `${added} YouTube sounds`
    const message = link.replacedUnsaved
      ? added
        ? `This link replaced your unsaved mix and added ${videos}`
        : "This link replaced your unsaved mix"
      : added
        ? `This link added ${videos} to your mixer`
        : null
    if (!message) return
    toast(message, {
      id: "shared-link",
      duration: 10_000,
      action: { label: "Undo", onClick: () => undoRef.current.undoLink(link) },
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
        saved,
        customs,
        prefs,
      })
    }, 250)
    return () => window.clearTimeout(id)
  }, [vols, master, mixName, dirty, view, pane, saved, customs, prefs])

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
    toast(
      "Murmur’s built-in sounds need Safari 18.4 or later. YouTube sounds and your own MP3 or M4A files still play",
      { id: "ogg-unsupported", duration: Infinity }
    )
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
    document.title = playing ? `${mixName} · Murmur` : "Murmur"
  }, [playing, mixName])

  // A waiting worker never takes over on its own: the reload it costs would cut
  // a mix mid-play, and with client:only that reload is a 600 KB parse, a fresh
  // AudioContext and a re-decode of every active buffer. Ignoring the toast is
  // a valid answer; workbox-window re-fires `waiting` on the next launch, so
  // the offer returns without anything having to remember it was dismissed.
  const { needRefresh, updateNow } = pwa
  React.useEffect(() => {
    if (!needRefresh) return
    toast("A new version of Murmur is ready", {
      id: "app-update",
      duration: Infinity,
      action: { label: "Reload", onClick: () => void updateNow() },
    })
  }, [needRefresh, updateNow])

  // The honest version of the plugin's onOfflineReady, which fires when the
  // shell lands and would announce readiness while every sound was still
  // missing. Only on the incomplete-to-complete edge, so a launch that is
  // already fully cached says nothing.
  const sawIncompleteAudio = React.useRef(false)
  React.useEffect(() => {
    const status = pwa.audio
    if (!status?.total) return
    if (status.cached < status.total) {
      sawIncompleteAudio.current = true
      return
    }
    if (!sawIncompleteAudio.current) return
    sawIncompleteAudio.current = false
    toast(`All ${status.total} built-in sounds are saved for offline use`, {
      id: "offline-ready",
    })
  }, [pwa.audio])

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
      toast("You’re back online", {
        id: "back-online",
        action: {
          label: ids.length === 1 ? "Play it" : "Play them",
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
      artist: mixName,
      album: "Ambient mixer",
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
  }, [mixName, playing])

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
          setKeyDriven(true)
          setAddName("")
          setAddUrl("")
          setAddOpen(true)
        } else if (key === "g") {
          e.preventDefault()
          setView(view === "grid" ? "list" : "grid")
        } else if (key === "p") {
          e.preventDefault()
          setKeyDriven(true)
          setSettingsOpen((o) => !o)
        }
        return
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === ",") {
        e.preventDefault()
        setKeyDriven(true)
        setSettingsOpen((o) => !o)
        return
      }
      if (e.key === " ") {
        e.preventDefault()
        togglePlay()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        changeMaster(master + 0.05)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        changeMaster(master - 0.05)
      } else if (e.key === "s" || e.key === "S") {
        share()
      } else if (e.key === "t" || e.key === "T") {
        setKeyDriven(true)
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
      ? "Nothing playing"
      : [
          activeIds.length === 1 ? "1 sound" : `${activeIds.length} sounds`,
          playing ? "playing" : "paused",
        ].join(" · ")
  const status = timerOn
    ? `${playStatus} · sleeps in ${formatClock(timerLeft)}`
    : playStatus

  const openSaveDialog = () => {
    setSaveName(dirty || mixName === "Shared mix" ? "" : mixName)
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

  // Now playing's body, shared by the phone sheet and the desktop pane: the
  // master, every sound that's on, and what to do with them.
  const nowPlayingRows = (
    <div className="flex flex-col">
      <NowPlayingRow
        icon={
          <HugeiconsIcon
            icon={VolumeHighIcon}
            strokeWidth={2}
            className="size-[18px]"
          />
        }
        name="Master"
        level={master}
        onDrag={dragMaster}
        onCommit={commitMaster}
      />
      <Separator className="my-1" />
      {activeIds.length ? (
        activeIds.map((id) => (
          <NowPlayingRow
            key={id}
            icon={
              <SoundIcon
                path={
                  sounds.find((s) => s.id === id)?.iconPath ??
                  (ytVideoId(id) ? VIDEO_ICON : MUSIC_ICON)
                }
                size={18}
                className="text-brand"
              />
            }
            name={nameFor(id)}
            level={vols[id] ?? 0}
            note={deviceSetsLevel(id) ? DEVICE_LEVEL_NOTE : undefined}
            onDrag={(v) => dragVolume(id, v)}
            onCommit={(v) => commitVolume(id, v)}
            onTurnOff={() => toggleSound(id)}
          />
        ))
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing on yet. Tap a sound to add it.
        </p>
      )}
    </div>
  )
  const nowPlayingActions = (onSave: () => void) => (
    <>
      {canSave ? (
        <Button
          variant="outline"
          className="h-11 rounded-full px-5"
          onClick={onSave}
        >
          Save mix
        </Button>
      ) : (
        <span />
      )}
      <Button
        variant="ghost"
        className="h-11 rounded-full px-4"
        disabled={activeIds.length === 0}
        onClick={turnAllOff}
      >
        Turn all off
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
        aria-label={`${sound.name} volume`}
        aria-valuetext={`${pct}%`}
        onValueChange={(value) => dragVolume(sound.id, (value as number) / 100)}
        onValueCommitted={(value) =>
          commitVolume(sound.id, (value as number) / 100)
        }
      />
    )

    // Hidden at rest and revealed while the card is being worked: hovered or
    // focused. The slider position is the level; the number is only wanted
    // when you are setting one. The width stays reserved so nothing shifts as
    // it appears. Touch is covered because mobile browsers apply :hover for
    // the duration of a touch.
    //
    // A group-has-[[data-dragging]] trigger was tried for the case where the
    // pointer leaves the card mid-drag. It compiles, and the element matches
    // the generated selector, but it never wins the cascade against opacity-0.
    // Not worth more than the two triggers that do work.
    //
    // aria-hidden because the thumb's aria-valuetext already says this.
    const readout = (
      <span
        aria-hidden="true"
        className={cn(
          "w-7 shrink-0 text-right font-mono text-[0.6875rem] tabular-nums opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
          active ? "text-brand" : "text-muted-foreground"
        )}
      >
        {pct}
      </span>
    )

    // Card draws its edge as a ring, not a border, so hover goes on the ring.
    // The press is touch only, where nothing else answers a tap until the
    // sound arrives; a mouse already has hover.
    // While its menu is open the card holds M3's 10% pressed layer, so the
    // menu reads as belonging to it.
    const tileState = cn(
      "rounded-lg shadow-level-1 [transition:background-color_150ms_ease,box-shadow_150ms_ease,scale_120ms_var(--ease-out)] data-popup-open:bg-[color-mix(in_srgb,var(--tile-bg),currentColor_10%)] pointer-coarse:motion-safe:active:scale-[0.98]",
      active
        ? "bg-secondary ring-ring [--tile-bg:var(--secondary)] dark:ring-ring"
        : "[--tile-bg:var(--card)] hover:ring-brand/40 dark:hover:ring-brand/40"
    )
    // With the card, not after it: an icon that snaps while its card fades
    // reads as two changes.
    const iconState = cn(
      "[transition:color_150ms_ease]",
      active ? "text-brand" : "text-muted-foreground"
    )

    const videoId = ytVideoId(sound.id)
    const askRemove = () => removeSound(sound.id)
    const menu = (
      <ContextMenuContent>
        <ContextMenuItem
          // Already the only sound playing, so there is nothing to turn off.
          disabled={lost || (playing && active && activeIds.length === 1)}
          onClick={() => playOnly(sound.id)}
        >
          <HugeiconsIcon icon={HeadphonesIcon} strokeWidth={2} />
          Play only this
        </ContextMenuItem>
        {/* Disabled rather than hidden, as M3 and Windows menus do, so the
            menu keeps its shape and says what it can do. */}
        <ContextMenuItem
          disabled={fixedLevel || !active || volume === DEFAULT_TOGGLE_VOLUME}
          onClick={() => changeVolume(sound.id, DEFAULT_TOGGLE_VOLUME)}
        >
          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
          Reset level
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
              Rename…
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
                Open on YouTube
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={askRemove}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              Remove
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    )
    // Base UI's long press doesn't swallow the click that can follow it, so
    // the card ignores one that lands just after its menu opened.
    // Click and Enter both come here: a missing sound asks for its file.
    const activate = () => {
      if (lost) {
        relinkTarget.current = sound.id
        relinkInput.current?.click()
        return
      }
      toggleSound(sound.id)
    }
    const toggle = () => {
      if (performance.now() - menuOpenedAt.current < 600) return
      activate()
    }
    const noteMenuOpen = (open: boolean) => {
      if (open) menuOpenedAt.current = performance.now()
    }

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
                {MISSING_NOTE}
              </span>
            ) : (
              <>
                <div className="min-w-0 flex-1" {...sliderGuard}>
                  {slider}
                </div>
                {readout}
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
              className={cn("group cursor-pointer gap-0 p-3", tileState)}
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
          {/* The readout sits on the name row rather than the icon row above:
            it right-aligns in the same column as list view, and the icon row is
            a variable-occupancy status corner (EqBars only while playing, the
            remove button only for customs) that a third element would make
            unpredictable. Kept inside the existing line box so the card still
            measures the 83px the "Add sound" tile hard-codes. */}
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
            {lost ? (
              <span className="shrink-0 text-[0.6875rem] text-destructive">
                Missing
              </span>
            ) : (
              !coarse && readout
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
            <LevelBar level={volume} />
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
      className="h-dvh flex-col overflow-hidden pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-foreground select-none"
      // 15rem, not the component's 16rem default: the sidebar was 240px and
      // the sound grid's column count is tuned against the width that leaves.
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      {/* From md up the header sits on the frame beside the sidebar, the two
          reading as one title bar over the inset panel. On a phone there is
          no panel, so it keeps its own surface and rule. */}
      <header className="@container flex shrink-0 items-center border-b bg-background py-3 wide:border-b-0 wide:bg-transparent">
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
            className="hidden size-12 rounded-full bg-primary hover:bg-primary/80 wide:inline-flex"
            disabled={!playing && activeIds.length === 0}
            aria-label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            <HugeiconsIcon
              icon={playing ? PauseIcon : PlayIcon}
              strokeWidth={2}
              className="size-5"
            />
          </Button>

          {/* On touch the name is the way into Now playing, as it is in the
              phone bar: the grid has no sliders there to set levels with. */}
          {coarse ? (
            <button
              type="button"
              aria-haspopup={paneFits ? undefined : "dialog"}
              aria-expanded={paneFits ? pane : undefined}
              onClick={() =>
                paneFits ? setPane((open) => !open) : setNowPlayingOpen(true)
              }
              className="hidden min-h-11 min-w-0 items-center gap-2 rounded-md text-left wide:flex"
            >
              <span className="min-w-0">
                <span className="flex min-w-0 text-sm font-medium">
                  <MiddleTruncate text={mixName} />
                  {dirty && <span className="shrink-0 whitespace-pre"> *</span>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {status}
                </span>
              </span>
              <HugeiconsIcon
                icon={ArrowUp01Icon}
                strokeWidth={2}
                className="size-4 shrink-0 text-muted-foreground"
              />
            </button>
          ) : (
            <div className="hidden min-w-0 wide:block">
              <p className="flex min-w-0 text-sm font-medium">
                <MiddleTruncate text={mixName} />
                {dirty && <span className="shrink-0 whitespace-pre"> *</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{status}</p>
            </div>
          )}

          <div className="flex-1" />

          {/* Playback, then a rule, then this mix and this view. From md, where
              the phone bar stops. The level is always shown here: one number,
              where the cards have fourteen and keep theirs for hover. The
              speaker mutes, as on any player. */}
          <div className="hidden w-52 min-w-0 items-center gap-1.5 @max-5xl:w-28 @max-5xl:min-w-20 wide:flex">
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={master > 0 ? "Mute" : "Unmute"}
              title={master > 0 ? "Mute" : "Unmute"}
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
              aria-label="Master volume"
              aria-valuetext={`${Math.round(master * 100)}%`}
              onValueChange={(value) => dragMaster((value as number) / 100)}
              onValueCommitted={(value) =>
                commitMaster((value as number) / 100)
              }
            />
            {/* A container query, not lg:, so a larger text size counts too:
                rem in a container query follows the root font size. Below it
                the slider and the mix name need the room more. */}
            <span
              aria-hidden="true"
              className="hidden w-7 shrink-0 text-right font-mono text-[0.6875rem] text-muted-foreground tabular-nums @5xl:block"
            >
              {Math.round(master * 100)}
            </span>
          </div>

          <Separator
            orientation="vertical"
            className="mx-1 hidden data-vertical:h-5 data-vertical:self-center wide:block"
          />

          <ToggleGroup
            value={[view]}
            onValueChange={(value) => {
              const next = (value as string[])[0]
              if (next === "grid" || next === "list") setView(next)
            }}
            spacing={0}
            variant="outline"
            size="sm"
            className={coarse ? "hidden" : "hidden sm:flex"}
          >
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <HugeiconsIcon
                icon={GridViewIcon}
                strokeWidth={2}
                className="size-4"
              />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <HugeiconsIcon
                icon={LeftToRightListBulletIcon}
                strokeWidth={2}
                className="size-4"
              />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Shows or hides the Now playing pane; only where it fits. */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden wide:expanded:inline-flex"
            ref={paneToggle}
            aria-label="Now playing"
            aria-pressed={pane}
            title={pane ? "Hide Now playing" : "Show Now playing"}
            onClick={() => setPane((open) => !open)}
          >
            <HugeiconsIcon icon={PanelRightIcon} strokeWidth={2} />
          </Button>

          {/* The same action as Now playing's "Turn all off" on a phone, and
              the same Undo instead of a confirmation. */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden wide:inline-flex"
            aria-label="Turn all off"
            title="Turn all off (Ctrl+R)"
            disabled={activeIds.length === 0}
            onClick={turnAllOff}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="hidden wide:inline-flex"
            // The label goes below lg, so it needs a name of its own there.
            aria-label="Share"
            onClick={share}
          >
            <HugeiconsIcon
              icon={Share01Icon}
              strokeWidth={2}
              className="size-3.5"
            />
            <span className="hidden @5xl:inline">Share</span>
          </Button>

          {/* The phone header keeps two actions, at a finger's 44px. Preferences
              lives in the sidebar footer, which wide:hidden takes away; the sleep
              timer moves to the phone bar. */}
          <div className="-mr-2 flex wide:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-full pointer-coarse:hit-target"
              aria-label="Share"
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
              className="size-11 rounded-full pointer-coarse:hit-target"
              aria-label="Preferences"
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
          className="hidden wide:flex"
        >
          {/* pt-6 matches the panel's p-6, so "Your mixes" sits level with
              the first category heading. */}
          <SidebarContent className="scroll-fade gap-0 px-3 pt-6 scroll-fade-5">
            <SidebarGroup className="gap-1 p-0">
              <SidebarGroupLabel className="h-auto px-2 pb-1 text-label-small text-muted-foreground">
                Your mixes
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
                      <ContextMenuContent>
                        <ContextMenuItem
                          disabled={!(loaded && dirty)}
                          onClick={() => saveChanges(mix.name)}
                        >
                          <HugeiconsIcon
                            icon={FloppyDiskIcon}
                            strokeWidth={2}
                          />
                          Save changes
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => shareMix(mix.name, mix.mix, false)}
                        >
                          <HugeiconsIcon icon={Share01Icon} strokeWidth={2} />
                          Share
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => {
                            setRenameValue(mix.name)
                            setRenaming(mix.name)
                          }}
                        >
                          <HugeiconsIcon
                            icon={PencilEdit02Icon}
                            strokeWidth={2}
                          />
                          Rename…
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => duplicateMix(mix)}>
                          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                          Duplicate
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onClick={() => removeSaved(mix.name)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </SidebarMenu>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start border border-dashed text-muted-foreground"
                onClick={openSaveDialog}
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  strokeWidth={2}
                  className="size-3.5"
                />
                Save mix
              </Button>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="gap-0 px-3 pb-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setTimerOpen(true)}
            >
              <HugeiconsIcon
                icon={Clock01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
              Sleep timer
              <span
                className={cn(
                  "ml-auto font-mono text-xs tabular-nums",
                  timerOn ? "text-brand" : "text-muted-foreground"
                )}
              >
                {timerOn ? formatClock(timerLeft) : "Off"}
              </span>
            </Button>

            <div className="mt-3 flex items-center gap-2 px-1">
              {/* Without this /app is a dead end. The old sidebar had it too. */}
              <a
                className="text-xs text-muted-foreground hover:text-foreground"
                href={`${BASE}/`}
              >
                About
              </a>
              <a
                className="text-xs text-muted-foreground hover:text-foreground"
                href={repoUrl}
                target="_blank"
                rel="noopener"
              >
                GitHub
              </a>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Preferences"
                title="Preferences (Ctrl+P)"
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
                  Your mixes
                </p>
                {/* A label, not a "···": whatever scrolls past the edge is one
                    tap away, and the tap says where it goes. */}
                <Button
                  variant="ghost"
                  className="-mr-2 h-11 px-2 text-xs font-semibold text-brand hover:text-brand pointer-coarse:hit-target"
                  aria-haspopup="dialog"
                  onClick={() => setAllMixesOpen(true)}
                >
                  All mixes
                </Button>
              </div>
              {/* The fade is scroll-aware, so it only marks an edge that still
                  has chips behind it. */}
              {/* Room inside the scroller for the 5px focus ring and the 48px touch
                  target, which it would otherwise clip. The bottom room is
                  taken back from the padding below; the top is not, since it
                  would lie over the All mixes button. */}
              <div className="-mx-4 -mb-2 no-scrollbar flex scroll-fade-x gap-2 overflow-x-auto px-4 pt-1.5 pb-2 scroll-fade-5">
                {saved.map((mix) => (
                  <MixChip
                    key={mix.name}
                    label={mix.name}
                    iconPath={mixIconPath(mix.mix)}
                    active={mix.name === mixName && !dirty}
                    onClick={() => applyMix(mix.name, mix.mix)}
                  />
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
                    Yours
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
                          name: c.name,
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
                        "flex items-center justify-center gap-2 rounded-xl border border-dashed text-xs font-semibold text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground",
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
                      {shownView === "grid"
                        ? "Add sound"
                        : "Add your own sound"}
                    </button>
                  </div>
                </section>
              </div>
            </ScrollArea>
            {pane && (
              <aside
                aria-label="Now playing"
                className="hidden w-[22.5rem] shrink-0 flex-col border-l border-border large:w-[25.75rem] wide:expanded:flex"
              >
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
                  <div className="min-w-0">
                    <h2 className="text-title-medium">Now playing</h2>
                    <p className="flex min-w-0 text-xs text-muted-foreground">
                      <MiddleTruncate text={mixName} />
                      {dirty && (
                        <span className="shrink-0 whitespace-pre">
                          {" "}
                          (edited)
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close Now playing"
                    title="Close"
                    onClick={() => {
                      setPane(false)
                      paneToggle.current?.focus()
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                  </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1" viewportClassName="px-5">
                  {nowPlayingRows}
                </ScrollArea>
                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">
                  {nowPlayingActions(openSaveDialog)}
                </div>
              </aside>
            )}
          </div>

          {prefs.hints && !coarse && (
            <footer className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2 text-[0.6875rem] text-muted-foreground medium:px-6">
              {[
                ["Space", "play"],
                ["↑↓", "volume"],
                ["S", "share"],
                ["T", "timer"],
                [",", "preferences"],
              ].map(([key, action]) => (
                <span key={key}>
                  <b className="font-mono font-semibold text-foreground">
                    {key}
                  </b>{" "}
                  {action}
                </span>
              ))}
            </footer>
          )}

          {/* Phone bar. Play and what is playing live in the header on desktop;
              pinned here they survive the grid scrolling. The name opens Now
              playing, where the levels and the master volume are set, and the
              sleep timer sits beside it, counting down while it runs. Only the
              top is rounded: the bottom meets the screen's own corners. */}
          <div className="flex shrink-0 items-center gap-2.5 rounded-t-m3-xl border-x border-t bg-sidebar px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] wide:hidden">
            <Button
              size="icon"
              className="size-12 shrink-0 rounded-full bg-primary shadow-level-2 hover:bg-primary/80"
              disabled={!playing && activeIds.length === 0}
              aria-label={playing ? "Pause" : "Play"}
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
                  <MiddleTruncate text={mixName} />
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
              className={cn(
                "h-11 shrink-0 gap-1.5 rounded-full bg-transparent pointer-coarse:hit-target",
                timerOn ? "px-3.5" : "w-11 px-0"
              )}
              aria-label={
                timerOn
                  ? `Sleep timer, ${formatClock(timerLeft)} left`
                  : "Sleep timer"
              }
              onClick={() => setTimerOpen(true)}
            >
              <HugeiconsIcon
                icon={Moon02Icon}
                strokeWidth={2}
                className="size-4 text-brand"
              />
              {timerOn && (
                <span className="text-sm font-semibold tabular-nums">
                  {formatClock(timerLeft)}
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
        onOpenChangeComplete={(open) => !open && runAfterClose()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Now playing</DialogTitle>
            <DialogDescription>
              {mixName}
              {dirty && " (edited)"}
            </DialogDescription>
          </DialogHeader>
          {nowPlayingRows}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            {nowPlayingActions(() => {
              afterClose.current = openSaveDialog
              setNowPlayingOpen(false)
            })}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The phone's stand-in for both the sidebar list and the right-click
          menu it can't offer: every mix, and behind each one's ··· the same
          Rename, Duplicate and Delete. A context menu is hidden by default, so
          its actions need a visible way in as well. */}
      <Dialog
        open={allMixesOpen}
        onOpenChange={(open) => {
          setAllMixesOpen(open)
          if (!open) setMixActionsFor(null)
        }}
        onOpenChangeComplete={(open) => !open && runAfterClose()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>All mixes</DialogTitle>
            <DialogDescription>
              Tap a mix to play it, or the dots beside it to rename, duplicate
              or delete it.
            </DialogDescription>
          </DialogHeader>
          <SidebarMenu className="max-h-[50vh] scroll-fade overflow-y-auto scroll-fade-5">
            {saved.map((mix) => {
              const open = mixActionsFor === mix.name
              return (
                <SidebarMenuItem key={mix.name}>
                  <div className="relative flex items-center">
                    <div className="min-w-0 flex-1">
                      <MixRow
                        name={mix.name}
                        mix={mix.mix}
                        loaded={mix.name === mixName}
                        dirty={mix.name === mixName && dirty}
                        className="h-12"
                        onApply={() => {
                          applyMix(mix.name, mix.mix)
                          setAllMixesOpen(false)
                        }}
                      />
                    </div>
                    <Button
                      ref={(el) => {
                        if (el) mixMoreButtons.current.set(mix.name, el)
                        return () => {
                          mixMoreButtons.current.delete(mix.name)
                        }
                      }}
                      variant="ghost"
                      size="icon"
                      className="size-12 shrink-0 rounded-full text-muted-foreground"
                      aria-label={`More for ${mix.name}`}
                      aria-expanded={open}
                      onClick={() => setMixActionsFor(open ? null : mix.name)}
                    >
                      <HugeiconsIcon
                        icon={MoreHorizontalIcon}
                        strokeWidth={2}
                        className="size-5"
                      />
                    </Button>
                  </div>
                  {/* Always mounted, so it can close as well as open. Rows
                      0fr to 1fr is the height of its content without
                      measuring it, and closing is quicker than opening.
                      inert while shut, so its buttons leave the tab order. */}
                  <div
                    inert={!open}
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-opacity",
                      open
                        ? "grid-rows-[1fr] opacity-100 duration-200"
                        : "grid-rows-[0fr] opacity-0 duration-150"
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="flex flex-wrap gap-1 pb-1 pl-8">
                        {mix.name === mixName && dirty && (
                          <Button
                            variant="ghost"
                            className="h-12 px-3"
                            onClick={() => {
                              saveChanges(mix.name)
                              setMixActionsFor(null)
                            }}
                          >
                            Save changes
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="h-12 px-3"
                          onClick={() => {
                            shareMix(mix.name, mix.mix, false)
                            setMixActionsFor(null)
                          }}
                        >
                          Share
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-12 px-3"
                          onClick={() => {
                            afterClose.current = () => {
                              setRenameValue(mix.name)
                              setRenaming(mix.name)
                            }
                            setAllMixesOpen(false)
                            setMixActionsFor(null)
                          }}
                        >
                          Rename…
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-12 px-3"
                          onClick={() => {
                            duplicateMix(mix)
                            setMixActionsFor(null)
                          }}
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-12 px-3 text-destructive hover:text-destructive"
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
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </DialogContent>
      </Dialog>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="content-start max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-lg">Save this mix</DialogTitle>
            <DialogDescription>
              {activeIds.length
                ? `${activeIds.length} sound${activeIds.length === 1 ? "" : "s"} at their current levels.`
                : "Nothing is playing, so the mix will be empty."}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={saveName}
            maxLength={MIX_NAME_MAX}
            placeholder="Name your mix"
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
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMix}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          className="content-start max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none"
          instant={keyDriven}
        >
          <DialogHeader>
            <DialogTitle className="text-lg">Add your own sound</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input
              value={addName}
              maxLength={SOUND_NAME_MAX}
              placeholder="Name (optional)"
              // Otherwise phones offer the user's own name here.
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => setAddName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                value={addUrl}
                placeholder="A YouTube link, or https://…/sound.ogg"
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
              <Button onClick={addFromUrl}>Add</Button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Separator className="flex-1" />
            <span className="text-[0.6875rem] text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-xs font-semibold text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
            <HugeiconsIcon
              icon={Upload04Icon}
              strokeWidth={2}
              className="size-3.5"
            />
            Choose an audio file…
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
        <DialogContent className="sm:max-w-xs" instant={keyDriven}>
          <DialogHeader>
            <DialogTitle className="text-lg">Sleep timer</DialogTitle>
            <DialogDescription>Fades out, then pauses.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {/* Running, the first row stops it and the button beside it adds
                time, which also lifts a fade already under way. */}
            {timerOn && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  className="flex-1 justify-start"
                  onClick={() => startTimer(0)}
                >
                  Turn off ({formatClock(timerLeft)} left)
                </Button>
                <Button variant="outline" onClick={() => extendTimer(15)}>
                  +15 min
                </Button>
              </div>
            )}
            {TIMER_OPTIONS.filter((minutes) => minutes > 0 || !timerOn).map(
              (minutes) => {
                const chosen = timerOn ? timerMinutes === minutes : !minutes
                return (
                  <Button
                    key={minutes}
                    variant="ghost"
                    aria-pressed={chosen}
                    className={cn(
                      "w-full justify-start",
                      chosen && "bg-secondary text-brand hover:text-brand"
                    )}
                    onClick={() => startTimer(minutes)}
                  >
                    {minutes === 0 ? "Off" : formatDuration(minutes)}
                  </Button>
                )
              }
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Custom</span>
              <span className="font-mono text-xs text-brand tabular-nums">
                {formatDuration(customMinutes)}
              </span>
            </div>
            <Slider
              value={customMinutes}
              min={5}
              max={240}
              step={5}
              wheelStep={5}
              resetValue={60}
              aria-label="Custom length"
              aria-valuetext={formatDuration(customMinutes)}
              onValueChange={(value) => setCustomMinutes(value as number)}
            />
            <Button onClick={() => startTimer(customMinutes)}>
              Start {formatDuration(customMinutes)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Opens with "," per the design; Ctrl+P also works, per the desktop. */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        {/* A column that clips: the base DialogContent scrolls itself, which
            put a second scrollbar on this dialog and let the header and footer
            scroll away with the content. Only the body below scrolls now. */}
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden p-0 max-sm:pt-8 max-sm:pb-0 sm:max-w-md"
          instant={keyDriven}
        >
          <DialogHeader className="shrink-0 px-5 py-4">
            <DialogTitle className="text-lg">Preferences</DialogTitle>
          </DialogHeader>

          {/* both-edges, not stable: the scrollbar was eating 10px of the
              right padding, so the content sat 20px from the left and 30 from
              the right. Reserving the gutter on both sides keeps it symmetric,
              and reserving it at all stops the jump when a pref toggle changes
              the content past the scroll threshold. */}
          <div className="flex max-h-[min(60vh,520px)] min-h-0 flex-1 scroll-fade [scrollbar-gutter:stable_both-edges] flex-col gap-5 overflow-y-auto px-5 py-4 scroll-fade-5">
            <PrefSection title="Appearance">
              <div className="mb-2 grid grid-cols-3 gap-0.5 [--segment-radius:var(--radius-m3-lg)] sm:[--segment-radius:var(--radius-lg)]">
                {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
                  <ThemeSwatch
                    key={mode}
                    mode={mode}
                    active={themeMode === mode}
                    onSelect={() => selectTheme(mode)}
                  />
                ))}
              </div>
              <div className={prefGroup}>
                <PrefRow
                  icon={AudioWave01Icon}
                  title="Level meters"
                  description="Animated bars on playing sounds."
                  checked={prefs.eq}
                  onChange={(v) => setPref("eq", v)}
                />
                {!coarse && (
                  <PrefRow
                    icon={KeyboardIcon}
                    title="Keyboard hints"
                    description="Shortcut strip along the bottom."
                    checked={prefs.hints}
                    onChange={(v) => setPref("hints", v)}
                  />
                )}
              </div>
            </PrefSection>

            <PrefSection title="Playback">
              <div className={prefGroup}>
                <PrefSlider
                  icon={ArrowDataTransferHorizontalIcon}
                  title="Fade between sounds"
                  value={prefs.fadeMs}
                  display={
                    prefs.fadeMs < 100
                      ? "Instant"
                      : `${(prefs.fadeMs / 1000).toFixed(1)}s`
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
                  title="Sleep timer fade-out"
                  value={prefs.sleepFade}
                  display={`${prefs.sleepFade}s`}
                  min={2}
                  max={60}
                  step={1}
                  resetValue={DEFAULT_PREFS.sleepFade}
                  onChange={(v) => setPref("sleepFade", v)}
                />
                <PrefRow
                  icon={BrowserIcon}
                  title="Pause in background tabs"
                  description="Stops when you switch away or lock the screen, resumes on return."
                  checked={prefs.pauseHidden}
                  onChange={(v) => setPref("pauseHidden", v)}
                />
                <PrefRow
                  icon={Sun03Icon}
                  title="Keep the screen awake"
                  description="Stops the screen dimming while sounds play."
                  checked={prefs.keepAwake}
                  onChange={(v) => setPref("keepAwake", v)}
                />
                {"audioSession" in navigator && (
                  <PrefRow
                    icon={MusicNote01Icon}
                    title="Play alongside other apps"
                    description="Music keeps playing. The silent switch mutes Murmur, and it stops when the screen locks."
                    checked={prefs.mixWithOthers}
                    onChange={(v) => setPref("mixWithOthers", v)}
                  />
                )}
              </div>
            </PrefSection>

            {
              /* No persistent chrome anywhere for this. A standing "offline"
                badge is redundant with the OS and the browser, and the two
                honest messages (a sound that isn't saved yet, a YouTube sound
                that needs a connection) already appear where they matter. */
            }
            {(pwa.audio || installRow) && (
              <PrefSection title="Offline">
                <div className={prefGroup}>
                  {pwa.audio && (
                    <PrefInfo
                      icon={Download04Icon}
                      title="Built-in sounds"
                      description={
                        <>
                          {pwa.audio.cached} of {pwa.audio.total} saved for
                          offline use.
                          {/* Offline there is nothing to press, so say why. */}
                          {!pwa.online &&
                            pwa.audio.cached < pwa.audio.total &&
                            " Reconnect to download the rest."}
                        </>
                      }
                    >
                      {pwa.online && pwa.audio.cached < pwa.audio.total && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pwa.downloading}
                          onClick={pwa.downloadSounds}
                        >
                          {pwa.downloading
                            ? `Downloading ${pwa.audio.cached} of ${pwa.audio.total}…`
                            : `Download (${formatBytes(pwa.audio.remainingBytes)})`}
                        </Button>
                      )}
                    </PrefInfo>
                  )}
                  {installRow && (
                    <PrefInfo
                      icon={InstallingUpdates01Icon}
                      title="Install Murmur"
                      description={
                        pwa.canInstall
                          ? "Launch it from your dock or home screen."
                          : IS_APPLE_TOUCH
                            ? "Tap Share, then Add to Home Screen."
                            : "Use your browser’s menu, then Install app or Add to Home screen."
                      }
                    >
                      {pwa.canInstall && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void pwa.install()}
                        >
                          Install
                        </Button>
                      )}
                    </PrefInfo>
                  )}
                </div>
              </PrefSection>
            )}

            <PrefSection title="Your data">
              <div className={prefGroup}>
                <PrefInfo
                  icon={Database01Icon}
                  title="Kept in this browser"
                  description={
                    saved.length || customs.length
                      ? `${saved.length} saved ${saved.length === 1 ? "mix" : "mixes"} and ${customs.length} ${customs.length === 1 ? "sound" : "sounds"} of your own.`
                      : "Nothing saved yet."
                  }
                >
                  {/* Armed, it turns destructive red. Both labels share one
                    grid cell and the hidden one keeps its width, so the
                    button holds the wider label's size and the text beside it
                    doesn't reflow. */}
                  <Button
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
                        Clear all
                      </span>
                      <span
                        className={cn(
                          "col-start-1 row-start-1",
                          !dataArmed && "invisible"
                        )}
                      >
                        Sure?
                      </span>
                    </span>
                  </Button>
                </PrefInfo>
                <PrefInfo
                  icon={Archive01Icon}
                  title="Backup"
                  description="Save your mixes and sounds to a file, or add them from one."
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saved.length === 0 && customs.length === 0}
                    onClick={() => void exportBackup()}
                  >
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importInput.current?.click()}
                  >
                    Import
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

            <PrefSection title="About">
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
                      Ambient sound mixer that runs in your browser.
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
                  <span className="flex-1">Source</span>
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
                  <span className="flex-1">Credits</span>
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
                  Copy build info
                </button>

                {/* The tint is a gradient layer, so it lies over the tile's
                    fill rather than replacing it. Narrow, the button drops
                    under the text instead of squeezing it. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-linear-to-b from-brand/5 to-brand/5 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-body-large">Free, no accounts, no ads</p>
                    <p className="mt-0.5 text-body-medium text-muted-foreground">
                      If Murmur helps you focus or sleep, you can chip in for
                      the hosting.
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
                    Support
                  </a>
                </div>
              </div>
            </PrefSection>
          </div>

          {/* This dialog sets p-0, which takes the sheet's safe-area padding
              with it, so the footer has to clear the home indicator itself.
              It sits a layer below the dialog's background-3, on the
              background-2 popovers use, the way a WinUI ContentDialog's command
              area does, so it reads as the dialog's base rather than more of
              its content. */}
          <div className="flex shrink-0 items-center gap-3 border-t border-border bg-popover px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:pb-3">
            {!coarse && (
              <span>
                Press{" "}
                <b className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                  ,
                </b>{" "}
                to open this
              </span>
            )}
            <span className="flex-1" />
            {/* Undo rather than a confirmation: this only resets the rows
                above, and on a phone a confirmation would be a second sheet
                over this one. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={prefsAreDefault}
              onClick={() => {
                const previous = prefs
                setPrefs({ ...DEFAULT_PREFS })
                toast.success("Preferences restored to defaults", {
                  id: "prefs-restored",
                  action: { label: "Undo", onClick: () => setPrefs(previous) },
                })
              }}
            >
              Restore defaults
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RenameDialog
        open={renaming !== null}
        title="Rename mix"
        placeholder="Name your mix"
        value={renameValue}
        maxLength={MIX_NAME_MAX}
        onValueChange={setRenameValue}
        onRename={renameMix}
        onCancel={() => setRenaming(null)}
      />
      <RenameDialog
        open={renamingSound !== null}
        title="Rename sound"
        placeholder="Name your sound"
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
