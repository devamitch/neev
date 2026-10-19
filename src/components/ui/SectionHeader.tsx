import React from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { AppText } from "./AppText"
import { useColors } from "@/theme/useTheme"

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Standard Sanctuary Section Header:
 * - Production-grade typography and alignment
 * - Prevents title wrapping / action button squishing
 * - Clean vertical rhythm
 */
export function SectionHeader({ title, subtitle, action, style }: SectionHeaderProps) {
  const colors = useColors()

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textContainer}>
        <AppText variant="subheading" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" style={[styles.subtitle, { color: colors.text.muted }]} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action ? <View style={styles.actionContainer}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  actionContainer: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
})
