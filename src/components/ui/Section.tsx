import { Children, Fragment, isValidElement, type ReactNode } from "react"
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { PressableScale } from "./PressableScale"

import { useTheme } from "@/theme/useTheme"

import { AppText } from "./AppText"
import { SquircleSurface } from "./SquircleSurface"
import { Card } from "./Card"

type IoniconName = keyof typeof Ionicons.glyphMap

/* ── SectionHeader ─────────────────────────────────────────────── */

export interface SectionHeaderProps {
  title: string
  caption?: string
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}

/** Section title with an optional trailing text action ("View all"). */
export function SectionHeader({ title, caption, actionLabel, onAction, style }: SectionHeaderProps) {
  const { colors } = useTheme()
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleCol}>
        <AppText variant="h3">{title}</AppText>
        {caption ? (
          <AppText variant="caption" style={styles.sectionCaption}>
            {caption}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          hitSlop={10}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <AppText variant="label" color={colors.accentText}>
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  )
}

/* ── ListGroup / ListRow ───────────────────────────────────────── */

/** Card that stacks ListRows with inset hairline separators between them. */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  const items = Children.toArray(children).filter(isValidElement)
  return (
    <Card level={1} style={[styles.group, style]}>
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
          {child}
        </Fragment>
      ))}
    </Card>
  )
}

export interface ListRowProps {
  title: string
  subtitle?: string
  icon?: IoniconName
  /** Custom leading element (e.g. brand icon). Takes precedence over icon. */
  leading?: ReactNode
  /** Trailing value text (e.g. a setting's current state). */
  value?: string
  /** Custom trailing element (switch, badge). Replaces value + chevron. */
  trailing?: ReactNode
  onPress?: () => void
  destructive?: boolean
}

/** One row: tinted icon tile, title/subtitle that wrap, trailing value and chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  leading,
  value,
  trailing,
  onPress,
  destructive,
}: ListRowProps) {
  const { colors } = useTheme()
  const tint = destructive ? colors.error : colors.accentText

  const content = (
    <>
      {leading ? (
        <SquircleSurface
          radius={11}
          fill={destructive ? colors.errorSurface : colors.primaryAlpha}
          style={styles.rowIcon}
        >
          {leading}
        </SquircleSurface>
      ) : icon ? (
        <SquircleSurface
          radius={11}
          fill={destructive ? colors.errorSurface : colors.primaryAlpha}
          style={styles.rowIcon}
        >
          <Ionicons name={icon} size={18} color={tint} />
        </SquircleSurface>
      ) : null}
      <View style={styles.rowText}>
        <AppText variant="bodyMedium" color={destructive ? colors.error : undefined}>
          {title}
        </AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {trailing ?? (
        <View style={styles.rowTrailing}>
          {value ? (
            <AppText variant="caption" numberOfLines={1} style={styles.rowValue}>
              {value}
            </AppText>
          ) : null}
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.text.muted} /> : null}
        </View>
      )}
    </>
  )

  if (!onPress) return <View style={styles.row}>{content}</View>

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      scaleTo={0.98}
      style={styles.row}
    >
      {content}
    </PressableScale>
  )
}

/* ── Chip ──────────────────────────────────────────────────────── */

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected?: boolean
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!selected }}
      scaleTo={0.94}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface2,
        },
      ]}
    >
      <AppText variant="label" color={selected ? colors.onPrimary : colors.text.secondary}>
        {label}
      </AppText>
    </PressableScale>
  )
}

/* ── StatTile ──────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  icon,
  style,
}: {
  label: string
  value: string
  icon?: IoniconName
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useTheme()
  return (
    <Card level={1} style={[styles.stat, style]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.accentText} /> : null}
      <AppText variant="h2" numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </AppText>
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </Card>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  group: {
    padding: 0,
    paddingVertical: 4,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowIcon: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTrailing: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 4,
    maxWidth: "45%",
  },
  rowValue: {
    flexShrink: 1,
  },
  sectionCaption: {
    marginTop: 2,
  },
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 28,
  },
  sectionTitleCol: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  stat: {
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statValue: {
    marginTop: 4,
  },
})
