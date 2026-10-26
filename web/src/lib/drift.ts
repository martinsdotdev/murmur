/**
 * Drift: each sound slowly dips below its slider and comes back, so a long
 * mix doesn't settle into something heard as a loop. Only ever down: the
 * slider stays the loudest a sound gets, which matters most to someone
 * falling asleep.
 *
 * No Web Audio here. The mixer samples drift once a step and ramps each
 * sound toward it (see Mixer.setDrift).
 */

/** How far a dip goes at its deepest: half the amplitude, clearly there but never gone. */
const DEPTH_DB = 6

/** One sound's wander: two slow sines, each with its own period and phase. */
export interface DriftShape {
  /** Seconds. */
  periods: [number, number]
  /** Radians. */
  phases: [number, number]
}

/**
 * Drawn once per sound. Periods this far apart never line up into a pattern
 * the ear catches, and random phases keep a mix's sounds from dipping
 * together.
 */
export function driftShape(): DriftShape {
  return {
    periods: [30 + 40 * Math.random(), 75 + 45 * Math.random()],
    phases: [2 * Math.PI * Math.random(), 2 * Math.PI * Math.random()],
  }
}

/**
 * The gain a sound has drifted to at `t` seconds: 1 at its slider, down to
 * DEPTH_DB below it. `depth`, 0 to 1, eases drift in and out. At most it
 * moves about 0.4 dB a second, so a ramp between samples a second apart is
 * as smooth as the curve itself.
 */
export function driftAt(shape: DriftShape, t: number, depth: number): number {
  const [a, b] = shape.periods
  const [pa, pb] = shape.phases
  const wave =
    (Math.sin((2 * Math.PI * t) / a + pa) +
      Math.sin((2 * Math.PI * t) / b + pb)) /
    2
  const dip = (1 - wave) / 2
  return 10 ** ((-DEPTH_DB * depth * dip) / 20)
}
