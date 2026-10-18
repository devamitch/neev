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
  background: "#FAF9F6",
  surface: "#FFFFFF",
  surface1: "#FFFFFF",
  surface2: "#F1F5F2",
  surface3: "#E0ECE4",
  surfaceGlass: "rgba(255, 255, 255, 0.90)",
  text: {
    primary: "#232A26",
    secondary: "#525E56",
    muted: "#76837A",
  },
  primary: "#5A7A64",
  onPrimary: "#FFFFFF",
  primaryAlpha: "rgba(90, 122, 100, 0.12)",
  primaryGradient: ["#769980", "#5A7A64", "#435C4A"],
  primaryVivid: "#5A7A64",
  gloss: "#FFFFFF",
  actionTints: { camera: "#5A7A64", share: "#4E8C7A", emergency: "#BE3434" },
  accentText: "#45624E",
  border: "rgba(35, 42, 38, 0.08)",
  borderStrong: "rgba(35, 42, 38, 0.16)",
  success: "#4E7A4C",
  warning: "#C27835",
  info: "#5A7A64",
  error: "#BE3434",
  successSurface: "rgba(78, 122, 76, 0.12)",
  warningSurface: "rgba(194, 120, 53, 0.10)",
  infoSurface: "rgba(90, 122, 100, 0.10)",
  errorSurface: "rgba(190, 52, 52, 0.08)",
  scrim: "rgba(23, 28, 25, 0.45)",
  media: "#1B221E",
  onMedia: "#FFFFFF",
  mediaChip: "rgba(27, 34, 30, 0.70)",
  shadow: "transparent",
  avatarTones: [
    { bg: "#D5E3D8", fg: "#232A26" },
    { bg: "#E8D8C8", fg: "#232A26" },
    { bg: "#DCD0E6", fg: "#232A26" },
    { bg: "#CBE4DE", fg: "#232A26" },
    { bg: "#E6D0D4", fg: "#232A26" },
    { bg: "#E0E3D5", fg: "#232A26" },
  ],
}

export const darkColors: ThemeColors = {
  scheme: "dark",
  background: "#101613",
  surface: "#18201C",
  surface1: "#18201C",
  surface2: "#222C27",
  surface3: "#2E3A33",
  surfaceGlass: "rgba(24, 32, 28, 0.85)",
  text: {
    primary: "#F2F6F3",
    secondary: "#B8C4BC",
    muted: "#8A998F",
  },
  primary: "#799C83",
  onPrimary: "#101613",
  primaryAlpha: "rgba(121, 156, 131, 0.18)",
  primaryGradient: ["#92B59C", "#799C83", "#55755E"],
  primaryVivid: "#89AD93",
  gloss: "#FFFFFF",
  actionTints: { camera: "#89AD93", share: "#68AFA0", emergency: "#F59A92" },
  accentText: "#A0C4AB",
  border: "rgba(242, 246, 243, 0.10)",
  borderStrong: "rgba(242, 246, 243, 0.20)",
  success: "#5DBE8A",
  warning: "#E0A458",
  info: "#799C83",
  error: "#F59A92",
  successSurface: "rgba(93, 190, 138, 0.14)",
  warningSurface: "rgba(224, 164, 88, 0.14)",
  infoSurface: "rgba(121, 156, 131, 0.14)",
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
