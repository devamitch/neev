/**
 * Neev runtime asset registry
 * Includes authentic illustrations, brand icons, and core product icons.
 */

import { ProductIcons, type ProductIconName } from "./product-icons"

/** Hero, empty-state, role portraits, and trust/security artwork. */
export const AssetIllustrations = {
  // Authentic Neev Family OS Illustrations
  familyHome: require("@assets/illustrations/neev_real_home.png"),
  familySanctuary: require("@assets/illustrations/neev_real_connection.png"),
  aiGuardian: require("@assets/illustrations/neev_real_guardian.png"),
  schoolingKids: require("@assets/illustrations/neev_schooling_kids.png"),
  studyingStudent: require("@assets/illustrations/neev_studying_student.png"),
  heirloomVault: require("@assets/illustrations/neev_vault.png"),
  familyGoals: require("@assets/illustrations/neev_real_goals.png"),
  privateSecurity: require("@assets/illustrations/neev_real_security.png"),
  roleChild: require("@assets/illustrations/neev_role_child.png"),
  roleElder: require("@assets/illustrations/neev_role_elder.png"),
  roleFather: require("@assets/illustrations/neev_role_father.png"),
  roleMother: require("@assets/illustrations/neev_role_mother.png"),
  signinHero: require("@assets/illustrations/neev_signin_family_1774253718340.png"),

  // Backward compatibility aliases
  empty: require("@assets/illustrations/neev_schooling_kids.png"),
  network: require("@assets/illustrations/neev_vault.png"),
  discover: require("@assets/illustrations/neev_real_home.png"),
  security: require("@assets/illustrations/neev_real_security.png"),
  vaultLocked: require("@assets/illustrations/neev_vault.png"),
  share: require("@assets/illustrations/neev_real_connection.png"),
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
