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

const API_SRC = "https://www.youtube.com/iframe_api"

/** The API's own privacy-enhanced host. Costs nothing and sets no cookies until playback. */
const PLAYER_HOST = "https://www.youtube-nocookie.com"

/** YouTube ids are 11 characters of base64url, always. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** The two onStateChange codes this module acts on. */
const ENDED = 0
const PLAYING = 1

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
      () => reject(new Error("YouTube took too long to answer")),
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
      reject(new Error("Couldn’t reach YouTube"))
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
      return "That video link isn’t valid"
    case 5:
      return "This video can’t play in a browser"
    case 100:
      return "That video is private or no longer exists"
    case 101:
    case 150:
      return "The owner doesn’t allow this video to be embedded"
    default:
      return "YouTube couldn’t play that video"
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
    throw new Error(
      "YouTube sounds need a connection. Tap again when you’re back online"
    )
  }

  await loadIframeApi()
  const YT = window.YT
  if (!YT) throw new Error("Couldn’t reach YouTube")

  const mount = document.createElement("div")
  playerContainer().appendChild(mount)

  let player: YTPlayer | null = null
  let destroyed = false
  let started = false
  /** The last volume asked for, applied for real once playback is under way. */
  let desired = 0

  const applyVolume = () => {
    if (!player || destroyed) return
    const pct = Math.round(Math.max(0, Math.min(1, desired)) * 100)
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
        },
        onError: (event: YTEvent) => {
          const message = errorMessage(event.data)
          if (settled) handlers.onError?.(message)
          else reject(new Error(message))
        },
        onAutoplayBlocked: () => {
          handlers.onError?.("Your browser blocked this video from starting")
        },
      },
    })
  })

  const live = player as YTPlayer | null
  if (!live) throw new Error("Couldn’t reach YouTube")

  return {
    setVolume(fraction) {
      desired = fraction
      applyVolume()
    },
    play() {
      if (!destroyed) live.playVideo()
    },
    pause() {
      if (!destroyed) live.pauseVideo()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      try {
        live.destroy()
      } catch {
        /* Already torn down by a navigation; the node removal still stands. */
      }
      mount.remove()
    },
  }
}
