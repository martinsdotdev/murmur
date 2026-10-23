/**
 * Fails the build when a translation drifts from messages/en.json: a key
 * missing or left over, or a placeholder dropped or misspelt. Paraglide would
 * quietly fall back to English for the first and print "{count}" for the last.
 *
 * Run: pnpm exec tsx scripts/check-messages.ts (also the first step of build).
 */
import { readFileSync } from "node:fs"

type Variant = {
  declarations?: string[]
  selectors?: string[]
  match: Record<string, string>
}
type Message = string | Variant[]

const root = new URL("../", import.meta.url)
const settings = JSON.parse(
  readFileSync(new URL("project.inlang/settings.json", root), "utf8")
) as { baseLocale: string; locales: string[] }

function load(locale: string): Record<string, Message> {
  const messages = JSON.parse(
    readFileSync(new URL(`messages/${locale}.json`, root), "utf8")
  )
  delete messages.$schema
  return messages
}

/** The inputs a message reads: its placeholders and `input` declarations,
 * less the locals it declares itself, such as a plural selector. */
function inputs(message: Message): string[] {
  const texts = typeof message === "string" ? [message] : []
  const names = new Set<string>()
  const locals = new Set<string>()
  if (typeof message !== "string") {
    for (const variant of message) {
      texts.push(...Object.values(variant.match))
      for (const declaration of variant.declarations ?? []) {
        const [kind, name] = declaration.split(/\s+/)
        if (kind === "input") names.add(name)
        if (kind === "local") locals.add(name)
      }
    }
  }
  for (const text of texts) {
    for (const [, name] of text.matchAll(/\{(\w+)\}/g)) names.add(name)
  }
  return [...names].filter((name) => !locals.has(name)).sort()
}

const base = load(settings.baseLocale)
const problems: string[] = []

for (const locale of settings.locales) {
  if (locale === settings.baseLocale) continue
  const messages = load(locale)
  for (const key of Object.keys(base)) {
    if (!(key in messages)) {
      problems.push(`${locale}: missing ${key}`)
      continue
    }
    const want = inputs(base[key]).join(", ")
    const got = inputs(messages[key]).join(", ")
    if (want !== got) {
      problems.push(`${locale}: ${key} uses {${got}}, English uses {${want}}`)
    }
  }
  for (const key of Object.keys(messages)) {
    if (!(key in base)) problems.push(`${locale}: ${key} is not in English`)
  }
}

if (problems.length) {
  console.error(
    `Translations out of step with English:\n  ${problems.join("\n  ")}`
  )
  process.exit(1)
}
console.log(
  `Messages: ${Object.keys(base).length} keys in ${settings.locales.length} locales`
)
