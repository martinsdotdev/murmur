/**
 * The starter mixes a first visit is seeded with. Zero-volume sounds are absent
 * from the map, as in the Windows app. Levels (see lib/levels.ts), converted
 * from the gains they were tuned as, so they still sound as designed.
 *
 * Names are getters, read once at seeding in the visitor's language. From then
 * on they are saved mixes like any other, and keep the name they were given.
 */
import { m } from "@/paraglide/messages.js"

export interface Preset {
  readonly name: string
  mix: Record<string, number>
}

export const presets: Preset[] = [
  {
    get name() {
      return m.preset_rainy_cafe()
    },
    mix: { rain: 0.79, "coffee-shop": 0.91, fireplace: 0.43 },
  },
  {
    get name() {
      return m.preset_night_train()
    },
    mix: { train: 0.6, rain: 0.67, wind: 0.57 },
  },
  {
    get name() {
      return m.preset_seaside_evening()
    },
    mix: { waves: 0.85, wind: 0.57, "summer-night": 0.72 },
  },
]
