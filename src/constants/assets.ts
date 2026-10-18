/**
 * BlinkQuest runtime asset registry
 * Includes illustrations, brand icons, and core product icons.
 */

import { ProductIcons, type ProductIconName } from "./product-icons"

/** Hero, empty-state, and trust/security artwork. */
export const AssetIllustrations = {
  empty: require("@assets/illustrations/radar-empty.webp"),
  network: require("@assets/illustrations/setu-network.webp"),
  discover: require("@assets/illustrations/nearby-discover.webp"),
  security: require("@assets/illustrations/security.webp"),
  vaultLocked: require("@assets/illustrations/vault-locked.webp"),
  share: require("@assets/illustrations/share.webp"),
} as const

export type AssetIllustrationsName = keyof typeof AssetIllustrations

export const AssetAnimations = {
  splashLogo: require("@assets/animations/splash-logo.json"),
} as const

export const Assets = {
  brand: {
    logo: require("@assets/images/logo.png"),
    appIcon: require("@assets/images/app-icon-all.png"),
  },
  animations: AssetAnimations,
  illustrations: AssetIllustrations,
  icons: ProductIcons,
} as const

export const AssetIcons = ProductIcons
export type AssetIconsName = ProductIconName
