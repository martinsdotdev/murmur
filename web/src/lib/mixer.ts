/**
 * The web-audio mixer behind /app.
 *
 * Design mirrors Murmur/Services/AudioGraphMixerService.cs:
 *  - Volume > 0  ⇒ active (no epsilon, no hysteresis, strict zero is "off")
 *  - Volume === 0 ⇒ stop & detach the source (re-create on next rise)
 *  - Master Play/Pause is implemented by ramping the master GainNode, NOT by
 *    suspending the AudioContext. Suspended contexts can't accept new sources
 *    cleanly across browsers.
 *
 * Browser autoplay policies require the AudioContext to be created from a user
 * gesture. There is no init(): the context is created lazily by ensureContext()
 * on the first setVolume, so every entry point must be reached from a gesture.
 * MurmurApp's ensureAudio() is what guarantees that.
 *
 * setVolume reports a failed fetch or decode by returning the volume to zero
 * rather than throwing. Callers that care must probe getVolume afterwards;
 * MurmurApp's applyVolume is the only one, and the reason getVolume exists.
 *
 * Two kinds of sound live here, mirroring the desktop's SoundKind: buffers,
 * which are decoded OGGs on the audio graph, and streams, which are hidden
 * YouTube players (see lib/youtube.ts). Streams are in the mixer rather than
 * beside it on purpose. MurmurApp zeroes volumes from seven different places,
 * and a parallel API would leave a video playing wherever a call was missed.
 */

import { m } from "@/paraglide/messages.js"

import { createYouTubeSound, type YouTubeSound } from "./youtube"

const DEFAULT_FADE_IN_MS = 200
const FADE_OUT_MS = 80

/** ~60fps. A YouTube player has no ramp of its own, so fades are stepped. */
const RAMP_STEP_MS = 16

/**
 * A level change to a sound that is already audible. It has to sit close to a
 * frame: a drag delivers a new value roughly every 16ms and each one cancels
 * the ramp before it, so anything longer never finishes and the sound trails
 * the thumb instead of following it.
 */
const ADJUST_MS = 20

/**
 * Which of the two timings a volume change wants. "fade" is a sound arriving
 * or leaving, and honours the user's "Fade between sounds" preference. "adjust"
 * is a level being moved on a control the user is working right now: a drag, a
 * wheel, a double-click reset, the master arrow keys.
 */
export type VolumeRamp = "fade" | "adjust"

interface BufferNode {
  kind: "buffer"
  id: string
  url: string
  /** Cached decoded buffer; populated on first activation. */
  buffer: AudioBuffer | null
  /** Currently playing source, null when volume === 0. */
  source: AudioBufferSourceNode | null
  gain: GainNode
  /** Last requested volume in [0, 1]. */
  volume: number
  /** Pending decode; held to deduplicate concurrent activations. */
  loading: Promise<AudioBuffer> | null
}

interface StreamNode {
  kind: "stream"
  id: string
  videoId: string
  /** Last requested volume in [0, 1]. */
  volume: number
  /** Null until the first rise above zero, and again after a fall back to it. */
  player: YouTubeSound | null
  /** Pending boot; held so a slider wiggle can't start two players. */
  loading: Promise<void> | null
  /** The volume actually pushed to the player, so a ramp knows where it starts. */
  applied: number
  /** setInterval handle for the active ramp. */
  ramp: number | null
  /** Bumped on every apply, so a stale teardown timer knows to stand down. */
  generation: number
}

type SoundNode = BufferNode | StreamNode

export type MixerState = Record<string, number>

