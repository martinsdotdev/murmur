/**
 * The starter mixes a first visit is seeded with. Zero-volume sounds are absent
 * from the map, as in the Windows app.
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
    mix: { rain: 0.5, "coffee-shop": 0.45, fireplace: 0.2 },
  },
  {
    get name() {
      return m.preset_night_train()
    },
    mix: { train: 0.55, rain: 0.3, wind: 0.2 },
  },
  {
    get name() {
      return m.preset_seaside_evening()
    },
    mix: { waves: 0.55, wind: 0.2, "summer-night": 0.35 },
  },
]
