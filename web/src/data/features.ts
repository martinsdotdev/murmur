/**
 * Six features for the landing page, each a title plus a one-line subtitle.
 * A card that only one of the two apps has names it in its subtitle.
 *
 * Icons come from @hugeicons/core-free-icons, the same set the app imports,
 * and each is the one the app draws on the same control.
 *
 * Text is a getter, as the sound names are: the build imports this module
 * once and renders it for every locale, so each read has to be in the
 * language of the page being rendered.
 */
import {
  ComputerIcon,
  InstallingUpdates01Icon,
  Moon02Icon,
  Share01Icon,
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
    icon: Share01Icon,
    get title() {
      return m.feature_save_title()
    },
    get sub() {
      return m.feature_save_sub()
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
    icon: Moon02Icon,
    get title() {
      return m.feature_timer_title()
    },
    get sub() {
      return m.feature_timer_sub()
    },
  },
  {
    icon: InstallingUpdates01Icon,
    get title() {
      return m.feature_offline_title()
    },
    get sub() {
      return m.feature_offline_sub()
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
]
