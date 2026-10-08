"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Clock01Icon,
  Copy01Icon,
  Database01Icon,
  Download04Icon,
  FavouriteIcon,
  File01Icon,
  GithubIcon,
  GridViewIcon,
  InformationCircleIcon,
  LeftToRightListBulletIcon,
  Moon02Icon,
  PauseIcon,
  PlayIcon,
  PlusSignIcon,
  RefreshIcon,
  Settings01Icon,
  Share01Icon,
  Upload04Icon,
  VolumeHighIcon,
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
  SidebarHeader,
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
  loadPersisted,
  savePersisted,
  type CustomSound,
  type PersistedState,
  type Prefs,
  type SavedMix,
  type View,
} from "@/lib/app-state"
import { deleteBlob, getAllBlobs, putBlob } from "@/lib/blob-store"
import {
  Mixer,
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
import { cn } from "@/lib/utils"

import { SoundIcon } from "./SoundIcon"
import { usePwa } from "./use-pwa"

/** Vite inlines this at build time, in client islands as well as .astro files. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const TIMER_OPTIONS = [0, 15, 30, 45, 60, 90]
const CATEGORIES: SoundCategory[] = ["nature", "urban", "generated"]
const DEFAULT_TOGGLE_VOLUME = 0.7
const CATALOG_IDS = new Set(sounds.map((s) => s.id))
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

const ytSoundId = (videoId: string) => `${YT_PREFIX}${videoId}`

const ytVideoId = (id: string): string | null => {
  if (!id.startsWith(YT_PREFIX)) return null
  const videoId = id.slice(YT_PREFIX.length)
  return isVideoId(videoId) ? videoId : null
}

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

/** Two links and a button sit in one row, so they have to read as one set. */
const aboutLink =
  "flex h-[30px] items-center gap-[7px] rounded-[5px] px-2.5 text-xs font-semibold text-foreground/85 transition-colors hover:bg-accent hover:text-foreground"

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
function MixRow({ name, mix, loaded, dirty, onApply, onRemove }: MixRowProps) {
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
          "h-[34px] gap-[7px] rounded-[7px] px-2.5 text-[13px] leading-[17px] font-semibold data-active:font-semibold",
          !loaded && "text-foreground/85"
        )}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          <SoundIcon path={mixIconPath(mix)} size={13} strokeWidth={1.9} />
        </span>
        <span>{name}</span>
      </SidebarMenuButton>
      {/* The component centres itself with top-*, keyed to the peer button's
          data-size. top-2 centres a 20px action in the default 36px row. This
          row is 34 with a 22px action, so the override has to be that same peer
          variant: a plain top-* loses to it, and a translate on top of the 8px
          it resolves to lifts the × clean out of the row. */}
      {onRemove && (
        <SidebarMenuAction
          showOnHover
          // [&>svg]:size-3 rather than a size on the icon: the base sets
          // [&>svg]:size-4 with no opt-out, and a descendant rule outranks a
          // class on the child. Same utility family, so cn() dedupes it.
          className="right-1 size-[22px] w-[22px] rounded-[5px] text-muted-foreground peer-data-[size=default]/menu-button:top-1.5 hover:bg-elevated hover:text-foreground [&>svg]:size-3"
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

/** The row's phone form: below md the sidebar is gone and mixes become chips. */
function MixChip({
  label,
  iconPath,
  active,
  dashed,
  onClick,
}: {
  label: string
  iconPath?: string
  active?: boolean
  dashed?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-[7px] rounded-full border px-[13px] text-xs font-semibold whitespace-nowrap transition-colors",
        dashed
          ? "border-dashed text-muted-foreground"
          : active
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-muted text-foreground/85 hover:bg-accent"
      )}
    >
      {iconPath && (
        <SoundIcon
          path={iconPath}
          size={12}
          strokeWidth={1.9}
          className="size-3 shrink-0"
        />
      )}
      {label}
    </button>
  )
}

interface RenderableSound {
  id: string
  name: string
  iconPath: string
}

/**
 * Touches localStorage, so this only works because the island is client:only.
 * loadPersisted() also runs the v1 migration; it must stay on this synchronous
 * first-render path, ahead of the IndexedDB sweep effect. See lib/app-state.ts.
 */
