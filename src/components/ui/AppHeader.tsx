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


/** Round toolbar button; the back control and every `rightAction` share it. */
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
      hitSlop={6}
      scaleTo={0.92}
      style={[
        styles.iconButton,
        { overflow: "hidden", backgroundColor: colors.surface2 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <BlurView tint="extraLight" intensity={10} style={StyleSheet.absoluteFill} />
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
      iconSize={22}
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
          {eyebrow}
        </AppText>
      ) : null}
      <AppText variant="h2" style={styles.titleText} accessibilityRole="header" numberOfLines={1}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" color={colors.text.secondary} numberOfLines={1} style={styles.subtitle}>
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
    return (
      <View style={[styles.compactToolbar, style]}>
        <View style={styles.left}>
          {showBack ? (
            <HeaderBackButton />
          ) : showLogo ? (
            <NeevLogoIcon size={24} withBackground={false} />
          ) : (
            <View style={{ width: 4 }} />
          )}
        </View>

        <View style={styles.compactCenter}>
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
            style={[styles.compactTitle, titleStyle]}
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

        <View style={styles.right}>{rightAction}</View>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      {showBack || rightAction ? (
        <View style={styles.toolbar}>
          {showBack ? <HeaderBackButton /> : <View />}
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
    paddingVertical: 2,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  titleText: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: HEADER_BUTTON_SIZE / 2,
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
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    height: HEADER_BAR_HEIGHT,
    justifyContent: "space-between",
    marginBottom: 2,
  },
})

