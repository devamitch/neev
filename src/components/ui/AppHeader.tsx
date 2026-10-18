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
    <View>
      {eyebrow ? (
        <AppText variant="overline" color={colors.accentText} style={styles.eyebrow}>
          {eyebrow}
        </AppText>
      ) : null}
      <AppText variant="h1" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color={colors.text.secondary} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  )
}

/**
 * Static large-title header for places outside `ScreenContainer`. Toolbar row
 * (back on the left, actions on the right) above a full-width large title.
 */
export function AppHeader({
  title,
  subtitle,
  eyebrow,
  showBack = false,
  rightAction,
  style,
}: AppHeaderProps) {
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
    marginBottom: 20,
    paddingTop: 10,
  },
  eyebrow: {
    marginBottom: 6,
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
  },
  subtitle: {
    marginTop: 6,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    height: HEADER_BAR_HEIGHT,
    justifyContent: "space-between",
    marginBottom: 4,
  },
})
