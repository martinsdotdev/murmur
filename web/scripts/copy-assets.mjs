// Mirrors the app's living assets into the site's public folder before dev/build.
// Idempotent, only copies when source is newer than destination.
import {
  existsSync,
  mkdirSync,
  statSync,
  copyFileSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, "..")
const repoRoot = resolve(webRoot, "..")
const appRoot = join(repoRoot, "Murmur")

const targets = [
  {
    src: join(appRoot, "Assets", "Source", "AppIcon.svg"),
    dst: join(webRoot, "public", "icon.svg"),
  },
  {
    src: join(appRoot, "Assets", "AppIcon.ico"),
    dst: join(webRoot, "public", "favicon.ico"),
  },
]

const soundsSrc = join(appRoot, "Sounds")
const soundsDst = join(webRoot, "public", "sounds")

function copyIfStale(src, dst) {
  if (!existsSync(src)) {
    console.warn(`[copy-assets] missing source: ${src}`)
    return
  }
  const dstDir = dirname(dst)
  if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
  if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) return
  copyFileSync(src, dst)
  console.log(`[copy-assets] ${src} → ${dst}`)
}

for (const { src, dst } of targets) copyIfStale(src, dst)

if (existsSync(soundsSrc)) {
  const sizes = {}
  for (const file of readdirSync(soundsSrc).sort()) {
    if (!file.endsWith(".ogg")) continue
    copyIfStale(join(soundsSrc, file), join(soundsDst, file))
    sizes[file.slice(0, -".ogg".length)] = statSync(join(soundsSrc, file)).size
  }
  // What Preferences quotes for a download ("Download (18 MB)"). Committed, so
  // a build without the sounds alongside still knows; rewritten only when a
  // size actually changes.
  const sizesPath = join(webRoot, "src", "data", "sound-sizes.json")
  const json = JSON.stringify(sizes, null, 2) + "\n"
  if (!existsSync(sizesPath) || readFileSync(sizesPath, "utf8") !== json) {
    writeFileSync(sizesPath, json)
    console.log(`[copy-assets] wrote ${sizesPath}`)
  }
} else {
  console.warn(`[copy-assets] missing sounds dir: ${soundsSrc}`)
}
