import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React from "react"
import {
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import { PressableScale } from "./PressableScale"

import { useTheme } from "@/theme/useTheme"

import { BlurView } from "expo-blur"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { AppText } from "./AppText"

export interface AppHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  showBack?: boolean
  logo?: React.ReactNode | ImageSourcePropType | boolean | string
  showLogo?: boolean
  rightAction?: React.ReactNode
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
  /**
   * Kept for call-site compatibility. Inside `ScreenContainer` every AppHeader
   * becomes the collapsing large-title header (see CollapsingHeader).
   */
  sticky?: boolean
  /** Compact presentation mode where title and right actions share the same single 52pt bar */
  compact?: boolean
  /** Presentation variant: 'compact' (single row) or 'large' (stacked large title) */
  variant?: "compact" | "large"
}

/** Toolbar row height shared by the static and the collapsing header. */
export const HEADER_BAR_HEIGHT = 52
export const HEADER_BUTTON_SIZE = 40


/** Round squircle toolbar button; the back control and every `rightAction` share it. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  iconSize = 20,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  iconSize?: number
}) {
  const { colors } = useTheme()

  return (
    <PressableScale
      onPress={() => {
        onPress()
      }}
      hitSlop={8}
      scaleTo={0.92}
      style={[
        styles.iconButton,
        {
          overflow: "hidden",
          backgroundColor: colors.surface2,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <BlurView tint="extraLight" intensity={20} style={StyleSheet.absoluteFill} />
      <Ionicons name={icon} size={iconSize} color={colors.text.primary} />
    </PressableScale>
  )
}

/** Back control: pops the stack, or returns Home when there's nothing to pop. */
export function HeaderBackButton() {
  const router = useRouter()
  return (
    <HeaderIconButton
      icon="chevron-back"
      iconSize={21}
      label="Go back"
      onPress={() => {
        if (router.canGoBack()) router.back()
        else router.replace("/(app)/(tabs)/dashboard")
      }}
    />
  )
}

/** Eyebrow, large title and subtitle block. */
export function HeaderLargeTitle({
  eyebrow,
  title,
  subtitle,
}: Pick<AppHeaderProps, "eyebrow" | "title" | "subtitle">) {
  const { colors } = useTheme()
  return (
    <View style={styles.largeTitleBlock}>
      {eyebrow ? (
        <AppText variant="overline" color={colors.accentText} style={styles.eyebrow}>
          {eyebrow.toUpperCase()}
        </AppText>
      ) : null}
      <AppText variant="h1" style={styles.titleText} accessibilityRole="header" numberOfLines={2}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" color={colors.text.secondary} numberOfLines={2} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  )
}

/**
 * Universal app header.
 * - In compact mode (default or `variant="compact"`): Back button, title, and right
 *   action icons share the same single-row space (52pt) with zero vertical waste.
 * - In large mode (`variant="large"`): Top action row with full-width large title below.
 */
export function AppHeader({
  title,
  subtitle,
  eyebrow,
  showBack = false,
  showLogo = false,
  rightAction,
  style,
  titleStyle,
  compact,
  variant,
}: AppHeaderProps) {
  const { colors } = useTheme()
  const isCompact = compact ?? (variant === "compact" || (variant !== "large" && !eyebrow))

  if (isCompact) {
    const hasLeftElement = showBack || showLogo !== false
    return (
      <View style={[styles.compactToolbar, style]}>
        {hasLeftElement ? (
          <View style={styles.left}>
            {showBack ? (
              <HeaderBackButton />
            ) : showLogo !== false ? (
              <NeevLogoIcon size={32} withBackground playful interactive />
            ) : null}
          </View>
        ) : null}

        <View style={[styles.compactCenter, !hasLeftElement && { alignItems: "flex-start", paddingHorizontal: 0 }]}>
          {eyebrow ? (
            <AppText
              variant="overline"
              color={colors.accentText}
              numberOfLines={1}
              style={styles.compactEyebrow}
            >
              {eyebrow}
            </AppText>
          ) : null}
          <AppText
            variant="h3"
            numberOfLines={1}
            style={[styles.compactTitle, !hasLeftElement && { textAlign: "left" }, titleStyle]}
            accessibilityRole="header"
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="caption"
              color={colors.text.secondary}
              numberOfLines={1}
              style={styles.compactSubtitle}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
      </View>
    )
  }

  const hasLeft = showBack || showLogo !== false
  return (
    <View style={[styles.container, style]}>
      {hasLeft || rightAction ? (
        <View style={[styles.toolbar, !hasLeft && { justifyContent: "flex-end" }]}>
          {showBack ? (
            <HeaderBackButton />
          ) : showLogo !== false ? (
            <NeevLogoIcon size={32} withBackground playful interactive />
          ) : null}
          {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
        </View>
      ) : null}
      <HeaderLargeTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    paddingTop: 4,
  },
  compactToolbar: {
    alignItems: "center",
    flexDirection: "row",
    height: HEADER_BAR_HEIGHT,
    justifyContent: "space-between",
    minHeight: HEADER_BAR_HEIGHT,
    width: "100%",
  },
  left: {
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: HEADER_BUTTON_SIZE,
  },
  compactCenter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  compactTitle: {
    fontFamily: "spaceGroteskSemiBold",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  compactEyebrow: {
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  compactSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  largeTitleBlock: {
    paddingVertical: 4,
    width: "100%",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  titleText: {
    fontFamily: "spaceGroteskBold",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 13,
    height: HEADER_BUTTON_SIZE,
    justifyContent: "center",
    width: HEADER_BUTTON_SIZE,
  },
  right: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    minWidth: HEADER_BUTTON_SIZE,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 4,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    height: HEADER_BAR_HEIGHT,
    justifyContent: "space-between",
    marginBottom: 2,
  },
})

