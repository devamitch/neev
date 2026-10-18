/**
 * Registered colors for content drawn over the live camera feed (the
 * scanner's chrome, the eye-alert banner, the scanner status pill). The app
 * is light-mode only, so `useTheme()` never returns colors meant to sit on a
 * near-black glass scrim over video — these are the one place that palette
 * lives, instead of being copied as loose hex literals per component.
 */
export const ON_GLASS = "#FFFFFF"
export const ON_GLASS_MUTED = "rgba(255, 255, 255, 0.72)"

export const GLASS_SEVERITY = {
  info: "#9BD39A",
  warning: "#F2C46D",
  critical: "#F28B82",
} as const

export const GLASS_SCRIM = "rgba(20, 18, 16, 0.82)"
