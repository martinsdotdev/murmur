import { readFileSync } from "node:fs"
import { defineConfig } from "astro/config"
import sitemap from "@astrojs/sitemap"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import AstroPWA from "@vite-pwa/astro"
import { paraglideVitePlugin } from "@inlang/paraglide-js"

// Inlined rather than imported from the component, so the client bundle gets
// the string and not the whole manifest.
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
)

// build.format is 'directory', so Astro emits dist/app/index.html, which Pages
// serves at /app/ and 301s /app to. @vite-pwa/astro's own transform would
// rewrite this entry to the bare string 'app'; Workbox would then precache a
// URL that redirects, and createHandlerBoundToURL('/app/') would throw at
// worker evaluation because /app/ is not a manifest URL. See manifestTransforms.
const APP_SHELL = /^\/?app\/index\.html$/

export default defineConfig({
  // Custom domain (murmur.umaru.dev). Pages serves at the apex of the subdomain
  // so `base` defaults to '/'. The public/CNAME file tells Pages to bind this
  // domain to the deployment.
  site: "https://murmur.umaru.dev",
  trailingSlash: "never",

  // Astro 7 defaults this to 'jsx', which deletes a newline between a text run
  // and an adjacent inline element instead of collapsing it to a space, gluing
  // the two words together. The footer credit that used to demonstrate it has
  // since been rewritten, so this is now defensive: any prose that wraps before
  // an inline <a> would silently lose the space. To re-check, set this to 'jsx',
  // build, and grep dist for /[A-Za-z]<a[ >]/. It should find nothing.
  compressHTML: true,

  integrations: [
    // Keys are path segments, values hreflang tags. Pages outside a locale
    // segment, the app among them, count as English.
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: { en: "en", "pt-br": "pt-BR", es: "es", ja: "ja" },
      },
    }),
    react(),
    // Last, so its astro:build:done runs after every other integration has
    // finished writing dist, which is when the precache glob is taken.
    AstroPWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Astro pages never pass through Vite's transformIndexHtml, so nothing
      // would be injected anyway. MurmurApp registers via virtual:pwa-register.
      injectRegister: null,
      // A waiting worker is surfaced as a toast rather than swapped in under a
      // playing mix. See src/components/app/use-pwa.ts.
      registerType: "prompt",
      // The installed app is the mixer, not the marketing page. sw.js still
      // sits at the origin root, so its maximum scope is '/' and narrowing to
      // /app/ needs no Service-Worker-Allowed header, which GitHub Pages could
      // not send anyway.
      scope: "/app/",
      manifest: {
        // Frozen independently of start_url so the installed identity survives
        // a future route change.
        id: "/app/",
        name: "Murmur",
        short_name: "Murmur",
        description:
          "Blend rain, a fireplace, a train and more. Save mixes, set a sleep timer, share links.",
        lang: "en",
        dir: "ltr",
        scope: "/app/",
        // The trailing slash matters: Pages 301s /app to /app/, and a
        // start_url that costs a redirect costs it on every cold launch.
        start_url: "/app/",
        display: "standalone",
        // window-controls-overlay is deliberately absent: the header is not
        // built against env(titlebar-area-*) and would sit under the caption
        // buttons.
        display_override: ["standalone", "minimal-ui"],
        // Not locked. This gets propped on a bedside table as often as it sits
        // on a desk.
        orientation: "any",
        // The pre-paint surface of <html data-theme="dark">, so a cold launch
        // splash matches what the app paints.
        background_color: "#232017",
        theme_color: "#232017",
        categories: ["music", "lifestyle", "productivity"],
        // A second window would mean a second AudioContext and two mixes
        // playing at once, so a launch focuses the window already open.
        launch_handler: { client_mode: ["focus-existing", "auto"] },
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      injectManifest: {
        // The shell only. The 17.6 MB of audio is staged by the worker after
        // activation, and the landing page is not part of the installed app.
        globPatterns: [
          "app/index.html",
          "_astro/*.{js,css,woff2}",
          "icon.svg",
          // Only the two "any" icons, which Media Session fetches at runtime
          // and so must survive offline. The maskable and apple-touch pair are
          // read once by the OS at install time, always online. favicon.ico is
          // 374 KB and a standalone window has no tab to show it in.
          "icons/icon-192.png",
          "icons/icon-512.png",
          // manifest.webmanifest is not listed: the integration precaches it
          // itself, and naming it here produced a duplicate entry.
        ],
        // Astro names a page's CSS and scripts after the page or component.
        // The landing page is [...locale].astro, whose CSS comes out as
        // _..<hash>.css, and its footer's language links have a script of
        // their own. /app loads neither.
        globIgnores: ["_astro/_..*.css", "_astro/Footer.*.js"],
        // Supplying this suppresses the integration's own transform. See
        // APP_SHELL above for what that one would do.
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.map((entry) =>
              APP_SHELL.test(entry.url) ? { ...entry, url: "/app/" } : entry
            ),
            warnings: [],
          }),
        ],
      },
    }),
  ],
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    plugins: [
      tailwindcss(),
      // Paraglide only holds the locale. src/lib/i18n.ts decides it: the
      // middleware from a built page's path, the app from a stored choice or
      // the browser. See that file for why the built-in strategies are not
      // used.
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/paraglide",
        emitTsDeclarations: true,
        strategy: ["globalVariable", "baseLocale"],
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    build: {
      cssMinify: "esbuild",
    },
  },
})
