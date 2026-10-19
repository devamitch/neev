/**
 * Neev Canonical Colour Tokens:
 * Grounded in the tranquil wisdom of ancient Indian and Asian family sanctuaries.
 * Evokes sage leaves, serene lotus petals, warm porcelain, and quiet depth.
 */

export type ColorScheme = "light" | "dark"

export interface ThemeColors {
  scheme: ColorScheme
  background: string
  surface: string
  surface1: string
  surface2: string
  surface3: string
  /** Translucent surface for sheets, dialogs, overlays over blur */
  surfaceGlass: string
  text: {
    primary: string
    secondary: string
    muted: string
  }
  /** Sage forest / lotus primary for fills, buttons, and active indicators. */
  primary: string
  /** Ink for text and icons on `primary` fill. */
  onPrimary: string
  /** Low-alpha tint for chips and icon tiles. */
  primaryAlpha: string
  /** Accent that is readable as text/icon colour on neutral surfaces. */
  accentText: string
  /** Hairline borders. */
  border: string
  borderStrong: string
  success: string
  warning: string
  info: string
  error: string
  successSurface: string
  warningSurface: string
  infoSurface: string
  errorSurface: string
  /** Full-screen dimming behind sheets and dialogs. */
  scrim: string
  /** Always-dark backdrop for camera, video and fullscreen viewer. */
  media: string
  /** Text and icons drawn over `media` and photos. */
  onMedia: string
  /** Darkened translucent chip drawn over photos and video. */
  mediaChip: string
  /** Fill for raised actions with gradient. */
  primaryGradient: readonly [string, string, ...string[]]
  /** Vivid tone for raised action orb. */
  primaryVivid: string
  /** Pure white for gloss highlights drawn over fill. */
  gloss: string
  actionTints: { camera: string; share: string; emergency: string }
  shadow: string
  avatarTones: { bg: string; fg: string }[]
}

export const lightColors: ThemeColors = {
  scheme: "light",
  background: "#FBFDF9",
  surface: "#FFFFFF",
  surface1: "#FFFFFF",
  surface2: "#F0F5EC",
  surface3: "#E2ECDC",
  surfaceGlass: "rgba(255, 255, 255, 0.92)",
  text: {
    primary: "#1E271A",
    secondary: "#485642",
    muted: "#6E7E68",
  },
  primary: "#709758",
  onPrimary: "#FFFFFF",
  primaryAlpha: "rgba(112, 151, 88, 0.12)",
  primaryGradient: ["#709758", "#709758", "#709758"],
  primaryVivid: "#709758",
  gloss: "#FFFFFF",
  actionTints: { camera: "#709758", share: "#588D6A", emergency: "#BE3434" },
  accentText: "#54773F",
  border: "rgba(30, 39, 26, 0.08)",
  borderStrong: "rgba(30, 39, 26, 0.16)",
  success: "#5A8B49",
  warning: "#C27835",
  info: "#709758",
  error: "#BE3434",
  successSurface: "rgba(90, 139, 73, 0.12)",
  warningSurface: "rgba(194, 120, 53, 0.10)",
  infoSurface: "rgba(112, 151, 88, 0.10)",
  errorSurface: "rgba(190, 52, 52, 0.08)",
  scrim: "rgba(20, 26, 17, 0.45)",
  media: "#1B2218",
  onMedia: "#FFFFFF",
  mediaChip: "rgba(27, 34, 24, 0.70)",
  shadow: "transparent",
  avatarTones: [
    { bg: "#DCE7D4", fg: "#1E271A" },
    { bg: "#E8E0D2", fg: "#1E271A" },
    { bg: "#DCE5E0", fg: "#1E271A" },
    { bg: "#E5EDDE", fg: "#1E271A" },
    { bg: "#E8D8DB", fg: "#1E271A" },
    { bg: "#D8E2D2", fg: "#1E271A" },
  ],
}

export const darkColors: ThemeColors = {
  scheme: "dark",
  background: "#121710",
  surface: "#1A2217",
  surface1: "#1A2217",
  surface2: "#232D20",
  surface3: "#2E3A2A",
  surfaceGlass: "rgba(26, 34, 23, 0.88)",
  text: {
    primary: "#F3F7F0",
    secondary: "#B8C6B2",
    muted: "#889882",
  },
  primary: "#8EB574",
  onPrimary: "#121710",
  primaryAlpha: "rgba(142, 181, 116, 0.18)",
  primaryGradient: ["#8EB574", "#8EB574", "#8EB574"],
  primaryVivid: "#8EB574",
  gloss: "#FFFFFF",
  actionTints: { camera: "#8EB574", share: "#68AFA0", emergency: "#F59A92" },
  accentText: "#A6CE8D",
  border: "rgba(243, 247, 240, 0.10)",
  borderStrong: "rgba(243, 247, 240, 0.20)",
  success: "#65B854",
  warning: "#E0A458",
  info: "#8EB574",
  error: "#F59A92",
  successSurface: "rgba(101, 184, 84, 0.14)",
  warningSurface: "rgba(224, 164, 88, 0.14)",
  infoSurface: "rgba(142, 181, 116, 0.14)",
  errorSurface: "rgba(245, 154, 146, 0.14)",
  scrim: "rgba(0, 0, 0, 0.65)",
  media: "#000000",
  onMedia: "#FFFFFF",
  mediaChip: "rgba(0, 0, 0, 0.60)",
  shadow: "transparent",
  avatarTones: [
    { bg: "#36453B", fg: "#F2F6F3" },
    { bg: "#4A3E33", fg: "#F2F6F3" },
    { bg: "#3E3447", fg: "#F2F6F3" },
    { bg: "#334542", fg: "#F2F6F3" },
    { bg: "#473437", fg: "#F2F6F3" },
    { bg: "#424733", fg: "#F2F6F3" },
  ],
}

export const colorsFor = (scheme: ColorScheme): ThemeColors =>
  scheme === "dark" ? darkColors : lightColors

export const setuColors = {
  ...lightColors,
  canvas: lightColors.background,
  primaryInk: lightColors.text.primary,
  secondaryInk: lightColors.text.secondary,
  mutedInk: lightColors.text.muted,
}

export const FeedbackGradients = {
  success: ["#4E7A4C", "#3B6139"] as const,
  warning: ["#C27835", "#9A5D24"] as const,
  error: ["#BE3434", "#962424"] as const,
  info: ["#5A7A64", "#435C4A"] as const,
}