export class Mixer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sounds = new Map<string, SoundNode>()
  private masterVolume = 0.75
  /**
   * Fade applied when a sound rises from silence, in ms. Exposed so the
   * Preferences "Fade between sounds" control can drive it live.
   */
  fadeInMs = DEFAULT_FADE_IN_MS
  private playing = true

  /**
   * Set by MurmurApp. A stream can fail long after the call that started it
   * (a private video, a blocked embed), so failures need a channel out rather
   * than a rejected promise nobody is awaiting.
   */
  onStreamError: ((id: string, message: string) => void) | null = null

  /**
   * Also set by MurmurApp. A video's title can only be read once its player is
   * live, which is long after the import that asked for it, so it arrives here
   * rather than as a return value.
   */
  onStreamTitle: ((id: string, title: string) => void) | null = null

  constructor(private readonly urlFor: (id: string) => string) {}

  /** Lazy: create the AudioContext on first user gesture. */
  private ensureContext(): AudioContext {
    if (this.ctx) {
      // A wheel is not a user-activation gesture, so a context first reached
      // through one can start suspended and leave the app looking live while
      // playing nothing. Chrome rejects resume() before the page has been
      // interacted with, hence the swallowed catch: the next real gesture
      // retries. Nothing here ever calls suspend(), pause is a master ramp.
      // Not just "suspended": iOS leaves a context "interrupted" after a phone
      // call or another app taking the audio, a state lib.dom doesn't name.
      if (this.ctx.state !== "running") this.ctx.resume().catch(() => {})
      return this.ctx
    }
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) throw new Error("Web Audio API not available")
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.playing ? this.masterVolume : 0
    this.master.connect(this.ctx.destination)
    return this.ctx
  }

  private nodeFor(id: string): BufferNode {
    const existing = this.sounds.get(id)
    if (existing?.kind === "buffer") return existing
    const ctx = this.ensureContext()
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.master!)
    const n: BufferNode = {
      kind: "buffer",
      id,
      url: this.urlFor(id),
      buffer: null,
      source: null,
      gain,
      volume: 0,
      loading: null,
    }
    this.sounds.set(id, n)
    return n
  }

  /**
   * Declares a YouTube-backed sound without booting anything. The player is
   * created on the first rise above zero, mirroring the desktop's deferred
   * resolve (YouTubeAudioImportService.cs:159-161): launch stays fast, and no
   * network is spent on a sound the user may never play.
   *
   * Idempotent, because it runs again for every saved sound on every boot.
   */
  registerStream(id: string, videoId: string): void {
    const existing = this.sounds.get(id)
    if (existing?.kind === "stream" && existing.videoId === videoId) return
    if (existing) this.unregister(id)
    this.sounds.set(id, {
      kind: "stream",
      id,
      videoId,
      volume: 0,
      player: null,
      loading: null,
      applied: 0,
      ramp: null,
      generation: 0,
    })
  }

  /** Tears a sound down for good. Safe on an id that was never registered. */
  unregister(id: string): void {
    const n = this.sounds.get(id)
    if (!n) return
    this.sounds.delete(id)
    if (n.kind === "stream") {
      this.destroyStream(n)
      return
    }
    this.stopSource(n)
    n.gain.disconnect()
  }

  private async ensureBuffer(n: BufferNode): Promise<AudioBuffer> {
    if (n.buffer) return n.buffer
    if (n.loading) return n.loading
    // `finally` clears `n.loading` on both success AND failure, if we left it
    // set on rejection, every subsequent call would re-await the same rejected
    // promise and the sound would be dead for the session (notably on Safari,
    // which can't decodeAudioData OGG Vorbis).
    n.loading = (async () => {
      try {
        const ctx = this.ensureContext()
        const res = await fetch(n.url)
        if (!res.ok) throw new Error(`Failed to load ${n.url}: ${res.status}`)
        const arrayBuf = await res.arrayBuffer()
        const audioBuf = await ctx.decodeAudioData(arrayBuf)
        n.buffer = audioBuf
        return audioBuf
      } finally {
        n.loading = null
      }
    })()
    return n.loading
  }

  private startSource(n: BufferNode, buf: AudioBuffer) {
    const ctx = this.ensureContext()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(n.gain)
    src.start(0)
    n.source = src
  }

  private stopSource(n: BufferNode) {
    if (!n.source) return
    try {
      n.source.stop()
    } catch {
      /* Already stopped, fine. */
    }
    n.source.disconnect()
    n.source = null
  }

  /**
   * What a stream should actually be playing at. The master gain node does
   * this arithmetic for buffer sounds; a YouTube player has only one volume,
   * so the same three factors have to be multiplied by hand. The sleep timer
   * rides along for free, since it drives masterVolume.
   */
  private streamTarget(n: StreamNode): number {
    return this.playing ? n.volume * this.masterVolume : 0
  }

  private rampStream(n: StreamNode, to: number, ms: number) {
    if (n.ramp !== null) {
      window.clearInterval(n.ramp)
      n.ramp = null
    }
    const player = n.player
    if (!player) return
    if (ms <= 0 || n.applied === to) {
      n.applied = to
      player.setVolume(to)
      return
    }
    const from = n.applied
    const start = performance.now()
    n.ramp = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms)
      n.applied = from + (to - from) * t
      player.setVolume(n.applied)
      if (t >= 1 && n.ramp !== null) {
        window.clearInterval(n.ramp)
        n.ramp = null
      }
    }, RAMP_STEP_MS)
  }

  /**
   * Brings a live player in line with the node's state: ramp to the target,
   * and once silent either pause it (paused, or master at zero) or destroy it
   * (volume back to zero), so nothing keeps downloading in the background.
   */
  private applyStream(n: StreamNode, fadeMs: number) {
    const player = n.player
    if (!player) return
    // Bumped on every apply, not only on the silent path: a master slider
    // dragged to zero and straight back would otherwise leave the pause its
    // first call scheduled still armed, and pause a sound that came back up.
    const generation = ++n.generation
    const target = this.streamTarget(n)
    this.rampStream(n, target, fadeMs)

    if (target > 0) {
      player.play()
      return
    }
    window.setTimeout(() => {
      // Anything that touched this node during the fade owns it now.
      if (n.generation !== generation || !n.player) return
      if (n.volume === 0) this.destroyStream(n)
      else n.player.pause()
    }, fadeMs + 20)
  }

  private destroyStream(n: StreamNode) {
    if (n.ramp !== null) {
      window.clearInterval(n.ramp)
      n.ramp = null
    }
    n.player?.destroy()
    n.player = null
    n.applied = 0
  }

  private setStreamVolume(n: StreamNode, volume: number, ramp: VolumeRamp) {
    n.volume = Math.max(0, Math.min(1, volume))

    if (n.volume === 0) {
      this.applyStream(n, FADE_OUT_MS)
      return
    }

    if (n.player) {
      this.applyStream(n, this.streamRampMs(ramp))
      return
    }
    if (n.loading) return

    // Boots muted and ramps up, so the browser's autoplay policy has nothing
    // to refuse. A failure drops the sound to zero rather than leaving a card
    // that looks live and plays nothing.
    n.loading = createYouTubeSound(n.videoId, {
      onReady: (title) => {
        if (title) this.onStreamTitle?.(n.id, title)
      },
      onError: (message) => {
        this.setStreamVolume(n, 0, "fade")
        this.onStreamError?.(n.id, message)
      },
    })
      .then((player) => {
        // The slider may have gone back to zero while YouTube was booting.
        if (n.volume === 0) {
          player.destroy()
          return
        }
        n.player = player
        n.applied = 0
        player.setVolume(0)
        // Always the full fade, whatever prompted the boot. A player that has
        // only now come up is a sound arriving, not a level being adjusted.
        this.applyStream(n, this.fadeInMs)
      })
      .catch((err: unknown) => {
        n.volume = 0
        this.onStreamError?.(
          n.id,
          err instanceof Error ? err.message : m.yt_failed()
        )
      })
      .finally(() => {
        n.loading = null
      })
  }

  private gainRampMs(ramp: VolumeRamp): number {
    return ramp === "adjust" ? ADJUST_MS : this.fadeInMs
  }

  /**
   * A YouTube player's volume is a 0-100 integer with no ramp of its own, so
   * rampStream steps it on a timer. An adjust just lands: stepping would only
   * add latency to a drag, and rampStream short-circuits at 0 rather than
   * starting an interval.
   */
  private streamRampMs(ramp: VolumeRamp): number {
    return ramp === "adjust" ? 0 : this.fadeInMs
  }

  /**
   * Set per-sound volume in [0, 1]. Loads the buffer lazily on first non-zero
   * value; stops the source when set back to zero.
   */
  async setVolume(
    id: string,
    volume: number,
    ramp: VolumeRamp = "fade"
  ): Promise<void> {
    // Dispatch before nodeFor, which would otherwise mint a second, buffer-
    // backed node for an id that already belongs to a YouTube player, and
    // then go looking for /sounds/yt_<id>.ogg.
    const registered = this.sounds.get(id)
    if (registered?.kind === "stream") {
      this.setStreamVolume(registered, volume, ramp)
      return
    }

    const n = this.nodeFor(id)
    n.volume = Math.max(0, Math.min(1, volume))
    const ctx = this.ensureContext()

    if (n.volume === 0) {
      // Fade out, then detach. Always FADE_OUT_MS, whatever the ramp kind:
      // cutting straight to silence clicks, and the detach timer below is
      // tuned to this length.
      const now = ctx.currentTime
      n.gain.gain.cancelScheduledValues(now)
      n.gain.gain.setValueAtTime(n.gain.gain.value, now)
      n.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_MS / 1000)
      const source = n.source
      window.setTimeout(() => {
        // Only stop if no rising edge happened during the fade.
        if (n.volume === 0 && source === n.source) this.stopSource(n)
      }, FADE_OUT_MS + 20)
      return
    }

    // Active path, ensure buffer + source, then ramp gain.
    if (!n.buffer) {
      try {
        await this.ensureBuffer(n)
      } catch (err) {
        console.error("mixer: load failed", err)
        n.volume = 0
        return
      }
    }

    // Caller may have dropped the slider to 0 while we were awaiting the decode.
    // Without this, we'd start a silent source that never gets stopped.
    if (n.volume === 0) return

    if (!n.source) this.startSource(n, n.buffer!)

    const nowAfter = ctx.currentTime
    n.gain.gain.cancelScheduledValues(nowAfter)
    n.gain.gain.setValueAtTime(n.gain.gain.value, nowAfter)
    n.gain.gain.linearRampToValueAtTime(
      n.volume,
      nowAfter + this.gainRampMs(ramp) / 1000
    )
  }

  setMasterVolume(volume: number, ramp: VolumeRamp = "fade"): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    // Streams first: they carry the master in their own volume, and they exist
    // whether or not an AudioContext was ever created (a YouTube-only mix
    // never touches Web Audio).
    for (const n of this.sounds.values()) {
      if (n.kind === "stream") this.applyStream(n, this.streamRampMs(ramp))
    }
    if (!this.master || !this.ctx) return
    if (!this.playing) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(
      this.masterVolume,
      now + this.gainRampMs(ramp) / 1000
    )
  }

  setPlaying(playing: boolean): void {
    this.playing = playing
    // Pausing a stream really pauses it rather than only silencing it, so a
    // paused mix stops pulling video down.
    for (const n of this.sounds.values()) {
      if (n.kind === "stream") this.applyStream(n, FADE_OUT_MS)
    }
    if (!this.master || !this.ctx) {
      return
    }
    // Play is the gesture someone reaches for after a call has interrupted
    // the context, so it has to be able to wake it, not only a volume change.
    if (playing) this.ensureContext()
    const now = this.ctx.currentTime
    const target = playing ? this.masterVolume : 0
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(target, now + FADE_OUT_MS / 1000)
  }

  getVolume(id: string): number {
    return this.sounds.get(id)?.volume ?? 0
  }
}

/**
 * The catalog ships as Ogg Vorbis only, which Safari plays from 18.4. Asked of
 * an <audio> element because decodeAudioData has no capability query.
 */
export function canPlayOgg(): boolean {
  return (
    document
      .createElement("audio")
      .canPlayType('audio/ogg; codecs="vorbis"') !== ""
  )
}

/**
 * Encode/decode "rain:0.4,fireplace:0.6" style fragments. Simple, human-readable,
 * easy to hand-edit a URL.
 */
export function encodeMix(mix: MixerState): string {
  return Object.entries(mix)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => `${id}:${v}`)
    .join(",")
}

export function decodeMix(fragment: string): MixerState {
  const out: MixerState = {}
  for (const part of fragment.split(",")) {
    const [id, raw] = part.split(":")
    const n = Number(raw)
    if (id && Number.isFinite(n) && n > 0 && n <= 1) out[id] = n
  }
  return out
}
