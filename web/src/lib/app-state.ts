/**
 * The mixer app's persisted state: shape, defaults, validation, migration.
 *
 * v1 (the vanilla app) spread this across three localStorage keys. v2 made it
 * a single blob. v3 stores levels, slider positions, where v2 and v1 stored
 * gains (see lib/levels.ts). loadPersisted() converts either on first read.
 *
 * The ordering here is a safety property, not a preference. MurmurApp's mount
 * effect deletes every IndexedDB blob whose id is absent from `customs`, so a
 * boot that read an empty customs list would destroy the user's imported audio
 * irrecoverably. loadPersisted() is called from readInitialState(), which runs
 * synchronously inside a useMemo during the first render, ahead of every
 * effect. Moving that call into an effect reintroduces the data loss.
 */

import { devFixtures } from "@/data/dev-fixtures"
import { presets } from "@/data/presets"
import { m } from "@/paraglide/messages.js"

import { levelFromGain, levelsFromGains } from "./levels"
import type { MixerState } from "./mixer"
import { isVideoId } from "./youtube"

export const STORAGE_KEY = "murmur-app-v3"

/**
 * Dev only: `?data=worst|empty|one|huge` boots from a fixture in
 * data/dev-fixtures.ts instead of storage, and nothing is written back, so the
 * user's own state survives. Always null in production builds.
 */
export const DEV_FIXTURE: string | null =
  import.meta.env.DEV && typeof location !== "undefined"
    ? new URLSearchParams(location.search).get("data")
    : null

const V2_KEY = "murmur-app-v2"
const V1_STATE = "murmur-app-state"
const V1_SAVED = "murmur-app-saved"
const V1_CUSTOM = "murmur-app-custom"

/**
 * Longest names, in graphemes. Long enough for a real YouTube title to stay
 * recognisable; short enough that a name never has to carry a layout. Applied
 * where names are made: typed, or taken from a file name, a video title or a
 * shared link. Names already in storage are the user's and stay whole; the
 * layout copes with them.
 */
export const MIX_NAME_MAX = 60
export const SOUND_NAME_MAX = 80

/**
 * A level. Exported so the master slider's double-click reset cannot drift
 * from it. About as loud as the 0.7 gain it replaced, which a level of 0.89
 * would match exactly; 0.9 sits on the slider's grid.
 */
export const DEFAULT_MASTER = 0.9

/** What a v2 or v1 user has actually been hearing, so migration must not
 *  "correct" it. Gains, as those versions stored. */
const V2_DEFAULT_MASTER = 0.7
const V1_DEFAULT_MASTER = 0.75

export type View = "grid" | "list"

export interface SavedMix {
  name: string
  mix: MixerState
}

/**
 * `url` imports restore from the link, `hasFile` ones from an IndexedDB blob,
 * and `videoId` ones from a hidden YouTube player. Exactly one is set.
 */
export interface CustomSound {
  id: string
  /** Absent only for a YouTube sound whose player hasn't yet reported the
   * video's title. Read it through customName(). */
  name?: string
  url?: string
  hasFile?: boolean
  videoId?: string
}

export interface Prefs {
  eq: boolean
  fadeMs: number
  sleepFade: number
  pauseHidden: boolean
  keepAwake: boolean
  /** iOS audio session "ambient" rather than "playback". See MurmurApp. */
  mixWithOthers: boolean
  /** Each sound slowly dips below its slider and back. See lib/drift.ts. */
  drift: boolean
}

/** A second's fade-in, so a sound swells in rather than popping on, and half
 *  a minute's fade-out at the end of a sleep timer, for someone drifting off. */
export const DEFAULT_PREFS: Prefs = {
  eq: true,
  fadeMs: 1000,
  sleepFade: 30,
  pauseHidden: false,
  keepAwake: false,
  mixWithOthers: false,
  drift: false,
}

/**
 * A mix the app names rather than the user: an empty start, sounds on with no
 * mix loaded, or a link that carried no name. Stored as which, and named in
 * the language of the day when shown.
 */
export type Untitled = { untitled: "new" | "custom" | "shared" }

/** The mix on the faders: a name the user gave or chose (a saved mix's, or one
 * a shared link carried), or untitled. An untitled mix equals no saved one. */
export type MixName = string | Untitled

/** What a mix is called on screen. */
export function mixLabel(name: MixName): string {
  if (typeof name === "string") return name
  const label = { new: m.mix_new, custom: m.mix_custom, shared: m.mix_shared }
  return label[name.untitled]()
}

/** What one of your own sounds is called on screen. */
export function customName(sound: CustomSound): string {
  return sound.name ?? m.yt_placeholder()
}

/**
 * What versions before this model stored in place of an untitled mix or a
 * YouTube sound's missing title: the English, and the three translations that
 * were live for a few hours on 2026-10-23. Frozen, since it describes data
 * already written, not today's messages.
 */
