import * as React from "react"
import { useRegisterSW } from "virtual:pwa-register/react"

import { canPlayOgg } from "@/lib/mixer"

/** Data Saver, or Chrome on Android reporting a cellular link. */
function isMetered(): boolean {
  const connection = (
    navigator as { connection?: { saveData?: boolean; type?: string } }
  ).connection
  return connection?.saveData === true || connection?.type === "cellular"
}

/**
 * Asks the browser not to evict this origin's storage when space runs low:
 * the offline audio cache and the user's own sound files. Called from the
 * actions that store something, since Firefox answers with a prompt. Best
 * effort; a refusal leaves storage as evictable as it was.
 */
export function persistStorage() {
  void navigator.storage?.persist?.().catch(() => {})
}

export interface AudioStatus {
  /** Sounds already in the worker's audio cache. */
  cached: number
  total: number
}

/**
 * Service worker registration, offline audio progress, and the install prompt.
 *
 * Registration lives in the island rather than a layout script because this is
 * the only place that has both the update handle and the Toaster. A shared
 * module imported by two entries would risk two module instances and two
 * registrations, since Rollup may inline a small module into each.
 */
export function usePwa() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  const [audio, setAudio] = React.useState<AudioStatus | null>(null)
  // Where the catalog can't play there is nothing to offer offline: the
  // download would be Ogg this browser can't decode.
  const [oggPlayable] = React.useState(canPlayOgg)
  const [online, setOnline] = React.useState(() => navigator.onLine)

  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  const [prompt, setPrompt] = React.useState<BeforeInstallPromptEvent | null>(
    () => window.__murmurInstallPrompt ?? null
  )
  const [installed, setInstalled] = React.useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS reports it here and nowhere else.
      (navigator as { standalone?: boolean }).standalone === true
  )

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const onMessage = (event: MessageEvent) => {
      const data = event.data as Partial<AudioStatus> & { type?: string }
      if (data?.type !== "AUDIO_STATUS") return
      setAudio({ cached: data.cached ?? 0, total: data.total ?? 0 })
    }
    navigator.serviceWorker.addEventListener("message", onMessage)

    // Sent on every launch and again on reconnect. A worker killed mid-download
    // resumes from this; one that already finished skips every file in fourteen
    // cache lookups. `ready` rather than the register callback, because on a
    // first install the registration has no active worker yet. Never on a
    // metered connection or where the files can't play: 17.6 MB of mobile data,
    // or of Ogg an older iPhone can't decode, is a download nobody asked for.
    // Preferences' Download button still fetches them on request.
    const prime = () => {
      if (isMetered() || !canPlayOgg()) return
      void navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: "PRIME_AUDIO" })
      })
    }
    prime()
    window.addEventListener("online", prime)

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage)
      window.removeEventListener("online", prime)
    }
  }, [])

  React.useEffect(() => {
    const onInstallable = () => setPrompt(window.__murmurInstallPrompt ?? null)
    const onInstalled = () => {
      window.__murmurInstallPrompt = undefined
      setPrompt(null)
      setInstalled(true)
    }
    window.addEventListener("murmur:installable", onInstallable)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("murmur:installable", onInstallable)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  /** Asks the worker to fill any gaps in the audio cache now. */
  const downloadSounds = React.useCallback(() => {
    if (!("serviceWorker" in navigator)) return
    persistStorage()
    void navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type: "PRIME_AUDIO" })
    })
  }, [])

  const install = React.useCallback(async () => {
    if (!prompt) return
    // Single-use whatever the user answers, so it is dropped either way rather
    // than left to fail silently on a second click.
    window.__murmurInstallPrompt = undefined
    setPrompt(null)
    await prompt.prompt()
  }, [prompt])

  return {
    needRefresh,
    updateNow: updateServiceWorker,
    audio: oggPlayable ? audio : null,
    online,
    downloadSounds,
    canInstall: prompt !== null,
    installed,
    install,
  }
}