function readInitialState(): {
  state: PersistedState
  /** How many YouTube sounds a link brought in, so arrival can be announced. */
  sharedVideos: number
} {
  const state = loadPersisted()
  let sharedVideos = 0

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const shared = params.get("mix")
  if (shared) {
    // Catalog sounds travel, and so do YouTube ones since the id is the whole
    // reference. A file import is a blob in the sender's browser and a link
    // import may not be public, so neither resolves to anything here.
    const mix = Object.fromEntries(
      Object.entries(decodeMix(shared)).filter(
        ([id]) => CATALOG_IDS.has(id) || ytVideoId(id)
      )
    )
    if (Object.keys(mix).length) {
      state.vols = mix
      state.mixName = params.get("n")?.trim() || "Shared mix"
      state.dirty = false

      // A link can name a video this browser has never seen, so its custom has
      // to exist before the mixer goes looking. Nothing it carries can make a
      // sound on its own: the app always boots paused, and ytVideoId has
      // already held every id to YouTube's 11-character alphabet.
      for (const id of Object.keys(mix)) {
        const videoId = ytVideoId(id)
        if (!videoId || state.customs.some((c) => c.id === id)) continue
        state.customs.push({ id, name: YT_PLACEHOLDER_NAME, videoId })
        sharedVideos++
      }
    }
  }

  return { state, sharedVideos }
}

