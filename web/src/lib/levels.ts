/**
 * A level is where a slider sits, 0 to 1: what is stored, shared, shown and
 * dragged. Gain is worked out from it only where sound is made (the mixer),
 * so every control moves loudness evenly to the ear and the numbers people
 * see stay the positions they set.
 */
import { sounds } from "@/data/sounds"

import type { MixerState } from "./mixer"

/**
 * Cubic, as PulseAudio's and GNOME's volume controls are: 0 is silent, 50% is
 * -18 dB and 70% is -9 dB. Linear gain, which this replaced, put half the
 * slider within 6 dB of full and nearly all the audible change in its bottom
 * fifth.
 */
export function levelGain(level: number): number {
  return level ** 3
}

const trims = new Map(sounds.map((s) => [s.id, 10 ** (s.trimDb / 20)]))

/** A built-in sound's loudness trim as gain; your own sounds have none. */
export function soundTrim(id: string): number {
  return trims.get(id) ?? 1
}

/** What a sound at this level plays at, before the master. */
export function soundGain(id: string, level: number): number {
  return levelGain(level) * soundTrim(id)
}

/**
 * The level that plays as loud as a gain did before levels existed, when the
 * stored number was the gain itself and no sound had a trim. On the sliders'
 * 1% grid, so a converted mix compares and shares cleanly; never 0 for a sound
 * that was on, and at most 1, which a loud sound that had been turned right up
 * can't quite reach once trimmed down.
 */
export function levelFromGain(gain: number, trim = 1): number {
  const level = Math.round(Math.cbrt(gain / trim) * 100) / 100
  return Math.min(1, Math.max(0.01, level))
}

/** A whole mix from before levels, each sound by its own trim. */
export function levelsFromGains(mix: MixerState): MixerState {
  return Object.fromEntries(
    Object.entries(mix).map(([id, gain]) => [
      id,
      levelFromGain(gain, soundTrim(id)),
    ])
  )
}
