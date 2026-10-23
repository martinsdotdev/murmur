# Translations

One file per language, in the [inlang message format](https://inlang.com/m/reootnfj/plugin-inlang-messageFormat). `en.json` is the source; the others follow its keys exactly. Paraglide compiles them into typed functions in `src/paraglide/` at build time.

| File         | Language            | Reviewed by a native speaker |
| ------------ | ------------------- | ---------------------------- |
| `en.json`    | English             | Source                       |
| `pt-BR.json` | Portuguese (Brazil) | Not yet                      |
| `es.json`    | Spanish             | Not yet                      |
| `ja.json`    | Japanese            | Not yet                      |

The three translations were written alongside the English and have not been checked by a native speaker. Corrections are welcome as pull requests.

## Adding or changing a message

1. Add the key to `en.json`, then to every other file.
2. Run `pnpm run messages`. It fails when a file is missing a key, has one English doesn't, or uses different placeholders. The build runs it too.

Placeholders are `{name}`. Counts use a plural selector, with the categories the language has in [`Intl.PluralRules`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules): `one` and `other` in English, Portuguese and Spanish, and `other` alone in Japanese.

```json
"sounds_count": [
  {
    "declarations": ["input count", "local countPlural = count: plural"],
    "selectors": ["countPlural"],
    "match": {
      "countPlural=one": "{count} sound",
      "countPlural=other": "{count} sounds"
    }
  }
]
```

## Adding a language

Add its tag to `locales` in `project.inlang/settings.json` and its name, in that language, to `LOCALE_NAMES` in `src/lib/i18n.ts`. Then copy `en.json` to `<tag>.json` and translate it. The landing page gets a copy at `/<tag in lowercase>`. Add the same path to the sitemap's `i18n.locales` in `astro.config.mjs`.