function formatClock(totalSeconds: number): string {
  const s = Math.ceil(totalSeconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

function EqBars() {
  return (
    <div className="flex h-3 items-end gap-0.5" aria-hidden="true">
      {[0.9, 1.2, 0.7].map((duration, i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-brand"
          style={{
            height: "100%",
            animation: `murmur-eq ${duration}s ease-in-out ${-i * 0.3}s infinite`,
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
        "rounded-md border p-[9px_9px_8px] text-left transition-colors hover:border-brand",
        active ? "border-brand bg-brand/10" : "border-border"
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
          "mt-[7px] block text-xs font-semibold",
          active ? "text-brand" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  )
}

function PrefRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3.5 px-3.5 py-3 transition-colors hover:bg-accent/60">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function PrefSlider({
  title,
  value,
  display,
  min,
  max,
  step,
  largeStep,
  resetValue,
  minLabel,
  maxLabel,
  onChange,
}: {
  title: string
  value: number
  display: string
  min: number
  max: number
  step: number
  largeStep?: number
  resetValue: number
  minLabel: string
  maxLabel: string
  onChange: (value: number) => void
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="font-mono text-xs text-brand tabular-nums">
          {display}
        </span>
      </div>
      <div className="my-3">
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
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
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
  icon,
  title,
  children,
}: {
  icon: typeof PlayIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3" />
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Stops propagation so removing never also toggles the card it sits in. */
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
        "size-[22px] shrink-0 rounded-[5px] text-muted-foreground hover:bg-accent hover:text-foreground",
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
  const [saved, setSaved] = React.useState<SavedMix[]>(initial.saved)
  const [customs, setCustoms] = React.useState<CustomSound[]>(initial.customs)
  const [playing, setPlaying] = React.useState(false)
  const [timerEnd, setTimerEnd] = React.useState(0)
  const [timerLeft, setTimerLeft] = React.useState(0)
  const [saveOpen, setSaveOpen] = React.useState(false)
  // Not persisted: a reload brings the starters back, so dismissing declutters
  // the session without losing the only invitation an empty sidebar has.
  const [allMixesOpen, setAllMixesOpen] = React.useState(false)
  const [timerOpen, setTimerOpen] = React.useState(false)
  const [addOpen, setAddOpen] = React.useState(false)
  const [saveName, setSaveName] = React.useState("")
  const [addName, setAddName] = React.useState("")
  const [addUrl, setAddUrl] = React.useState("")
  const [prefs, setPrefs] = React.useState<Prefs>(initial.prefs)
  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }))

  // Theme is the site's, not the app's: it lives under its own localStorage key
  // so the landing page's toggle and this picker move the same setting.
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(readThemeMode)
  const selectTheme = (mode: ThemeMode) => {
    setThemeMode(mode)
    writeThemeMode(mode)
  }
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [removing, setRemoving] = React.useState<CustomSound | null>(null)
  const [dataArmed, setDataArmed] = React.useState(false)

  const pwa = usePwa()
  const audioStarted = React.useRef(false)
  const fadeMult = React.useRef(1)
  // Ids that failed to load while offline, so reconnecting can offer them back
  // rather than leaving the user to rediscover which cards went dark.
  const offlineFailures = React.useRef(new Set<string>())
  // Seeded from boot state so a reload doesn't forget the level of a sound that
  // is already audible.
  const lastNonZero = React.useRef<MixerState>({ ...initial.vols })
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
        ? `Couldn't load ${nameFor(id)}. This browser may not support the file`
        : `${nameFor(id)} isn't saved for offline use yet. Reconnect to add it`,
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
      { id, name: name || YT_PLACEHOLDER_NAME, videoId },
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
      toast("That doesn't look like a link")
      return
    }
    const id = `cu${Date.now()}`
    commitCustoms([
      ...customsRef.current,
      { id, name: addName.trim() || host, url },
    ])
    setAddOpen(false)
    changeVolume(id, DEFAULT_TOGGLE_VOLUME, { keepName: true })
  }

  const addFromFile = (file: File) => {
    const id = `cf${Date.now()}`
    blobUrls.current.set(id, URL.createObjectURL(file))
    const name = addName.trim() || file.name.replace(/\.[^.]+$/, "")
    commitCustoms([...customsRef.current, { id, name }])
    setAddOpen(false)
    changeVolume(id, DEFAULT_TOGGLE_VOLUME, { keepName: true })
    void putBlob(id, file).then((stored) => {
      if (stored) {
        commitCustoms(
          customsRef.current.map((c) =>
            c.id === id ? { ...c, hasFile: true } : c
          )
        )
      } else {
        toast("Couldn't save the file. It'll play until you close this tab")
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
    commitCustoms(customsRef.current.filter((c) => c.id !== id))
    setVols((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const toggleSound = (id: string) => {
    const current = vols[id] ?? 0
    if (current > 0) {
      lastNonZero.current[id] = current
      changeVolume(id, 0)
    } else {
      changeVolume(id, lastNonZero.current[id] ?? DEFAULT_TOGGLE_VOLUME)
    }
  }

  const togglePlay = () => {
    ensureAudio()
    const next = !playing
    setPlaying(next)
    mixer.setPlaying(next)
  }

  const changeMaster = (value: number, ramp: VolumeRamp = "adjust") => {
    ensureAudio()
    const v = Math.max(0, Math.min(1, Math.round(value * 100) / 100))
    setMaster(v)
    mixer.setMasterVolume(v * fadeMult.current, ramp)
  }

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
    ensureAudio()
    // Walk the union so sounds dropped by the incoming mix are actively zeroed.
    const union = new Set([...Object.keys(vols), ...Object.keys(mix)])
    setVols({ ...mix })
    setMixName(name)
    setDirty(false)
    setPlaying(true)
    union.forEach((id) => void applyVolume(id, mix[id] ?? 0, "fade"))
    mixer.setPlaying(true)
  }

  const allMixes = saved

  const cycleMix = (delta: number) => {
    if (allMixes.length < 2) return
    const at = allMixes.findIndex((m) => m.name === mixName)
    const next = allMixes[(at + delta + allMixes.length) % allMixes.length]
    applyMix(next.name, next.mix)
  }

  const resetMix = () => {
    setResetOpen(false)
    for (const id of Object.keys(vols)) {
      if (audioStarted.current) void mixer.setVolume(id, 0)
    }
    setVols({})
    setDirty(true)
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

  const removeSaved = (name: string) => {
    setSaved((prev) => prev.filter((s) => s.name !== name))
    // Still loaded but no longer stored, so it must read as unsaved.
    if (name === mixName) setDirty(true)
  }

  const duplicateMix = (mix: SavedMix) => {
    // Desktop leaves the active mix alone after duplicating.
    const base = `${mix.name} copy`
    let name = base
    for (let n = 2; saved.some((s) => s.name === name); n++)
      name = `${base} ${n}`
    setSaved((prev) => {
      const at = prev.findIndex((s) => s.name === mix.name)
      const next = [...prev]
      next.splice(at + 1, 0, { name, mix: { ...mix.mix } })
      return next
    })
    toast.success(`Duplicated as “${name}”`)
  }

  /** First press arms and self-disarms after 3s; the second actually wipes. */
  const clearData = () => {
    if (!dataArmed) {
      setDataArmed(true)
      window.setTimeout(() => setDataArmed(false), 3000)
      return
    }
    setDataArmed(false)
    for (const c of customsRef.current) {
      if (audioStarted.current) void mixer.setVolume(c.id, 0)
      if (c.videoId) mixer.unregister(c.id)
      const url = blobUrls.current.get(c.id)
      if (url) URL.revokeObjectURL(url)
      void deleteBlob(c.id)
    }
    blobUrls.current.clear()
    commitCustoms([])
    setSaved([])
    setVols((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => CATALOG_IDS.has(id))
      )
    )
    toast.success("Saved mixes and imported sounds cleared")
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
    toast.success(`Saved “${name}”`)
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
      () => toast("Couldn't copy the build info")
    )
  }

  const share = () => {
    const mix: MixerState = {}
    for (const [id, v] of Object.entries(vols)) {
      // YouTube sounds travel: the id carries the whole reference. Files and
      // links don't. One is a blob only this browser holds, the other may not
      // be reachable from anywhere else.
      if (v > 0 && (CATALOG_IDS.has(id) || ytVideoId(id))) {
        mix[id] = Math.round(v * 100) / 100
      }
    }
    const droppedCustoms = customs.some(
      (c) => !c.videoId && (vols[c.id] ?? 0) > 0
    )
    const fragment = encodeMix(mix)
    if (!fragment) {
      toast(
        droppedCustoms
          ? "Only your imported sounds are playing, and those can't be shared"
          : "Nothing playing to share yet"
      )
      return
    }
    const url = `${window.location.origin}${window.location.pathname}#mix=${fragment}&n=${encodeURIComponent(mixName)}`
    const done = () =>
      droppedCustoms
        ? toast.success("Link copied. Your imported sounds aren't included")
        : toast.success("Link copied")
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done, done)
    } else {
      window.history.replaceState(null, "", url)
      toast("Link is in the address bar")
    }
  }

  const startTimer = (minutes: number) => {
    fadeMult.current = 1
    setTimerOpen(false)
    if (!minutes) {
      setTimerEnd(0)
      setTimerLeft(0)
      if (audioStarted.current) mixer.setMasterVolume(master)
      return
    }
    setTimerEnd(Date.now() + minutes * 60_000)
    setTimerLeft(minutes * 60)
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
            ? { ...c, name: title }
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

  React.useEffect(() => {
    if (!boot.sharedVideos) return
    toast(
      boot.sharedVideos === 1
        ? "This link added a YouTube sound to your mixer"
        : `This link added ${boot.sharedVideos} YouTube sounds to your mixer`
    )
  }, [boot.sharedVideos])

  // Restore file imports from IndexedDB, healing both directions: metadata
  // whose blob is gone is dropped, blobs with no metadata are deleted.
  React.useEffect(() => {
    let cancelled = false
    void getAllBlobs().then((blobs) => {
      if (cancelled) return
      for (const id of blobs.keys()) {
        if (!customsRef.current.some((c) => c.id === id)) void deleteBlob(id)
      }
      const restored = customsRef.current.filter((c) => {
        if (!c.hasFile) return true
        const blob = blobs.get(c.id)
        if (!blob) return false
        blobUrls.current.set(c.id, URL.createObjectURL(blob))
        return true
      })
      if (restored.length === customsRef.current.length) return
      commitCustoms(restored)
      const known = (id: string) =>
        CATALOG_IDS.has(id) || restored.some((c) => c.id === id)
      setVols((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => known(id)))
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
        saved,
        customs,
        prefs,
      })
    }, 250)
    return () => window.clearTimeout(id)
  }, [vols, master, mixName, dirty, view, saved, customs, prefs])

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

  // "Pause in background tabs": stop on hide, resume only if we were the one
  // who paused, so a deliberate pause isn't undone on return.
  React.useEffect(() => {
    if (!prefs.pauseHidden) return
    let pausedByUs = false
    const onVisibility = () => {
      if (document.hidden) {
        if (playing) {
          pausedByUs = true
          setPlaying(false)
          mixer.setPlaying(false)
        }
      } else if (pausedByUs) {
        pausedByUs = false
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
    toast(`All ${status.total} sounds are saved for offline use`, {
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
      toast("You're back online", {
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
      ["play", () => !playing && togglePlay()],
      ["pause", () => playing && togglePlay()],
      ["nexttrack", () => cycleMix(1)],
      ["previoustrack", () => cycleMix(-1)],
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
  })

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      // Desktop accelerators. Ctrl+P is the browser's print shortcut, so it
      // has to be actively claimed to match the desktop's Preferences binding.
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase()
        if (key === "r" && !e.shiftKey) {
          e.preventDefault()
          if (Object.keys(vols).length) setResetOpen(true)
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
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        changeMaster(master - 0.05)
      } else if (e.key === "s" || e.key === "S") {
        share()
      } else if (e.key === "t" || e.key === "T") {
        setTimerOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const status = [
    activeIds.length === 1 ? "1 sound" : `${activeIds.length} sounds`,
    playing ? "playing" : "paused",
    ...(timerOn ? [`sleeps in ${formatClock(timerLeft)}`] : []),
  ].join(" · ")

  // Starters stand in for an empty list, so they return if every mix is deleted.

  const renderSound = (sound: RenderableSound, removable = false) => {
    const volume = vols[sound.id] ?? 0
    const active = volume > 0
    const pct = Math.round(volume * 100)

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
          "w-7 shrink-0 text-right font-mono text-[11px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
          active ? "text-brand" : "text-muted-foreground"
        )}
      >
        {pct}
      </span>
    )

    if (view === "list") {
      return (
        <Card
          key={sound.id}
          role="button"
          tabIndex={0}
          aria-pressed={active}
          onClick={() => toggleSound(sound.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") toggleSound(sound.id)
          }}
          className={cn(
            "group flex cursor-pointer flex-row items-center gap-3 px-4 py-3 transition-colors",
            active ? "border-brand bg-secondary" : "hover:border-brand/50"
          )}
        >
          <SoundIcon
            path={sound.iconPath}
            size={17}
            className={active ? "text-brand" : "text-muted-foreground"}
          />
          <span className="w-28 shrink-0 truncate text-xs font-medium">
            {sound.name}
          </span>
          <div className="min-w-0 flex-1" {...sliderGuard}>
            {slider}
          </div>
          {readout}
          {removable && (
            <RemoveSoundButton
              name={sound.name}
              onRemove={() =>
                setRemoving(
                  customsRef.current.find((c) => c.id === sound.id) ?? null
                )
              }
            />
          )}
        </Card>
      )
    }

    return (
      <Card
        key={sound.id}
        role="button"
        tabIndex={0}
        aria-pressed={active}
        onClick={() => toggleSound(sound.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") toggleSound(sound.id)
        }}
        className={cn(
          "group cursor-pointer gap-0 p-3 transition-colors",
          active ? "border-brand bg-secondary" : "hover:border-brand/50"
        )}
      >
        <div className="flex items-start gap-1.5">
          <SoundIcon
            path={sound.iconPath}
            size={19}
            className={active ? "text-brand" : "text-muted-foreground"}
          />
          <div className="flex-1" />
          {active && playing && prefs.eq && <EqBars />}
          {removable && (
            <RemoveSoundButton
              name={sound.name}
              className="-mt-1 -mr-1.5"
              onRemove={() =>
                setRemoving(
                  customsRef.current.find((c) => c.id === sound.id) ?? null
                )
              }
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
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {sound.name}
          </span>
          {readout}
        </div>
        <div {...sliderGuard}>{slider}</div>
      </Card>
    )
  }

  return (
    // SidebarProvider is the app root rather than a wrapper around it: it
    // already renders the flex row this layout needs, and Sidebar reads its
    // context even under collapsible="none".
    <SidebarProvider
      // select-none because this reads as an app, not a document: dragging a
      // slider or a card would otherwise smear a text selection across the
      // labels beside it. Dialogs and toasts portal to <body>, outside this
      // subtree, so anything genuinely worth copying stays selectable.
      className="h-dvh overflow-hidden bg-background text-foreground select-none"
      // 15rem, not the component's 16rem default: the sidebar was 240px and
      // the sound grid's column count is tuned against the width that leaves.
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      {/* collapsible="none": below md the mixes become the chip strip and the
          overflow dialog, so the off-canvas drawer would be a second, competing
          answer to the same problem. */}
      <Sidebar collapsible="none" className="hidden border-r md:flex">
        <SidebarHeader className="flex-row items-center gap-[7px] px-5 pt-4 pb-2">
          <BrandMark />
          <span className="font-serif text-[17px] font-semibold tracking-tight">
            Murmur
          </span>
        </SidebarHeader>

        <SidebarContent className="scroll-fade gap-0 px-3 scroll-fade-5">
          <SidebarGroup className="gap-1 p-0">
            <SidebarGroupLabel className="h-auto px-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Your mixes
            </SidebarGroupLabel>
            <SidebarMenu>
              {saved.map((mix) => {
                const loaded = mix.name === mixName
                return (
                  <ContextMenu key={mix.name}>
                    {/* The <li> is the trigger: a trigger wrapped around the item
                    would sit between the <ul> and its children. */}
                    <ContextMenuTrigger render={<SidebarMenuItem />}>
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
                        onClick={() => {
                          setRenameValue(mix.name)
                          setRenaming(mix.name)
                        }}
                      >
                        Rename…
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => duplicateMix(mix)}>
                        Duplicate
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => removeSaved(mix.name)}>
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
              onClick={() => {
                setSaveName(dirty || mixName === "Shared mix" ? "" : mixName)
                setSaveOpen(true)
              }}
            >
              <HugeiconsIcon
                icon={PlusSignIcon}
                strokeWidth={2}
                className="size-3.5"
              />
              Save current mix
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

          <Separator className="my-3" />

          <div className="flex items-center gap-2 px-1">
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

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 md:px-6">
          {/* Play, title and status move to the phone transport bar, so the
              small header carries the wordmark the hidden sidebar took. */}
          <Button
            size="icon-lg"
            className="hidden rounded-full md:inline-flex"
            aria-label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            <HugeiconsIcon
              icon={playing ? PauseIcon : PlayIcon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>

          {/* The whole lockup, not just the word. gap-[7px] matches the one
              in SidebarHeader, so the two never read as different marks. */}
          <div className="flex items-center gap-[7px] md:hidden">
            <BrandMark />
            <span className="font-serif text-[17px] font-semibold tracking-tight">
              Murmur
            </span>
          </div>

          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-medium">
              {mixName}
              {dirty && " *"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{status}</p>
          </div>

          <div className="flex-1" />

          <ToggleGroup
            value={[view]}
            onValueChange={(value) => {
              const next = (value as string[])[0]
              if (next === "grid" || next === "list") setView(next)
            }}
            spacing={0}
            variant="outline"
            size="sm"
            className="hidden sm:flex"
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

          <div className="group hidden w-48 items-center gap-2 lg:flex">
            <HugeiconsIcon
              icon={VolumeHighIcon}
              strokeWidth={2}
              className="size-4 shrink-0 text-muted-foreground"
            />
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
            <span
              aria-hidden="true"
              className="w-7 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {Math.round(master * 100)}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reset mix"
            title="Reset mix (Ctrl+R)"
            disabled={activeIds.length === 0}
            onClick={() => setResetOpen(true)}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>

          <Button variant="outline" size="sm" onClick={share}>
            <HugeiconsIcon
              icon={Share01Icon}
              strokeWidth={2}
              className="size-3.5"
            />
            <span className="hidden sm:inline">Share</span>
          </Button>

          {/* Both live in the sidebar footer, which md:hidden takes away. */}
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("md:hidden", timerOn && "text-brand")}
            aria-label="Sleep timer"
            title="Sleep timer (T)"
            onClick={() => setTimerOpen(true)}
          >
            <HugeiconsIcon
              icon={Clock01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
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
        </header>

        {/* Below md the sidebar is hidden, so the mixes need a home of their
            own or a phone visitor has no way to load or save one. The `||` is
            what keeps + Save reachable: with every mix deleted this strip is the
            only route to it, so it has to survive an empty list. */}
        {(saved.length > 0 || activeIds.length > 0) && (
          <div className="flex shrink-0 flex-col px-4 pt-2.5 pb-3 md:hidden">
            {saved.length > 0 && (
              <p className="pb-[7px] text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Your mixes
              </p>
            )}
            <div className="flex items-center gap-2">
              {/* The fade is scroll-aware, so it only marks an edge that still
                has chips behind it, which the ··· button alone cannot say. */}
              <div className="no-scrollbar flex min-w-0 flex-1 scroll-fade-x gap-2 overflow-x-auto scroll-fade-5">
                {saved.map((mix) => (
                  <MixChip
                    key={mix.name}
                    label={mix.name}
                    iconPath={mixIconPath(mix.mix)}
                    active={mix.name === mixName && !dirty}
                    onClick={() => applyMix(mix.name, mix.mix)}
                  />
                ))}
                {activeIds.length > 0 && (
                  <MixChip
                    label="+ Save"
                    dashed
                    onClick={() => {
                      setSaveName(
                        dirty || mixName === "Shared mix" ? "" : mixName
                      )
                      setSaveOpen(true)
                    }}
                  />
                )}
              </div>
              {/* Pinned outside the scroller so whatever scrolls past the edge,
                and the rename/delete that right-click carries on desktop,
                stays reachable. */}
              {saved.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 rounded-full bg-transparent text-base leading-none"
                  aria-label="More mixes"
                  title="More mixes"
                  onClick={() => setAllMixesOpen(true)}
                >
                  ···
                </Button>
              )}
            </div>
          </div>
        )}

        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade scroll-fade-6"
        >
          <div className="space-y-6 p-4 md:p-6">
            {CATEGORIES.map((category) => (
              <section key={category}>
                <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  {categoryLabel[category]}
                </h2>
                <div
                  className={cn(
                    view === "grid"
                      ? "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5"
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
              <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Yours
              </h2>
              <div
                className={cn(
                  view === "grid"
                    ? "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5"
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
                    view === "grid" ? "min-h-[83px] flex-col p-3" : "px-4 py-3"
                  )}
                >
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    strokeWidth={2}
                    className="size-4"
                  />
                  {view === "grid" ? "Add sound" : "Add your own sound"}
                </button>
              </div>
            </section>
          </div>
        </ScrollArea>

        {prefs.hints && (
          <footer className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted-foreground md:px-6">
            {[
              ["Space", "play"],
              ["↑↓", "volume"],
              ["S", "share"],
              ["T", "timer"],
              [",", "preferences"],
            ].map(([key, action]) => (
              <span key={key}>
                <b className="font-mono font-semibold text-foreground">{key}</b>{" "}
                {action}
              </span>
            ))}
          </footer>
        )}

        {/* Phone transport. Play, what is playing, and master volume all live
            in the header or sidebar on desktop; pinned here they survive the
            grid scrolling and stop the small header from overflowing. */}
        <div className="flex shrink-0 items-center gap-[11px] border-t px-3.5 pt-2.5 pb-3 md:hidden">
          <Button
            size="icon"
            className="size-11 shrink-0 rounded-full shadow-md"
            aria-label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            <HugeiconsIcon
              icon={playing ? PauseIcon : PlayIcon}
              strokeWidth={2}
              className="size-[15px]"
            />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">
              {mixName}
              {dirty && " *"}
            </p>
            <p className="mt-px truncate text-[11px] text-muted-foreground">
              {status}
            </p>
          </div>

          <HugeiconsIcon
            icon={VolumeHighIcon}
            strokeWidth={2}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          {/* No readout on this one. A phone has no hover, so it could only
              ever appear mid-drag, and permanently reserving 28px of the
              tightest row in the app to show a number that briefly sits under
              your own thumb is a bad trade. */}
          {/* Width lives on a wrapper: the Slider root's own
              data-horizontal:w-full outranks any bare w-* passed to it. */}
          <div className="w-[76px] shrink-0">
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
          </div>
        </div>
      </main>

      {/* The phone's stand-in for both the sidebar list and the right-click
          menu it can't offer: every mix, each with its delete. */}
      <Dialog open={allMixesOpen} onOpenChange={setAllMixesOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Your mixes</DialogTitle>
            <DialogDescription>Load or delete a saved mix.</DialogDescription>
          </DialogHeader>
          <SidebarMenu className="max-h-[50vh] scroll-fade overflow-y-auto scroll-fade-5">
            {saved.map((mix) => (
              <SidebarMenuItem key={mix.name}>
                <MixRow
                  name={mix.name}
                  mix={mix.mix}
                  loaded={mix.name === mixName}
                  dirty={mix.name === mixName && dirty}
                  onApply={() => {
                    applyMix(mix.name, mix.mix)
                    setAllMixesOpen(false)
                  }}
                  onRemove={() => removeSaved(mix.name)}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </DialogContent>
      </Dialog>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
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
            placeholder="Name your mix"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Add your own sound</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input
              value={addName}
              placeholder="Name (optional)"
              onChange={(e) => setAddName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                value={addUrl}
                placeholder="A YouTube link, or https://…/sound.ogg"
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
            <span className="text-[11px] text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-xs font-semibold text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground">
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

          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Links and files are saved in your browser. Sounds loop
            automatically.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={timerOpen} onOpenChange={setTimerOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-lg">Sleep timer</DialogTitle>
            <DialogDescription>Fades out, then pauses.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {TIMER_OPTIONS.map((minutes) => (
              <Button
                key={minutes}
                variant="ghost"
                className={cn(
                  "w-full justify-start",
                  !timerOn &&
                    minutes === 0 &&
                    "bg-brand/12 text-brand hover:bg-brand/15 hover:text-brand"
                )}
                onClick={() => startTimer(minutes)}
              >
                {minutes === 0
                  ? timerOn
                    ? `Turn off (${formatClock(timerLeft)} left)`
                    : "Off"
                  : `${minutes} minutes`}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Opens with "," per the design; Ctrl+P also works, per the desktop. */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        {/* A column that clips: the base DialogContent scrolls itself, which
            put a second scrollbar on this dialog and let the header and footer
            scroll away with the content. Only the body below scrolls now. */}
        <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 max-sm:pb-0 sm:max-w-md">
          <DialogHeader className="shrink-0 px-5 py-4">
            <DialogTitle className="text-lg">Preferences</DialogTitle>
          </DialogHeader>

          {/* both-edges, not stable: the scrollbar was eating 10px of the
              right padding, so the content sat 20px from the left and 30 from
              the right. Reserving the gutter on both sides keeps it symmetric,
              and reserving it at all stops the jump when a pref toggle changes
              the content past the scroll threshold. */}
          <div className="flex max-h-[min(60vh,520px)] min-h-0 flex-1 scroll-fade [scrollbar-gutter:stable_both-edges] flex-col gap-5 overflow-y-auto px-5 py-4 scroll-fade-5">
            <PrefSection icon={Moon02Icon} title="Appearance">
              <div className="mb-2.5 grid grid-cols-3 gap-2">
                {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
                  <ThemeSwatch
                    key={mode}
                    mode={mode}
                    active={themeMode === mode}
                    onSelect={() => selectTheme(mode)}
                  />
                ))}
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                <PrefRow
                  title="Level meters"
                  description="Animated bars on playing sounds."
                  checked={prefs.eq}
                  onChange={(v) => setPref("eq", v)}
                />
                <PrefRow
                  title="Keyboard hints"
                  description="Shortcut strip along the bottom."
                  checked={prefs.hints}
                  onChange={(v) => setPref("hints", v)}
                />
              </div>
            </PrefSection>

            <PrefSection icon={PlayIcon} title="Playback">
              <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                <PrefSlider
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
                  minLabel="Instant"
                  maxLabel="3s"
                  onChange={(v) => setPref("fadeMs", v)}
                />
                <PrefSlider
                  title="Sleep timer fade-out"
                  value={prefs.sleepFade}
                  display={`${prefs.sleepFade}s`}
                  min={2}
                  max={60}
                  step={1}
                  resetValue={DEFAULT_PREFS.sleepFade}
                  minLabel="2s"
                  maxLabel="1 min"
                  onChange={(v) => setPref("sleepFade", v)}
                />
                <PrefRow
                  title="Pause in background tabs"
                  description="Stops when you switch away, resumes on return."
                  checked={prefs.pauseHidden}
                  onChange={(v) => setPref("pauseHidden", v)}
                />
                <PrefRow
                  title="Keep the screen awake"
                  description="Stops the screen dimming while sounds play."
                  checked={prefs.keepAwake}
                  onChange={(v) => setPref("keepAwake", v)}
                />
              </div>
            </PrefSection>

            {
              /* No persistent chrome anywhere for this. A standing "offline"
                badge is redundant with the OS and the browser, and the two
                honest messages (a sound that isn't saved yet, a YouTube sound
                that needs a connection) already appear where they matter. */
            }
            <PrefSection icon={Download04Icon} title="Offline">
              <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {pwa.audio && (
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {pwa.audio.cached} of {pwa.audio.total} sounds saved in
                      this browser.
                    </p>
                    {pwa.audio.cached < pwa.audio.total && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={!pwa.online}
                        onClick={pwa.downloadSounds}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                )}
                {!pwa.installed &&
                  (pwa.canInstall || navigator.maxTouchPoints > 0) && (
                    <div className="flex items-center gap-3 px-3.5 py-3">
                      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                        {pwa.canInstall
                          ? "Install Murmur to launch it from your dock or home screen."
                          : "To install, use your browser's Add to Home Screen option."}
                      </p>
                      {pwa.canInstall && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => void pwa.install()}
                        >
                          Install
                        </Button>
                      )}
                    </div>
                  )}
              </div>
            </PrefSection>

            <PrefSection icon={Database01Icon} title="Your data">
              <div className="flex items-center gap-3 rounded-md border border-border px-3.5 py-3">
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {saved.length} saved {saved.length === 1 ? "mix" : "mixes"} ·{" "}
                  {customs.length} of your own sounds, kept in this browser.
                </p>
                <Button
                  variant={dataArmed ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={clearData}
                >
                  {dataArmed ? "Sure?" : "Clear all"}
                </Button>
              </div>
            </PrefSection>

            <PrefSection icon={InformationCircleIcon} title="About">
              <div className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center gap-3 p-3.5">
                  <img
                    src={`${BASE}/icon.svg`}
                    alt=""
                    width={34}
                    height={34}
                    className="block shrink-0 rounded-[7px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-[7px]">
                      <span className="font-serif text-base font-semibold">
                        Murmur
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {__APP_VERSION__}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Ambient sound mixer that runs entirely in your browser.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-border p-2.5">
                  <a
                    className={aboutLink}
                    href={repoUrl}
                    target="_blank"
                    rel="noopener"
                  >
                    <HugeiconsIcon
                      icon={GithubIcon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                    Source
                  </a>
                  {/* The sound attribution table lives on the landing page. */}
                  <a className={aboutLink} href={`${BASE}/#credits`}>
                    <HugeiconsIcon
                      icon={File01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                    Credits
                  </a>
                  <span className="flex-1" />
                  <button
                    type="button"
                    className={aboutLink}
                    onClick={copyBuildInfo}
                  >
                    <HugeiconsIcon
                      icon={Copy01Icon}
                      strokeWidth={2}
                      className="size-3"
                    />
                    Copy build info
                  </button>
                </div>

                <div className="flex items-center gap-3 border-t border-border bg-brand/5 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      Free, no accounts, no ads
                    </p>
                    <p className="mt-0.5 text-xs leading-[1.45] text-muted-foreground">
                      If Murmur helps you focus or sleep, you can chip in for
                      the hosting.
                    </p>
                  </div>
                  <a
                    className="flex h-8 shrink-0 items-center gap-[7px] rounded bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
              with it, so the footer has to clear the home indicator itself. */}
          <div className="flex shrink-0 items-center gap-3 border-t border-border px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:pb-3">
            <span>
              Press{" "}
              <b className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                ,
              </b>{" "}
              to open this
            </span>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPrefs({ ...DEFAULT_PREFS })
                toast.success("Preferences restored to defaults")
              }}
            >
              Restore defaults
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Reset mix?</DialogTitle>
            <DialogDescription>
              Every sound's volume will be set to 0.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resetMix}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renaming !== null}
        onOpenChange={(o) => !o && setRenaming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Rename mix</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            placeholder="Name your mix"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") renameMix()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={renameMix}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Remove “{removing?.name}”?
            </DialogTitle>
            <DialogDescription>
              {removing?.videoId
                ? "This YouTube sound will be removed from your mixer."
                : removing?.url
                  ? "The link will be removed from your mixer."
                  : "The saved audio file will be deleted from this browser."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (removing) removeCustom(removing.id)
                setRemoving(null)
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-center" theme={themeMode} />
    </SidebarProvider>
  )
}
