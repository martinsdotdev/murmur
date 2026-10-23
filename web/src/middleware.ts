import { defineMiddleware } from "astro:middleware"
import { setLocale } from "@/paraglide/runtime.js"
import { localeFromPath } from "@/lib/i18n"

// The SSG recipe from Paraglide's docs. Pages prerender one at a time, so the
// module-level locale this sets cannot leak into another page mid-render.
export const onRequest = defineMiddleware((context, next) => {
  setLocale(localeFromPath(context.url.pathname))
  return next()
})
