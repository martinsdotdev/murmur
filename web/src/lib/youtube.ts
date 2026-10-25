/**
 * YouTube sounds, the browser half of Murmur/Services/YouTubeAudioImportService.cs.
 *
 * The desktop resolves a watch URL to an audio-only stream with YoutubeExplode
 * and hands the URL to AudioGraph. None of that is possible here: YouTube's
 * player endpoints send no Access-Control-Allow-Origin, and neither does
 * googlevideo.com, so even a stream URL in hand would decode to nothing. The
 * site is static, so there is no server to proxy through either.
 *
 * What is left is the IFrame Player API, a real embedded player we drive with
 * setVolume(0-100) instead of a GainNode. It is hidden, which YouTube's
 * developer policies do not permit; that is a deliberate product decision,
 * taken so a YouTube sound behaves like every other card in the mixer.
 *
 * Two consequences worth knowing before touching this file:
 *  - setVolume is a no-op on iOS, where HTMLMediaElement.volume is read-only.
 *    Nothing here can fix that; the mixer's slider is simply inert on iPhone.
 *  - There is no single-video loop parameter, so ENDED is caught and rewound.
 */
import { m } from "@/paraglide/messages.js"

const API_SRC = "https://www.youtube.com/iframe_api"

/** The API's own privacy-enhanced host. Costs nothing and sets no cookies until playback. */
const PLAYER_HOST = "https://www.youtube-nocookie.com"

/** YouTube ids are 11 characters of base64url, always. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** The onStateChange codes this module acts on. */
const ENDED = 0
const PLAYING = 1
const PAUSED = 2

/**
 * How long to wait before each play again of a player that paused itself
 * behind a hidden page, and so how many. After the last it waits for the
 * page to come back, rather than wrestling a browser that means it.
 */
const HIDDEN_RETRIES_MS = [250, 1000, 3000]

/** The desktop's accepted set, verbatim (YouTubeAudioImportService.cs:132-139). */
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
])

/**
 * A watch URL in, a video id out, or null for anything that isn't one.
 *
 * The host is compared exactly rather than by suffix, which is what makes
 * "https://evil.com/?r=youtube.com/watch?v=x" fail, the spoof the desktop
 * guards against in MainWindow.xaml.cs:450.
 */
export function parseYouTubeUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) return null

  const path = url.pathname.replace(/^\/+|\/+$/g, "")
  const candidate =
    url.hostname === "youtu.be"
      ? path
      : // ?v= is the watch form; the rest put the id in the path.
        (url.searchParams.get("v") ??
        path.replace(/^(live|embed|shorts|v)\//, ""))

  return VIDEO_ID.test(candidate) ? candidate : null
}

export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID.test(value)
}

interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setVolume(volume: number): void
  mute(): void
  unMute(): void
  destroy(): void
  /** Undocumented but long-stable, and the only CORS-free way to a title. */
  getVideoData?: () => { title?: string } | undefined
}

interface YTEvent {
  target: YTPlayer
  data: number
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        host: HTMLElement,
        options: Record<string, unknown>
      ) => YTPlayer
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null

/**
 * Injects the API script once. Rejects rather than hanging when it never
 * arrives, so a content blocker or a dead network reaches the user as a
 * message. A rejection is not cached: the next import tries again.
 */
function loadIframeApi(): Promise<void> {
  if (apiPromise) return apiPromise

  const pending = new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve()
      return
    }

    const timer = window.setTimeout(
      () => reject(new Error(m.yt_timeout())),
      15_000
    )

    // Chained rather than assigned: the API fires this global exactly once, and
    // overwriting it would strand anything else waiting on the same script.
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer)
      previous?.()
      resolve()
    }

    const script = document.createElement("script")
    script.src = API_SRC
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(m.yt_unreachable()))
    }
    document.head.appendChild(script)
  })

  apiPromise = pending
  void pending.catch(() => {
    if (apiPromise === pending) apiPromise = null
  })
  return pending
}

let container: HTMLElement | null = null

/**
 * One clipping container for every player. The iframes inside are 200x200,
 * because YouTube degrades or refuses to start in a viewport smaller, and
 * this box crops them to a single pixel.
 */
function playerContainer(): HTMLElement {
  if (container) return container
  const el = document.createElement("div")
  el.setAttribute("aria-hidden", "true")
  el.style.cssText =
    "position:fixed;bottom:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none"
  document.body.appendChild(el)
  container = el
  return el
}

/** onError codes, in the user's words rather than YouTube's. */
function errorMessage(code: number): string {
  switch (code) {
    case 2:
      return m.yt_invalid_link()
    case 5:
      return m.yt_no_browser()
    case 100:
      return m.yt_private()
    case 101:
    case 150:
      return m.yt_no_embed()
    default:
      return m.yt_failed()
  }
}

export interface YouTubeSoundHandlers {
  /** Fires once the player is live; carries the video title when it can read one. */
  onReady?: (title: string | null) => void
  /** Playback failed for good. The caller should drop the sound to 0. */
  onError?: (message: string) => void
}

export interface YouTubeSound {
  /** Volume as a 0-1 fraction, matching the mixer's own units. */
  setVolume(fraction: number): void
  play(): void
  pause(): void
  destroy(): void
}

