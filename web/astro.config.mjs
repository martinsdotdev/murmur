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

// The app is the root page, dist/index.html, reached at /. @vite-pwa/astro's
// own transform would name this entry something other than /, and
// createHandlerBoundToURL('/') would throw at worker evaluation because / is
// not a manifest URL. See manifestTransforms.
const APP_SHELL = /^\/?index\.html$/

export default defineConfig({
  // Custom domain (murmur.umaru.dev). Pages serves at the apex of the subdomain
  // so `base` defaults to '/'. The public/CNAME file tells Pages to bind this
  // domain to the deployment.
  site: "https://murmur.umaru.dev",
  // What Pages serves: every page but the root is a directory, at /about/ and
  // /pt-br/about/, and Pages 301s the bare path there. Matching it means links,
  // canonical and hreflang links and the sitemap all name the address that
  // answers, and the dev server and preview behave as production does.
  trailingSlash: "always",

  // Astro 7 defaults this to 'jsx', which deletes a newline between a text run
  // and an adjacent inline element instead of collapsing it to a space, gluing
  // the two words together. The footer credit that used to demonstrate it has
  // since been rewritten, so this is now defensive: any prose that wraps before
  // an inline <a> would silently lose the space. To re-check, set this to 'jsx',
  // build, and grep dist for /[A-Za-z]<a[ >]/. It should find nothing.
  compressHTML: true,

  // The About pages had the root and the language roots until the app took /.
  // Old links to /pt-br/, /es/ and /ja/ land on their About page. /app/, where
  // the app was, is a page of its own (src/pages/app.astro): a shared mix's
  // #mix= has to survive the move, and a static redirect drops it.
  redirects: {
    "/pt-br": "/pt-br/about/",
    "/es": "/es/about/",
    "/ja": "/ja/about/",
  },

  integrations: [
    // Keys are path segments, values hreflang tags. Pages outside a locale
    // segment, the app among them, count as English. Redirects stay out.
    sitemap({
      filter: (page) =>
        !/^https:\/\/murmur\.umaru\.dev\/(app|pt-br|es|ja)\/$/.test(page),
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
      // The installed app is the mixer at /. The scope covers the About pages
      // too, but the worker only answers navigations to the app (see sw.ts),
      // so those still come from the network.
      scope: "/",
      manifest: {
        // Frozen independently of start_url so the installed identity survives
        // a route change, as it did the app's move from /app/ to /.
        id: "/app/",
        name: "Murmur",
        short_name: "Murmur",
        description:
          "Blend rain, a fireplace, a train and more. Save mixes, set a sleep timer, share links.",
        lang: "en",
        dir: "ltr",
        scope: "/",
        start_url: "/",
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
        // The shell only. The 17.9 MB of audio is staged by the worker after
        // activation, and the About pages are not part of the installed app.
        globPatterns: [
          "index.html",
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
        // The About page's CSS comes out as about.<hash>.css, and its footer's
        // language links have a script of their own. The app loads neither.
        globIgnores: ["_astro/about.*.css", "_astro/Footer.*.js"],
        // Supplying this suppresses the integration's own transform. See
        // APP_SHELL above for what that one would do.
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.map((entry) =>
              APP_SHELL.test(entry.url) ? { ...entry, url: "/" } : entry
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
