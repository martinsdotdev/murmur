/// <reference lib="webworker" />

/**
 * Murmur's service worker.
 *
 * Two staging rules the code cannot state on its own:
 *
 *  - The shell installs atomically. dist/index.html is an astro-island
 *    placeholder and nothing else, so a precache holding the document without
 *    MurmurApp.js paints a blank dark page with no error and no spinner. A
 *    partial shell is worse than none, which is what Workbox's all-or-nothing
 *    install buys.
 *  - The 17.9 MB of audio is staged after activation, driven by a message from
 *    the page. Nothing on that path may reach install or activate, because a
 *    client waits for a worker to finish activating and would sit behind the
 *    whole download.
 *
 * No top-level export in this file. vite-plugin-pwa builds it with
 * inlineDynamicImports and registers it as a classic worker, so an emitted
 * `export {}` would fail with "Unexpected token 'export'".
 */

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"
import { CacheFirst } from "workbox-strategies"

// Relative rather than "@/data/sounds": this file is built in vite-plugin-pwa's
// own Vite pass, which inherits resolve but not Astro's plugins, so the alias
// is absent. Importing the catalog rather than restating fifteen ids is what
// keeps the two from drifting.
import { sounds } from "./data/sounds"

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

/**
 * Bumped by hand when the OGGs themselves change, deliberately not keyed to
 * __APP_VERSION__: the files are unhashed and change on their own schedule, so
 * versioning them per build would re-download 17.9 MB on every release. The
 * precache needs no such constant, Workbox already keys it per file.
 */
const AUDIO_CACHE = "murmur-audio-v1"

/** Every navigation to the app resolves to this one precached document. */
const SHELL_URL = "/"

/**
 * Where the app lived until it moved to the root. A registration scoped here
 * still updates to this worker, and retires itself (see activate).
 */
const LEGACY_SCOPE = "/app/"

const AUDIO_IDS = sounds.map((sound) => sound.id)
const audioUrl = (id: string) => `/sounds/${id}.ogg`

// Throws here, at worker evaluation, if the manifest transform in
// astro.config.mjs ever stops producing /. A worker that fails to install
// is a better failure than one that installs and then serves nothing.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// The precache route's own matcher only tries the entry URL, its directory
// index and its clean form, so /?x= misses it. This lands every navigation to
// the app on the same document. Only those: the scope is the whole origin,
// and the About pages, in every language, still come from the network.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(SHELL_URL), {
    allowlist: [/^\/(?:index\.html)?(?:\?.*)?$/],
  })
)

// The app's old address, from an old link or an installed copy whose manifest
// hasn't caught up yet, answered here so it works offline too. A redirect with
// no hash of its own keeps the request's, which is what carries a shared mix.
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    /^\/app(?:\/(?:index\.html)?)?$/.test(url.pathname),
  async ({ url }) =>
    Response.redirect(new URL(SHELL_URL + url.search, url).href, 302)
)

// Scope only decides which documents this worker controls.
// Every fetch a controlled document makes passes through here, which is the
// only reason a /sounds/ route works at all. CacheFirst both serves what
// stageAudio stored and fills a gap the user reached first.
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    url.origin === self.location.origin &&
    url.pathname.startsWith("/sounds/"),
  new CacheFirst({ cacheName: AUDIO_CACHE })
)

// No setDefaultHandler and no setCatchHandler on purpose. An unmatched request
// gets no respondWith and goes to the network untouched, which is what leaves
// the YouTube iframe API and every other cross-origin request alone.

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      // The registration from when the app lived at /app/: its precache goes
      // (Workbox names it after the scope), and so does it, which hands /app/
      // to the root registration's redirect. Audio is shared by name, so the
      // 17.9 MB stays.
      if (new URL(self.registration.scope).pathname === LEGACY_SCOPE) {
        await Promise.all(
          names
            .filter((name) => name.endsWith(self.registration.scope))
            .map((name) => caches.delete(name))
        )
        await self.registration.unregister()
        return
      }
      await Promise.all(
        names
          .filter((name) => name.startsWith("murmur-audio-"))
          .filter((name) => name !== AUDIO_CACHE)
          .map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener("message", (event) => {
  const type = (event.data as { type?: unknown } | null)?.type
  if (type === "SKIP_WAITING") {
    void self.skipWaiting()
  } else if (type === "PRIME_AUDIO") {
    // waitUntil on a message keeps the worker alive without delaying a single
    // fetch, which is the whole reason this is not in activate. It doubles as
    // the status request: a run with nothing missing is fifteen cache lookups
    // and two posts.
    event.waitUntil(primeAudio())
  }
})

let priming: Promise<void> | null = null

/**
 * Idempotent, because the page sends PRIME_AUDIO on every launch and again on
 * reconnect, and that repetition is the resume: a worker killed mid-download
 * simply finds fewer files missing next time.
 */
function primeAudio(): Promise<void> {
  priming ??= stageAudio().finally(() => {
    priming = null
  })
  return priming
}

/**
 * Sequential, not parallel: fifteen concurrent downloads would queue the one
 * sound the user actually reached for behind 17 MB of the thirteen they did
 * not.
 */
async function stageAudio() {
  const cache = await caches.open(AUDIO_CACHE)
  // One pass of lookups first, so the page learns exactly what is missing
  // (and so how much is left to download) before anything is fetched.
  const missing: string[] = []
  for (const id of AUDIO_IDS) {
    if (!(await cache.match(audioUrl(id)))) missing.push(id)
  }
  await post(missing)
  for (const id of [...missing]) {
    const url = audioUrl(id)
    // Re-read per file, so a sound the /sounds/ route stored while this loop
    // was running is not fetched twice.
    if (!(await cache.match(url))) {
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`${url}: ${response.status}`)
        await cache.put(url, response)
      } catch {
        /* Offline, or one bad file. The next launch asks again. */
        continue
      }
    }
    missing.splice(missing.indexOf(id), 1)
    await post(missing)
  }
}

async function post(missing: string[]) {
  const message = {
    type: "AUDIO_STATUS",
    cached: AUDIO_IDS.length - missing.length,
    total: AUDIO_IDS.length,
    missing,
  }
  for (const client of await self.clients.matchAll()) {
    client.postMessage(message)
  }
}
