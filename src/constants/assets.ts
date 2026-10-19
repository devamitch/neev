/**
 * Neev runtime asset registry
 * Includes authentic illustrations, brand icons, and core product icons.
 */

import { ProductIcons, type ProductIconName } from "./product-icons"

/** Hero, empty-state, role portraits, and trust/security artwork. */
export const AssetIllustrations = {
  // Authentic Neev Family OS Illustrations (Pure Architectural, Nature & Heirloom Artwork)
  sanctuaryHome: require("@assets/illustrations/neev_sanctuary_home.png"),
  functionsRituals: require("@assets/illustrations/neev_functions_rituals.png"),
  heirloomVault: require("@assets/illustrations/neev_heirloom_vault.png"),
  treeSanctuary: require("@assets/illustrations/neev_tree_sanctuary.png"),

  // Mapped aliases
  familyHome: require("@assets/illustrations/neev_sanctuary_home.png"),
  familySanctuary: require("@assets/illustrations/neev_tree_sanctuary.png"),
  aiGuardian: require("@assets/illustrations/neev_sanctuary_home.png"),
  schoolingKids: require("@assets/illustrations/neev_functions_rituals.png"),
  studyingStudent: require("@assets/illustrations/neev_functions_rituals.png"),
  familyGoals: require("@assets/illustrations/neev_tree_sanctuary.png"),
  privateSecurity: require("@assets/illustrations/neev_heirloom_vault.png"),
  signinHero: require("@assets/illustrations/neev_tree_sanctuary.png"),

  // Backward compatibility aliases
  empty: require("@assets/illustrations/neev_functions_rituals.png"),
  network: require("@assets/illustrations/neev_heirloom_vault.png"),
  discover: require("@assets/illustrations/neev_sanctuary_home.png"),
  security: require("@assets/illustrations/neev_heirloom_vault.png"),
  vaultLocked: require("@assets/illustrations/neev_heirloom_vault.png"),
  share: require("@assets/illustrations/neev_tree_sanctuary.png"),
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
