import React from "react"
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native"
import { useTheme } from "@/theme/useTheme"
import { AppText } from "./AppText"
import { SquircleSurface } from "./SquircleSurface"

export interface BadgeProps {
  label: string
  variant?: "primary" | "success" | "warning" | "error" | "neutral" | "secondary" | "info"
  tone?: "primary" | "success" | "warning" | "error" | "neutral" | "secondary" | "info"
  size?: "small" | "medium" | "large"
  style?: StyleProp<ViewStyle>
}

export function Badge({
  label,
  variant,
  tone = "neutral",
  size = "medium",
  style,
}: BadgeProps) {
  const { colors } = useTheme()
  const activeTone = variant || tone

  const getBg = () => {
    switch (activeTone) {
      case "primary":
        return colors.primaryAlpha
      case "success":
        return colors.successSurface
      case "warning":
        return colors.warningSurface
      case "error":
        return colors.errorSurface
      case "info":
        return colors.infoSurface
      case "secondary":
      case "neutral":
      default:
        return colors.surface2
    }
  }

  const getFg = () => {
    switch (activeTone) {
      case "primary":
        return colors.accentText
      case "success":
        return colors.success
      case "warning":
        return colors.warning
      case "error":
        return colors.error
      case "info":
        return colors.info
      case "secondary":
      case "neutral":
      default:
        return colors.text.secondary
    }
  }

  const isSmall = size === "small"

  return (
    <SquircleSurface
      radius={isSmall ? 6 : 8}
      style={[
        styles.badge,
        isSmall && styles.badgeSmall,
        { backgroundColor: getBg() },
        style,
      ]}
    >
      <AppText
        variant="caption"
        style={[
          styles.label,
          isSmall && styles.labelSmall,
          { color: getFg() },
        ]}
      >
        {label}
      </AppText>
    </SquircleSurface>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
})
