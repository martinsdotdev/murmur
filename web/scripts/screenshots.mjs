/**
 * Takes the About page's pictures from the real app: a screenshot of the mixer
 * playing the Rainy café starter mix for each language and theme
 * (src/assets/screenshots/<locale>-<theme>.png), and a 1200×630 card for link
 * previews per language (public/og/<locale>.png).
 *
 * Run against a preview of a fresh build, then build again so the pages pick
 * the pictures up:
 *
 *   pnpm build && pnpm preview        (in one terminal)
 *   pnpm run screenshots              (in another)
 *
 * Needs a Chromium: `pnpm exec playwright-core install chromium`, or point
 * CHROMIUM at one.
 */
import { mkdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const BASE = process.env.BASE ?? "http://localhost:4321"
const root = new URL("../", import.meta.url)
const shots = new URL("src/assets/screenshots/", root)
const cards = new URL("public/og/", root)
mkdirSync(shots, { recursive: true })
mkdirSync(cards, { recursive: true })

const { locales } = JSON.parse(
  readFileSync(new URL("project.inlang/settings.json", root), "utf8")
)
const messages = (locale) =>
  JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), "utf8"))
const aboutPath = (locale) =>
  locale === "en" ? "/about/" : `/${locale.toLowerCase()}/about/`

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM,
  args: ["--autoplay-policy=no-user-gesture-required"],
})

for (const locale of locales) {
  const m = messages(locale)

  for (const theme of ["light", "dark"]) {
    // 1280 wide at 1.5x: 1920 pixels, the largest width the page asks for.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1.5,
      locale,
      colorScheme: theme,
      // Holds the level meters still, mid-height, as a picture should.
      reducedMotion: "reduce",
      serviceWorkers: "block",
    })
    await context.addInitScript(
      ([locale, theme]) => {
        localStorage.setItem("locale", locale)
        localStorage.setItem("theme", theme)
      },
      [locale, theme]
    )
    const page = await context.newPage()
    await page.goto(`${BASE}/`)
    await page.waitForSelector("[role=button][aria-pressed]")
    // A first visit is seeded with the starter mixes, in its language.
    await page.getByText(m.preset_rainy_cafe, { exact: true }).first().click()
    await page.waitForTimeout(800)
    // Applying a mix starts it; Play is only there if it didn't.
    const play = page.getByRole("button", { name: m.action_play, exact: true })
    if (await play.count()) await play.first().click()
    await page.mouse.move(1279, 799)
    await page.waitForTimeout(1500)
    await page.screenshot({
      path: fileURLToPath(new URL(`${locale}-${theme}.png`, shots)),
    })
    await context.close()
    console.log(`screenshot ${locale}-${theme}`)
  }

  // The card is drawn on the About page itself, so it takes the page's fonts,
  // colours and logo, and shows the dark screenshot just taken.
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    locale,
    colorScheme: "dark",
    serviceWorkers: "block",
  })
  await context.addInitScript(() => localStorage.setItem("theme", "dark"))
  const page = await context.newPage()
  await page.goto(`${BASE}${aboutPath(locale)}`)
  await page.waitForSelector(".hero svg")
  const shot = readFileSync(new URL(`${locale}-dark.png`, shots), "base64")
  await page.evaluate(
    ({ shot, tagline }) => {
      const logo = document.querySelector(".hero svg").outerHTML
      document.body.innerHTML = `
        <div style="position:fixed;inset:0;overflow:hidden;background:var(--color-neutral-background-1)">
          <div style="position:absolute;left:72px;top:150px;width:380px">
            <div style="width:88px;height:88px">${logo}</div>
            <div class="serif-display" style="font-size:72px;line-height:1;margin-top:28px">Murmur</div>
            <div style="font-size:26px;line-height:1.3;margin-top:18px;color:var(--color-neutral-foreground-2)">${tagline}</div>
            <div style="font-size:18px;margin-top:40px;color:var(--color-neutral-foreground-3)">murmur.umaru.dev</div>
          </div>
          <img src="data:image/png;base64,${shot}" style="position:absolute;left:500px;top:96px;width:900px;border:1px solid var(--color-neutral-stroke-2);border-radius:12px">
        </div>`
      for (const svg of document.querySelectorAll("svg")) {
        svg.setAttribute("width", "88")
        svg.setAttribute("height", "88")
      }
    },
    { shot, tagline: m.about_tagline }
  )
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  await page.screenshot({
    path: fileURLToPath(new URL(`${locale}.png`, cards)),
  })
  await context.close()
  console.log(`card ${locale}`)
}

await browser.close()
