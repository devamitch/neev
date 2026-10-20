import React, { type ReactNode } from "react"
import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/theme/useTheme"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { AppText } from "./AppText"
import { HeaderBackButton } from "./AppHeader"
import { useScreenScrollContext } from "./ScreenScrollContext"

const clamp = Extrapolation.CLAMP

export interface SanctuaryHeaderProps {
  /** Screen or section title */
  title: string
  /** Category or domain eyebrow (e.g. 'FAMILY SANCTUARY', 'TIMELINE & RITUALS', 'ANCESTRAL REALM') */
  eyebrow?: string
  /** Subtitle or motto */
  subtitle?: string
  /** Whether to show back button (defaults to false) */
  showBack?: boolean
  /** Whether to show the living Neev mascot companion (defaults to true on root tabs) */
  showMascot?: boolean
  /** Custom mascot size (default 36) */
  mascotSize?: number
  /** Right action element(s) */
  rightAction?: ReactNode
  /** Variant: 'standard' | 'compact' | 'child' */
  variant?: "standard" | "compact" | "child"
  /** Whether to animate transition on scroll (defaults to true) */
  collapsible?: boolean
  /** Custom style */
  style?: StyleProp<ViewStyle>
  /** Custom title style */
  titleStyle?: StyleProp<TextStyle>
}

/**
 * Universal Apple-Style Sanctuary Header for Neev
 *
 * Implements the authentic Apple Human Interface Guidelines:
 * - At Rest (Before scroll): The pinned bar displays the prominent terracotta eyebrow
 *   (e.g. "FAMILY SANCTUARY") beside the living Neev mascot, while the grand large title
 *   sits comfortably at the top of the scrollable content.
 * - On Scroll: The eyebrow gently translates up and fades away, while the compact sanctuary
 *   title smoothly slides into the pinned bar in its place.
 * - Flat, clean aesthetic: Strictly ZERO shadows, ZERO elevation halos, ZERO scale/zoom distortions.
 * - Solid porcelain ivory backdrop (#FAFBF9) guarantees zero bleed from scrolled cards.
 */