// A Map, not an object: a stored name is anything a shared link's n= said,
// and on an object "constructor" or "toString" would find a built-in.
const LEGACY_UNTITLED = new Map<string, Untitled["untitled"]>([
  ["New mix", "new"],
  ["Novo mix", "new"],
  ["Nueva mezcla", "new"],
  ["新しいミックス", "new"],
  ["Custom mix", "custom"],
  ["Mix personalizado", "custom"],
  ["Mezcla personalizada", "custom"],
  ["カスタムミックス", "custom"],
  ["Shared mix", "shared"],
  ["Mix compartilhado", "shared"],
  ["Mezcla compartida", "shared"],
  ["共有されたミックス", "shared"],
])
const LEGACY_YOUTUBE_PLACEHOLDERS = new Set([
  "YouTube sound",
  "Som do YouTube",
  "Sonido de YouTube",
  "YouTube のサウンド",
])

function cleanMixName(v: unknown): MixName {
  if (
    isRecord(v) &&
    (v.untitled === "new" || v.untitled === "custom" || v.untitled === "shared")
  ) {
    return { untitled: v.untitled }
  }
  if (typeof v !== "string" || !v.trim()) return { untitled: "custom" }
  const legacy = LEGACY_UNTITLED.get(v)
  return legacy ? { untitled: legacy } : v
}

export interface PersistedState {
  vols: MixerState
  master: number
  mixName: MixName
  dirty: boolean
  view: View
  /** The Now playing pane beside the grid, on screens wide enough for it. */
  pane: boolean
  /** The sleep timer's last length in minutes, offered first next time. */
  timerChoice: number
  saved: SavedMix[]
  customs: CustomSound[]
  prefs: Prefs
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, v))
}

/** Strict zero is off, so a zero volume is dropped rather than stored. */
function cleanVols(v: unknown): MixerState {
  if (!isRecord(v)) return {}
  const out: MixerState = {}
  for (const [id, vol] of Object.entries(v)) {
    if (
      typeof vol === "number" &&
      Number.isFinite(vol) &&
      vol > 0 &&
      vol <= 1
    ) {
      out[id] = vol
    }
  }
  return out
}

function cleanSaved(v: unknown): SavedMix[] {
  if (!Array.isArray(v)) return []
  const out: SavedMix[] = []
  for (const item of v) {
    if (!isRecord(item) || typeof item.name !== "string" || !item.name.trim()) {
      continue
    }
    out.push({ name: item.name, mix: cleanVols(item.mix) })
  }
  return out
}

function cleanCustoms(v: unknown): CustomSound[] {
  if (!Array.isArray(v)) return []
  const out: CustomSound[] = []
  for (const item of v) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id) continue
    const named = typeof item.name === "string" && item.name.trim()
    const custom: CustomSound = { id: item.id }
    if (named) custom.name = item.name as string
    if (typeof item.url === "string" && item.url) custom.url = item.url
    if (item.hasFile === true) custom.hasFile = true
    // Validated, not merely copied: this is the one field a shared link can
    // put into someone else's storage, and it ends up in an iframe src.
    if (isVideoId(item.videoId)) custom.videoId = item.videoId
    // A record pointing at no link, no blob and no video can never resolve.
    if (!custom.url && !custom.hasFile && !custom.videoId) continue
    // Only a YouTube sound waits for its name, which its player supplies.
    if (!custom.videoId && !custom.name) continue
    if (custom.videoId && LEGACY_YOUTUBE_PLACEHOLDERS.has(custom.name ?? "")) {
      delete custom.name
    }
    out.push(custom)
  }
  return out
}

/**
 * Every pref is validated, not merged. fadeMs and sleepFade reach Web Audio
 * arithmetic: a non-finite fade makes linearRampToValueAtTime throw and kills
 * every later volume change, and a sleepFade of 0 divides to Infinity. The
 * bounds are the ones the Preferences sliders offer.
 */
function cleanPrefs(v: unknown): Prefs {
  if (!isRecord(v)) return { ...DEFAULT_PREFS }
  const bool = (x: unknown, fallback: boolean) =>
    typeof x === "boolean" ? x : fallback
  return {
    eq: bool(v.eq, DEFAULT_PREFS.eq),
    fadeMs: clamp(v.fadeMs, 0, 3000, DEFAULT_PREFS.fadeMs),
    sleepFade: clamp(v.sleepFade, 2, 60, DEFAULT_PREFS.sleepFade),
    pauseHidden: bool(v.pauseHidden, DEFAULT_PREFS.pauseHidden),
    keepAwake: bool(v.keepAwake, DEFAULT_PREFS.keepAwake),
    mixWithOthers: bool(v.mixWithOthers, DEFAULT_PREFS.mixWithOthers),
    drift: bool(v.drift, DEFAULT_PREFS.drift),
  }
}

/** Bumped when a default changes; storage records the rev it was written at. */
const PREFS_REV = 2

/**
 * Rev 2 lengthened the fades from 0.2s and 10s. Prefs are stored in full on
 * every visit, so a value still at the old default was almost certainly never
 * touched: it moves to the new one, once. Anything else was a choice and stays,
 * and a stored rev of 2 means a later 0.2s or 10s was chosen too.
 */
