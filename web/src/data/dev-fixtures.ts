/**
 * Dev-only stand-ins for the persisted state, chosen by `?data=` and switched
 * with DevDataToggle. Never shipped: app-state.ts only reads these behind
 * import.meta.env.DEV, so production builds drop this module.
 *
 * The worst case is realistic, not random: real YouTube title shapes, file
 * names as phones and recorders write them, names in other scripts, and the
 * chains Duplicate actually produces. Raw (pre-validation) shape, so the
 * fixtures go through the same coerce() the user's own storage does.
 */

const CATALOG = [
  "birds",
  "boat",
  "city",
  "coffee-shop",
  "fireplace",
  "pink-noise",
  "rain",
  "storm",
  "stream",
  "summer-night",
  "train",
  "waves",
  "white-noise",
  "wind",
]

const LONG_MIX = "Rainy Sunday morning in the café near the old train station"

const worstCustoms = [
  {
    id: "yt_mPZkdNFkNps",
    name: "10 Hours of Relaxing Rain Sounds for Sleeping, Studying & Relaxation | Black Screen 4K (No Ads)",
    videoId: "mPZkdNFkNps",
  },
  {
    id: "cu1700000000001",
    name: "ocean-waves-at-dawn_recorded-on-the-baltic-coast-near-gdansk_2023-final-v2",
    url: "https://archive.org/download/baltic-dawn/ocean-waves-at-dawn_recorded-on-the-baltic-coast-near-gdansk_2023-final-v2.mp3",
  },
  { id: "cu1700000000002", name: "Fan", url: "https://example.com/fan.mp3" },
  {
    id: "cu1700000000003",
    name: "صوت المطر على النافذة",
    url: "https://example.com/rain-window.mp3",
  },
  {
    id: "yt_jfKfPfyJRdk",
    name: "lofi hip hop radio 📚 beats to relax/study to",
    videoId: "jfKfPfyJRdk",
  },
  {
    id: "cu1700000000005",
    name: "Rain & Thunder <3 — Wiśniewska-Kowalczyk",
    url: "https://example.com/rain-thunder.mp3",
  },
  // A file whose blob the browser evicted: the record survives in
  // localStorage, the audio does not.
  {
    id: "cf1700000000004",
    name: "Grandma's kitchen clock (recorded on my phone, Christmas 2019)",
    hasFile: true,
  },
]

// Built on demand: a top-level call would count as a side effect and keep
// this module in production builds even though nothing there reads it.
const everything = () =>
  Object.fromEntries([
    ...CATALOG.map((id, i) => [id, [1, 0.01, 0.07, 0.5, 0.35][i % 5]]),
    ...worstCustoms.map((c, i) => [
      c.id,
      [0.6, 0.25, 1, 0.4, 0.05, 0.8, 0.5][i],
    ]),
  ])

const worst = () => ({
  vols: everything(),
  master: 1,
  mixName: `${LONG_MIX} copy 2`,
  dirty: true,
  view: "grid",
  customs: worstCustoms,
  saved: [
    {
      name: LONG_MIX,
      mix: { rain: 0.5, "coffee-shop": 0.45, fireplace: 0.2, train: 0.1 },
    },
    { name: "Jo", mix: { "white-noise": 0.01 } },
    { name: "Deep work 🎧🌧️", mix: { yt_mPZkdNFkNps: 0.6, rain: 0.3 } },
    { name: "مطر هادئ وقت النوم", mix: { cu1700000000003: 0.5, wind: 0.2 } },
    { name: "Everything at once (all 14 + mine)", mix: everything() },
    {
      name: "Łódź – Wiśniewska-Kowalczyk focus blend",
      mix: { stream: 1, birds: 0.35 },
    },
    { name: `${LONG_MIX} copy`, mix: { rain: 0.5, "coffee-shop": 0.45 } },
    { name: `${LONG_MIX} copy 2`, mix: { rain: 0.5 } },
    // Its only sound is the evicted file, so it loads as silence.
    { name: "Clock", mix: { cf1700000000004: 0.6 } },
  ],
})

const empty = () => ({ vols: {}, saved: [], customs: [], mixName: "New mix" })

const one = () => ({
  vols: { rain: 0.7 },
  mixName: "Rain",
  dirty: false,
  saved: [{ name: "Rain", mix: { rain: 0.7 } }],
  customs: [
    { id: "cu1700000000002", name: "Fan", url: "https://example.com/fan.mp3" },
  ],
})

const huge = () => ({
  vols: Object.fromEntries(CATALOG.map((id) => [id, 0.5])),
  mixName: "Focus 80",
  dirty: false,
  saved: Array.from({ length: 80 }, (_, i) => ({
    name: `${["Focus", "Sleep", "Morning", "Rainy", "Train", "Reading"][i % 6]} ${i + 1}`,
    mix: { [CATALOG[i % 14]]: 0.6, [CATALOG[(i + 5) % 14]]: 0.3 },
  })),
  customs: Array.from({ length: 40 }, (_, i) => ({
    id: `cu17000000${String(i).padStart(5, "0")}`,
    name: `Field recording ${i + 1}`,
    url: `https://example.com/field-${i + 1}.mp3`,
  })),
})

export const devFixtures: Record<string, () => unknown> = {
  worst,
  empty,
  one,
  huge,
}
