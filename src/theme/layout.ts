import { useWindowDimensions } from "react-native"

/** Horizontal page gutter on phones. */
export const GUTTER = 20
/** Widest reading column on tablets and foldables (content stays centred). */
export const MAX_CONTENT_WIDTH = 720

export type SizeClass = "compact" | "medium" | "expanded"

/**
 * Screen-size facts every layout should use instead of hard-coded widths.
 * compact < 600 dp (phones), medium 600–839 (small tablets, unfolded
 * foldables), expanded ≥ 840 (large tablets). Uses the shortest side for the
 * phone/tablet decision so it doesn't flip with orientation.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions()
  const shortest = Math.min(width, height)
  const sizeClass: SizeClass = width >= 840 ? "expanded" : width >= 600 ? "medium" : "compact"
  const isTablet = shortest >= 600
  const gutter = isTablet ? 32 : width < 360 ? 16 : GUTTER
  const columnWidth = Math.min(width, MAX_CONTENT_WIDTH + gutter * 2)
  /** Distance from the screen edge to content, so headers line up with the column. */
  const sideInset = (width - columnWidth) / 2 + gutter
  return { width, height, sizeClass, isTablet, gutter, columnWidth, sideInset }
}