function upgradePrefs(prefs: Prefs, rev: unknown): Prefs {
  if (typeof rev === "number" && rev >= PREFS_REV) return prefs
  return {
    ...prefs,
    fadeMs: prefs.fadeMs === 200 ? DEFAULT_PREFS.fadeMs : prefs.fadeMs,
    sleepFade:
      prefs.sleepFade === 10 ? DEFAULT_PREFS.sleepFade : prefs.sleepFade,
  }
}

function coerce(raw: unknown, defaultMaster: number): PersistedState {
  const r = isRecord(raw) ? raw : {}
  const vols = cleanVols(r.vols)

  return {
    vols,
    master: clamp(r.master, 0, 1, defaultMaster),
    // A name only means something alongside a mix to wear it.
    mixName: Object.keys(vols).length
      ? cleanMixName(r.mixName)
      : { untitled: "new" },
    dirty:
      Object.keys(vols).length && typeof r.dirty === "boolean"
        ? r.dirty
        : false,
    view: r.view === "list" ? "list" : "grid",
    pane: r.pane === true,
    // The slider's own range and step, so a stored value is one it can show.
    timerChoice: Math.round(clamp(r.timerChoice, 5, 240, 30) / 5) * 5,
    saved: cleanSaved(r.saved),
    customs: cleanCustoms(r.customs),
    prefs: upgradePrefs(cleanPrefs(r.prefs), r.prefsRev),
  }
}

/** v1's three keys as one state, still in gains, or null if there are none. */
function readV1(): PersistedState | null {
  const rawState = readJson(V1_STATE)
  const rawSaved = readJson(V1_SAVED)
  const rawCustom = readJson(V1_CUSTOM)
  if (rawState === null && rawSaved === null && rawCustom === null) return null
  return coerce(
    {
      ...(isRecord(rawState) ? rawState : {}),
      saved: rawSaved,
      customs: rawCustom,
    },
    V1_DEFAULT_MASTER
  )
}

/**
 * A state from before levels, in levels, sounding as it did: each sound by its
 * own trim, the master by none. A muted master stays muted.
 */
function toLevels(state: PersistedState): PersistedState {
  return {
    ...state,
    vols: levelsFromGains(state.vols),
    master: state.master > 0 ? levelFromGain(state.master) : 0,
    saved: state.saved.map((s) => ({ ...s, mix: levelsFromGains(s.mix) })),
  }
}

/**
 * Converts v2, or v1 before it, writes v3, reads it back to confirm it is
 * durable, and only then drops the old keys. A quota failure or a private-mode
 * throw therefore leaves the old keys intact and the migration simply retries
 * on the next load. Never delete the source before the destination is proven.
 */
function migrate(): PersistedState | null {
  const v2 = readJson(V2_KEY)
  const gains = isRecord(v2) ? coerce(v2, V2_DEFAULT_MASTER) : readV1()
  if (!gains) return null
  const state = toLevels(gains)

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, prefsRev: PREFS_REV })
    )
    if (localStorage.getItem(STORAGE_KEY)) {
      for (const key of [V2_KEY, V1_STATE, V1_SAVED, V1_CUSTOM]) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* Session still works; the old keys are untouched and this retries. */
  }

  return state
}

/**
 * Presence of the v3 key short-circuits the migration on every later load.
 *
 * The last branch is the only genuine first run: no v3 key, and no v2 or v1
 * keys for migrate() to have found. Seeding the built-in mixes there rather than behind
 * `saved.length === 0` is what makes them the user's own. The persist effect
 * writes the key 250ms after mount, so emptying the list never brings them back.
 * A migrating user is deliberately not seeded; they are not new, and three mixes
 * appearing in a list they already curated would be presumptuous.
 */
/**
 * A backup file's contents, validated exactly as storage is, so nothing a file
 * says reaches state unchecked. A version 1 file's mixes are gains, converted
 * as storage's are.
 */
export function parseBackupData(
  raw: unknown,
  version: number
): {
  saved: SavedMix[]
  customs: CustomSound[]
} {
  const r = isRecord(raw) ? raw : {}
  const saved = cleanSaved(r.saved)
  return {
    saved:
      version < 2
        ? saved.map((s) => ({ ...s, mix: levelsFromGains(s.mix) }))
        : saved,
    customs: cleanCustoms(r.customs),
  }
}

export function loadPersisted(): PersistedState {
  // import.meta.env.DEV inline, not just via DEV_FIXTURE: a literal false is
  // what lets the production build drop the fixtures module.
  if (import.meta.env.DEV && DEV_FIXTURE && DEV_FIXTURE in devFixtures) {
    return coerce(devFixtures[DEV_FIXTURE](), DEFAULT_MASTER)
  }
  const current = readJson(STORAGE_KEY)
  if (isRecord(current)) return coerce(current, DEFAULT_MASTER)
  return migrate() ?? coerce({ saved: presets }, DEFAULT_MASTER)
}

export function savePersisted(state: PersistedState): void {
  if (DEV_FIXTURE) return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        prefsRev: PREFS_REV,
        // A failed putBlob leaves a record pointing at nothing; drop it here
        // rather than persisting a custom that can never play.
        customs: state.customs.filter((c) => c.url || c.hasFile || c.videoId),
      })
    )
  } catch {
    /* Storage unavailable. The session works, it just won't persist. */
  }
}