export function SanctuaryHeader({
  title,
  eyebrow,
  subtitle,
  showBack = false,
  showMascot = true,
  mascotSize = 36,
  rightAction,
  variant = "standard",
  collapsible = true,
  style,
  titleStyle,
}: SanctuaryHeaderProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const scrollContext = useScreenScrollContext()
  const scrollY = scrollContext?.scrollY

  const isChild = variant === "child" || showBack
  const isCompact = variant === "compact"
  const canAnimate = collapsible && !isCompact && !isChild && Boolean(scrollY) && Boolean(eyebrow)

  // Eyebrow displays prominently before scroll, slides up and fades out smoothly on scroll
  const animatedEyebrow = useAnimatedStyle(() => {
    if (!canAnimate || !scrollY) {
      return { opacity: 1, transform: [{ translateY: 0 }] }
    }
    const y = scrollY.value
    return {
      opacity: interpolate(y, [15, 70], [1, 0], clamp),
      transform: [{ translateY: interpolate(y, [15, 70], [0, -10], clamp) }],
    }
  })

  // Compact Title smoothly slides up into the bar as large title scrolls past
  const animatedTitle = useAnimatedStyle(() => {
    if (!canAnimate || !scrollY) {
      return { opacity: isChild || isCompact ? 1 : 0, transform: [{ translateY: 0 }] }
    }
    const y = scrollY.value
    return {
      opacity: interpolate(y, [35, 85], [0, 1], clamp),
      transform: [{ translateY: interpolate(y, [35, 85], [10, 0], clamp) }],
    }
  })

  // Hairline bottom border fades in cleanly as content passes underneath
  const animatedHairline = useAnimatedStyle(() => {
    if (!canAnimate || !scrollY) {
      return { opacity: 0.3 }
    }
    const y = scrollY.value
    return {
      opacity: interpolate(y, [10, 45], [0, 1], clamp),
    }
  })

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 8) + 4,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {/* ── Left Anchor: Living Mascot or Back Button ── */}
        <View style={styles.leftAnchor}>
          {isChild ? (
            <HeaderBackButton />
          ) : showMascot ? (
            <NeevLogoIcon
              size={mascotSize}
              withBackground
              playful
              interactive
            />
          ) : null}
        </View>

        {/* ── Center/Left Title Track (Eyebrow -> Title on Scroll) ── */}
        <View style={styles.centerTrack}>
          {/* Eyebrow: Visible at Rest */}
          {eyebrow && !isChild && !isCompact ? (
            <Animated.View style={[styles.eyebrowContainer, animatedEyebrow]}>
              <AppText
                variant="overline"
                color={colors.accentText}
                numberOfLines={1}
                style={styles.eyebrowText}
              >
                {eyebrow.toUpperCase()}
              </AppText>
            </Animated.View>
          ) : null}

          {/* Title: Fades in on scroll (or static on child screens) */}
          <Animated.View
            style={[
              styles.titleContainer,
              isChild || isCompact ? styles.staticTitle : animatedTitle,
            ]}
          >
            <AppText
              variant="h3"
              numberOfLines={1}
              style={[
                styles.barTitleText,
                { color: colors.text.primary },
                titleStyle,
              ]}
              accessibilityRole="header"
            >
              {title}
            </AppText>
          </Animated.View>
        </View>

        {/* ── Right Actions: Toolbar buttons (menu, search, settings) ── */}
        {rightAction ? (
          <View style={styles.rightActions}>
            {rightAction}
          </View>
        ) : isChild ? (
          <View style={styles.rightSpacer} />
        ) : null}
      </View>

      {/* ── Flat Hairline Bottom Border (Zero shadows) ── */}
      <Animated.View
        style={[
          styles.hairline,
          { backgroundColor: colors.border },
          animatedHairline,
        ]}
      />
    </View>
  )
}

/**
 * Large Title Component to render at the top of scrollable content (ScrollView or FlatList)
 * Displays the distinctive, attractive family sanctuary name & motto with Apple typography.
 */
export function SanctuaryLargeTitle({
  title,
  subtitle,
  style,
}: {
  title: string
  subtitle?: string
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useTheme()

  return (
    <View style={[styles.largeTitleBlock, style]}>
      <AppText
        variant="h1"
        numberOfLines={2}
        style={[styles.grandTitleText, { color: colors.text.primary }]}
      >
        {title}
      </AppText>
      {subtitle ? (
        <AppText
          variant="body"
          style={[styles.grandSubtitleText, { color: colors.text.secondary }]}
          numberOfLines={2}
        >
          {subtitle}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    // Strictly zero shadows or elevation per iOS Human Interface Guidelines
    elevation: 0,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    width: "100%",
    zIndex: 25,
  },
  contentRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 50,
    paddingHorizontal: 16,
    width: "100%",
  },
  leftAnchor: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    minHeight: 38,
    minWidth: 38,
    zIndex: 2,
  },
  centerTrack: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    minWidth: 0,
    paddingRight: 6,
    position: "relative",
  },
  eyebrowContainer: {
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  eyebrowText: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14.5,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  titleContainer: {
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  staticTitle: {
    position: "relative",
  },
  barTitleText: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  rightActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    minHeight: 38,
    zIndex: 2,
  },
  rightSpacer: {
    minHeight: 38,
    minWidth: 38,
  },
  hairline: {
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: "absolute",
    right: 0,
  },

  // ── Large Title in Scrollable Area ──
  largeTitleBlock: {
    paddingBottom: 16,
    paddingTop: 8,
    width: "100%",
  },
  grandTitleText: {
    fontFamily: "Fraunces-Variable",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  grandSubtitleText: {
    fontFamily: "Geist-Regular",
    fontSize: 13.5,
    letterSpacing: -0.1,
    lineHeight: 19,
    marginTop: 5,
  },
})

export default SanctuaryHeader
