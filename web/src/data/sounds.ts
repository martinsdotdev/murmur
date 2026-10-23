/**
 * Mirror of Murmur/Models/SoundCatalog.cs (id, displayName, category) and
 * Murmur/ViewModels/SoundCardViewModel.cs lines 80-126 (lucide path data).
 *
 * Attribution mirrors Murmur/Sounds/SOUNDS_LICENSING.md.
 *
 * Keep these in sync when the app catalog changes, there are only 14 entries,
 * so no automated codegen is justified.
 *
 * Names are getters so each read is in the page's language, which the app
 * settles only after this module has loaded.
 */
import { m } from "@/paraglide/messages.js"

export type SoundCategory = "nature" | "urban" | "generated"
export type SoundLicense =
  "CC0" | "CC BY" | "CC BY 3.0" | "CC BY-SA" | "Public Domain"

export interface Sound {
  id: string
  readonly name: string
  category: SoundCategory
  /** Lucide path data (24-unit viewBox, multiple paths separated by " M "). */
  iconPath: string
  attribution: {
    author: string
    license: SoundLicense
    sourceUrl: string
  }
}

export const sounds: Sound[] = [
  {
    id: "birds",
    get name() {
      return m.sound_birds()
    },
    category: "nature",
    iconPath:
      "M16 7h.01 M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20 M20 7l2 .5-2 .5 M10 18v3 M14 17.75V21 M7 18a6 6 0 0 0 3.84-10.61",
    attribution: {
      author: "kvgarlic",
      license: "CC0",
      sourceUrl: "https://freesound.org/people/kvgarlic/sounds/156826/",
    },
  },
  {
    id: "rain",
    get name() {
      return m.sound_rain()
    },
    category: "nature",
    iconPath:
      "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242 M16 14v6 M8 14v6 M12 16v6",
    attribution: {
      author: "alex36917",
      license: "CC BY",
      sourceUrl: "https://freesound.org/people/alex36917/sounds/524605/",
    },
  },
  {
    id: "storm",
    get name() {
      return m.sound_storm()
    },
    category: "nature",
    iconPath:
      "M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973 M13 12l-3 5h4l-3 5",
    attribution: {
      author: "digifishmusic",
      license: "CC BY",
      sourceUrl: "https://freesound.org/people/digifishmusic/sounds/41739/",
    },
  },
  {
    id: "stream",
    get name() {
      return m.sound_stream()
    },
    category: "nature",
    iconPath:
      "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",
    attribution: {
      author: "gluckose",
      license: "CC0",
      sourceUrl: "https://freesound.org/people/gluckose/sounds/333987/",
    },
  },
  {
    id: "summer-night",
    get name() {
      return m.sound_summer_night()
    },
    category: "nature",
    iconPath:
      "M18 5h4 M20 3v4 M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
    attribution: {
      author: "Lisa Redfern",
      license: "Public Domain",
      sourceUrl: "https://soundbible.com/2083-Crickets-Chirping-At-Night.html",
    },
  },
  {
    id: "waves",
    get name() {
      return m.sound_waves()
    },
    category: "nature",
    iconPath:
      "M2 12q2.5 2 5 0t5 0 5 0 5 0 M2 19q2.5 2 5 0t5 0 5 0 5 0 M2 5q2.5 2 5 0t5 0 5 0 5 0",
    attribution: {
      author: "Luftrum",
      license: "CC BY",
      sourceUrl: "https://freesound.org/people/Luftrum/sounds/48412/",
    },
  },
  {
    id: "wind",
    get name() {
      return m.sound_wind()
    },
    category: "nature",
    iconPath:
      "M12.8 19.6A2 2 0 1 0 14 16H2 M17.5 8a2.5 2.5 0 1 1 2 4H2 M9.8 4.4A2 2 0 1 1 11 8H2",
    attribution: {
      author: "felix.blume",
      license: "CC0",
      sourceUrl: "https://freesound.org/people/felix.blume/sounds/217506/",
    },
  },
  {
    id: "boat",
    get name() {
      return m.sound_boat()
    },
    category: "urban",
    iconPath:
      "M10 2v15 M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z",
    attribution: {
      author: "Falcet",
      license: "CC0",
      sourceUrl: "https://freesound.org/people/Falcet/sounds/439365/",
    },
  },
  {
    id: "city",
    get name() {
      return m.sound_city()
    },
    category: "urban",
    iconPath:
      "M10 12h4 M10 8h4 M14 21v-3a2 2 0 0 0-4 0v3 M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2 M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
    attribution: {
      author: "gezortenplotz",
      license: "CC BY",
      sourceUrl: "https://freesound.org/people/gezortenplotz/sounds/44796/",
    },
  },
  {
    id: "coffee-shop",
    get name() {
      return m.sound_coffee_shop()
    },
    category: "urban",
    iconPath:
      "M10 2v2 M14 2v2 M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1 M6 2v2",
    attribution: {
      author: "stephan",
      license: "Public Domain",
      sourceUrl: "https://soundbible.com/1664-Restaurant-Ambiance.html",
    },
  },
  {
    id: "fireplace",
    get name() {
      return m.sound_fireplace()
    },
    category: "urban",
    iconPath:
      "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4",
    attribution: {
      author: "ezwa",
      license: "Public Domain",
      sourceUrl: "https://soundbible.com/1543-Fireplace.html",
    },
  },
  {
    id: "train",
    get name() {
      return m.sound_train()
    },
    category: "urban",
    iconPath:
      "M8 3.1V7a4 4 0 0 0 8 0V3.1 M9 15l-1-1 M15 15l1-1 M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z M8 19l-2 3 M16 19l2 3",
    attribution: {
      author: "SDLx",
      license: "CC BY 3.0",
      sourceUrl: "https://freesound.org/people/SDLx/sounds/259988/",
    },
  },
  {
    id: "pink-noise",
    get name() {
      return m.sound_pink_noise()
    },
    category: "generated",
    iconPath:
      "M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2",
    attribution: {
      author: "Omegatron",
      license: "CC BY-SA",
      sourceUrl: "https://es.wikipedia.org/wiki/Archivo:Pink_noise.ogg",
    },
  },
  {
    id: "white-noise",
    get name() {
      return m.sound_white_noise()
    },
    category: "generated",
    iconPath: "M2 10v3 M6 6v11 M10 3v18 M14 8v7 M18 5v13 M22 10v3",
    attribution: {
      author: "Jorge Stolfi",
      license: "CC BY-SA",
      sourceUrl:
        "https://commons.wikimedia.org/w/index.php?title=File%3AWhite-noise-sound-20sec-mono-44100Hz.ogg",
    },
  },
]

export const categoryLabel: Readonly<Record<SoundCategory, string>> = {
  get nature() {
    return m.category_nature()
  },
  get urban() {
    return m.category_urban()
  },
  get generated() {
    return m.category_generated()
  },
}