/**
 * Boots a player for one video.
 *
 * The mute dance is load-bearing, and it cost an afternoon to find. Chrome
 * lets a muted player autoplay, but a player that unmutes *before* it has
 * started playing gets wedged in BUFFERING for good, silently, with no
 * onError and no onAutoplayBlocked. So the player boots muted, and the volume
 * the caller asks for is held back until the first PLAYING. Unmuting a player
 * that is already running is fine, which is what makes the wait sufficient.
 *
 * On a phone, the player pauses itself when the page goes into the
 * background, since background play is a YouTube Premium feature, and iOS
 * pauses video behind a hidden page as well. A player the mixer wants
 * playing is told to play again, a few times, while hidden, which goes
 * against YouTube's terms as hiding it does; and once the page is back, it
 * plays again in step with the rest of the mix, rather than staying silent
 * under a card that says it's on.
 */
export async function createYouTubeSound(
  videoId: string,
  handlers: YouTubeSoundHandlers = {}
): Promise<YouTubeSound> {
  // loadIframeApi's 15s timeout is sized for a slow or blocked network, not a
  // dead one. Offline it buys nothing but fifteen seconds of a lit card and
  // silence, so the failure is taken up front. The rejection lands in the
  // existing catch in mixer.setStreamVolume, which zeroes the sound and toasts.
  if (!navigator.onLine) {
    throw new Error(m.yt_offline())
  }

  await loadIframeApi()
  const YT = window.YT
  if (!YT) throw new Error(m.yt_unreachable())

  const mount = document.createElement("div")
  playerContainer().appendChild(mount)

  let player: YTPlayer | null = null
  let destroyed = false
  let started = false
  /** The last volume asked for, applied for real once playback is under way. */
  let desired = 0
  /** Whether the mixer wants it playing: play() since the last pause(). */
  let wanted = true
  let hiddenRetries = 0
  let retry: number | undefined

  // The next tap or key anywhere, which a browser always lets play.
  const onTap = () => {
    disarmTap()
    if (wanted && !destroyed) player?.playVideo()
  }
  const armTap = () => {
    document.addEventListener("pointerdown", onTap, true)
    document.addEventListener("keydown", onTap, true)
  }
  const disarmTap = () => {
    document.removeEventListener("pointerdown", onTap, true)
    document.removeEventListener("keydown", onTap, true)
  }

  const applyVolume = () => {
    if (!player || destroyed) return
    // YouTube takes whole percents. Rounded down to 0, a quiet sound under a
    // low master would mute while its level said it was on, so anything above
    // silence plays at 1 at least.
    const pct =
      desired > 0 ? Math.max(1, Math.round(Math.min(1, desired) * 100)) : 0
    if (pct === 0 || !started) {
      player.mute()
      return
    }
    player.unMute()
    player.setVolume(pct)
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    player = new YT.Player(mount, {
      videoId,
      host: PLAYER_HOST,
      width: 200,
      height: 200,
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        disablekb: 1,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          settled = true
          handlers.onReady?.(player?.getVideoData?.()?.title?.trim() || null)
          resolve()
        },
        onStateChange: (event: YTEvent) => {
          if (event.data === PLAYING && !started) {
            started = true
            applyVolume()
          }
          // No loop parameter exists for a single video, so ENDED is the loop.
          if (event.data === ENDED) {
            event.target.seekTo(0, true)
            event.target.playVideo()
          }
          if (
            event.data === PAUSED &&
            wanted &&
            document.hidden &&
            hiddenRetries < HIDDEN_RETRIES_MS.length
          ) {
            const target = event.target
            window.clearTimeout(retry)
            retry = window.setTimeout(() => {
              if (wanted && !destroyed) target.playVideo()
            }, HIDDEN_RETRIES_MS[hiddenRetries++])
          }
        },
        onError: (event: YTEvent) => {
          const message = errorMessage(event.data)
          if (settled) handlers.onError?.(message)
          else reject(new Error(message))
        },
        // A first start refused in plain view is the user's to know about.
        // One refused behind a hidden page, or later on, playing again on
        // the way back, is no fault of the video's: it waits for the next
        // tap, rather than turning the sound off.
        onAutoplayBlocked: () => {
          if (started || document.hidden) armTap()
          else handlers.onError?.(m.yt_autoplay_blocked())
        },
      },
    })
  })

  const live = player as YTPlayer | null
  if (!live) throw new Error(m.yt_unreachable())

  const onVisibility = () => {
    if (document.hidden) return
    hiddenRetries = 0
    window.clearTimeout(retry)
    if (wanted && !destroyed) live.playVideo()
  }
  document.addEventListener("visibilitychange", onVisibility)

  return {
    setVolume(fraction) {
      desired = fraction
      applyVolume()
    },
    play() {
      wanted = true
      if (!destroyed) live.playVideo()
    },
    pause() {
      wanted = false
      window.clearTimeout(retry)
      if (!destroyed) live.pauseVideo()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      wanted = false
      window.clearTimeout(retry)
      disarmTap()
      document.removeEventListener("visibilitychange", onVisibility)
      try {
        live.destroy()
      } catch {
        /* Already torn down by a navigation; the node removal still stands. */
      }
      mount.remove()
    },
  }
}
