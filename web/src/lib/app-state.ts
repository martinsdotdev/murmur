/**
 * The /app mixer's persisted state: shape, defaults, validation, migration.
 *
 * v1 (the vanilla app) spread this across three localStorage keys. v2 is a
 * single blob, and loadPersisted() folds v1 into it on first read.
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
import { fromAnyLocale } from "@/lib/i18n"
import { m } from "@/paraglide/messages.js"

import type { MixerState } from "./mixer"
import { isVideoId } from "./youtube"

export const STORAGE_KEY = "murmur-app-v2"

/**
 * Dev only: `?data=worst|empty|one|huge` boots from a fixture in
 * data/dev-fixtures.ts instead of storage, and nothing is written back, so the
 * user's own state survives. Always null in production builds.
 */
export const DEV_FIXTURE: string | null =
  import.meta.env.DEV && typeof location !== "undefined"
    ? new URLSearchParams(location.search).get("data")
    : null

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

/** Exported so the master slider's double-click reset cannot drift from it. */
export const DEFAULT_MASTER = 0.7

/** What a v1 user has actually been hearing, so migration must not "correct" it. */
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
  name: string
  url?: string
  hasFile?: boolean
  videoId?: string
}

export interface Prefs {
  eq: boolean
  hints: boolean
  fadeMs: number
  sleepFade: number
  pauseHidden: boolean
  keepAwake: boolean
  /** iOS audio session "ambient" rather than "playback". See MurmurApp. */
  mixWithOthers: boolean
}

/** A second's fade-in, so a sound swells in rather than popping on, and half
 *  a minute's fade-out at the end of a sleep timer, for someone drifting off. */
export const DEFAULT_PREFS: Prefs = {
  eq: true,
  hints: false,
  fadeMs: 1000,
  sleepFade: 30,
  pauseHidden: false,
  keepAwake: false,
  mixWithOthers: false,
}

export interface PersistedState {
  vols: MixerState
  master: number
  mixName: string
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
    if (typeof item.name !== "string" || !item.name.trim()) continue
    const custom: CustomSound = { id: item.id, name: item.name }
    if (typeof item.url === "string" && item.url) custom.url = item.url
    if (item.hasFile === true) custom.hasFile = true
    // Validated, not merely copied: this is the one field a shared link can
    // put into someone else's storage, and it ends up in an iframe src.
    if (isVideoId(item.videoId)) custom.videoId = item.videoId
    // A record pointing at no link, no blob and no video can never resolve.
    if (!custom.url && !custom.hasFile && !custom.videoId) continue
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
    hints: bool(v.hints, DEFAULT_PREFS.hints),
    fadeMs: clamp(v.fadeMs, 0, 3000, DEFAULT_PREFS.fadeMs),
    sleepFade: clamp(v.sleepFade, 2, 60, DEFAULT_PREFS.sleepFade),
    pauseHidden: bool(v.pauseHidden, DEFAULT_PREFS.pauseHidden),
    keepAwake: bool(v.keepAwake, DEFAULT_PREFS.keepAwake),
    mixWithOthers: bool(v.mixWithOthers, DEFAULT_PREFS.mixWithOthers),
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

/** A name the app gave a mix, in the language it gave it in, comes back in
 * today's. A name anyone typed comes back as it is. */
function localName(name: string) {
  const own = [m.mix_new, m.mix_custom, m.mix_shared].find((message) =>
    fromAnyLocale(message, name)
  )
  return own ? own() : name
}

function coerce(raw: unknown, defaultMaster: number): PersistedState {
  const r = isRecord(raw) ? raw : {}
  const vols = cleanVols(r.vols)
  const named = typeof r.mixName === "string" && r.mixName.trim()

  return {
    vols,
    master: clamp(r.master, 0, 1, defaultMaster),
    // A name only means something alongside a mix to wear it.
    mixName: Object.keys(vols).length
      ? named
        ? localName(r.mixName as string)
        : m.mix_custom()
      : m.mix_new(),
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

/**
 * Writes v2, reads it back to confirm it is durable, and only then drops v1.
 * A quota failure or a private-mode throw therefore leaves v1 intact and the
 * migration simply retries on the next load. Never delete the source before
 * the destination is proven.
 */
function migrateV1(): PersistedState | null {
  const rawState = readJson(V1_STATE)
  const rawSaved = readJson(V1_SAVED)
  const rawCustom = readJson(V1_CUSTOM)
  if (rawState === null && rawSaved === null && rawCustom === null) return null

  const state = coerce(
    {
      ...(isRecord(rawState) ? rawState : {}),
      saved: rawSaved,
      customs: rawCustom,
    },
    V1_DEFAULT_MASTER
  )

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (localStorage.getItem(STORAGE_KEY)) {
      localStorage.removeItem(V1_STATE)
      localStorage.removeItem(V1_SAVED)
      localStorage.removeItem(V1_CUSTOM)
    }
  } catch {
    /* Session still works; v1 is untouched and the migration retries. */
  }

  return state
}

/**
 * Presence of the v2 key short-circuits the migration on every later load.
 *
 * The last branch is the only genuine first run: no v2 key, and no v1 keys for
 * migrateV1() to have found. Seeding the built-in mixes there rather than behind
 * `saved.length === 0` is what makes them the user's own. The persist effect
 * writes the key 250ms after mount, so emptying the list never brings them back.
 * A migrating user is deliberately not seeded; they are not new, and three mixes
 * appearing in a list they already curated would be presumptuous.
 */
/**
 * A backup file's contents, validated exactly as storage is, so nothing a file
 * says reaches state unchecked.
 */
export function parseBackupData(raw: unknown): {
  saved: SavedMix[]
  customs: CustomSound[]
} {
  const r = isRecord(raw) ? raw : {}
  return { saved: cleanSaved(r.saved), customs: cleanCustoms(r.customs) }
}

export function loadPersisted(): PersistedState {
  // import.meta.env.DEV inline, not just via DEV_FIXTURE: a literal false is
  // what lets the production build drop the fixtures module.
  if (import.meta.env.DEV && DEV_FIXTURE && DEV_FIXTURE in devFixtures) {
    return coerce(devFixtures[DEV_FIXTURE](), DEFAULT_MASTER)
  }
  const current = readJson(STORAGE_KEY)
  if (isRecord(current)) return coerce(current, DEFAULT_MASTER)
  return migrateV1() ?? coerce({ saved: presets }, DEFAULT_MASTER)
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
