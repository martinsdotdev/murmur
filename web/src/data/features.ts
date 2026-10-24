/**
 * Six features for the landing page. The redesign gives each a title plus a
 * one-line subtitle (the earlier title-only rows grew a hint line).
 *
 * Icons come from @hugeicons/core-free-icons, the same set the app imports, so
 * the two halves of the site draw from one vocabulary.
 *
 * Text is a getter, as the sound names are: the build imports this module
 * once and renders it for every locale, so each read has to be in the
 * language of the page being rendered.
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
  readonly title: string
  readonly sub: string
}

export const features: Feature[] = [
  {
    icon: SlidersVerticalIcon,
    get title() {
      return m.feature_layer_title()
    },
    get sub() {
      return m.feature_layer_sub()
    },
  },
  {
    icon: Bookmark01Icon,
    get title() {
      return m.feature_presets_title()
    },
    get sub() {
      return m.feature_presets_sub()
    },
  },
  {
    icon: Upload04Icon,
    get title() {
      return m.feature_import_title()
    },
    get sub() {
      return m.feature_import_sub()
    },
  },
  {
    icon: ComputerIcon,
    get title() {
      return m.feature_tray_title()
    },
    get sub() {
      return m.feature_tray_sub()
    },
  },
  {
    icon: ContrastIcon,
    get title() {
      return m.feature_theme_title()
    },
    get sub() {
      return m.feature_theme_sub()
    },
  },
  {
    icon: FavouriteIcon,
    get title() {
      return m.feature_free_title()
    },
    get sub() {
      return m.feature_free_sub()
    },
  },
]
