/**
 * Drift: each sound slowly dips below its slider and comes back, never above
 * it. The mixer samples it once a second.
 */

/** The deepest dip. */
const DEPTH_DB = 6

/** Two slow sines per sound, each with its own period and phase. */
export interface DriftShape {
  /** Seconds. */
  periods: [number, number]
  /** Radians. */
  phases: [number, number]
}

/** Random per sound, so the sounds in a mix don't dip together. */
export function driftShape(): DriftShape {
  return {
    periods: [30 + 40 * Math.random(), 75 + 45 * Math.random()],
    phases: [2 * Math.PI * Math.random(), 2 * Math.PI * Math.random()],
  }
}

/**
 * A sound's drift gain at `t` seconds: 1 at its slider, down to DEPTH_DB
 * below. `depth`, 0 to 1, eases drift in and out.
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
