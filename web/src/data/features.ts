/**
 * Six features for the landing page. The redesign gives each a title plus a
 * one-line subtitle (the earlier title-only rows grew a hint line).
 *
 * Icons come from @hugeicons/core-free-icons, the same set the app imports, so
 * the two halves of the site draw from one vocabulary.
 *
 * Text is read through the message functions at render, not stored: the build
 * imports this module once and renders it for every locale.
 */
import {
  Bookmark01Icon,
  ComputerIcon,
  ContrastIcon,
  FavouriteIcon,
  SlidersVerticalIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { m } from "@/paraglide/messages.js"

export interface Feature {
  icon: IconSvgElement
  title: () => string
  sub: () => string
}

export const features: Feature[] = [
  {
    icon: SlidersVerticalIcon,
    title: m.feature_layer_title,
    sub: m.feature_layer_sub,
  },
  {
    icon: Bookmark01Icon,
    title: m.feature_presets_title,
    sub: m.feature_presets_sub,
  },
  {
    icon: Upload04Icon,
    title: m.feature_import_title,
    sub: m.feature_import_sub,
  },
  {
    icon: ComputerIcon,
    title: m.feature_tray_title,
    sub: m.feature_tray_sub,
  },
  {
    icon: ContrastIcon,
    title: m.feature_theme_title,
    sub: m.feature_theme_sub,
  },
  {
    icon: FavouriteIcon,
    title: m.feature_free_title,
    sub: m.feature_free_sub,
  },
]
