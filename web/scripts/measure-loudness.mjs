/**
 * Measures each built-in sound's loudness (EBU R128, via ffmpeg) and prints
 * the trim that brings it to TARGET, next to the trim src/data/sounds.ts
 * holds. Run by hand after adding or replacing a sound, with ffmpeg on PATH:
 *
 *   pnpm run loudness
 *
 * Not part of the build: CI has no ffmpeg, and the trims only change when a
 * file does.
 */
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

/** Near the median of the set, so most sounds barely move. */
const TARGET = -27
/** True-peak ceiling: a trim never raises a sound's peak past it. */
const CEILING = -1

const dir = join(import.meta.dirname, "../../Murmur/Sounds")
const catalog = readFileSync(
  join(import.meta.dirname, "../src/data/sounds.ts"),
  "utf8"
)

function report(file) {
  // ebur128 reports on stderr, and the null muxer writes nothing.
  const run = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-af",
      "ebur128=peak=true",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" }
  )
  if (run.error)
    throw new Error(`ffmpeg didn't run (${run.error.message}). Is it on PATH?`)
  const log = run.stderr
  const summary = log.slice(log.lastIndexOf("Summary:"))
  const loudness = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1])
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1])
  if (!Number.isFinite(loudness) || !Number.isFinite(peak)) {
    throw new Error(`No loudness in ffmpeg's report for ${file}.`)
  }
  let trim = Math.round(Math.min(TARGET - loudness, CEILING - peak) * 2) / 2
  if (peak + trim > CEILING) trim -= 0.5
  return { loudness, peak, trim }
}

const rows = readdirSync(dir)
  .filter((name) => name.endsWith(".ogg"))
  .map((name) => {
    const id = name.slice(0, -".ogg".length)
    const { loudness, peak, trim } = report(join(dir, name))
    const held = new RegExp(`id: "${id}"[\\s\\S]*?trimDb: (-?[\\d.]+)`).exec(
      catalog
    )?.[1]
    return {
      id,
      loudness,
      peak,
      trim,
      held: held === undefined ? null : Number(held),
    }
  })

let stale = 0
for (const { id, loudness, peak, trim, held } of rows) {
  const mark = held === trim ? "" : `  <- sounds.ts has ${held ?? "none"}`
  if (mark) stale++
  console.log(
    `${id.padEnd(14)} ${loudness.toFixed(1).padStart(6)} LUFS  ` +
      `${peak.toFixed(1).padStart(6)} dBTP  trimDb: ${trim}${mark}`
  )
}
console.log(
  stale
    ? `\n${stale} trim(s) in sounds.ts differ from the measurement.`
    : "\nEvery trim in sounds.ts matches."
)
process.exitCode = stale ? 1 : 0
