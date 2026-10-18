import { useTheme } from "@/theme/useTheme"
import type { ReactNode } from "react"
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { AppText } from "./AppText"
import { PressableScale, type PressableScaleProps } from "./PressableScale"
import { SquircleSurface } from "./SquircleSurface"

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger"
type SizeKey = "sm" | "md" | "lg"
type SizeProp = SizeKey | "small" | "medium" | "large"

export interface AppButtonProps extends Omit<
  PressableScaleProps,
  "style" | "children" | "onPress"
> {
  title: string
  variant?: Variant
  size?: SizeProp
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  icon?: ReactNode
}

const SIZE_ALIAS: Record<SizeProp, SizeKey> = {
  sm: "sm",
  small: "sm",
  md: "md",
  medium: "md",
  lg: "lg",
  large: "lg",
}

/**
 * radius: corner radius
 * scaleTo: smaller buttons give more so the movement reads the same at any width
 * hitSlop: sm is 40pt tall, so it gets padded up to the 48pt touch-target minimum
 */
const SIZES = {
  sm: { radius: 12, scaleTo: 0.95, hitSlop: 4, minHeight: 40, paddingHorizontal: 16 },
  md: { radius: 14, scaleTo: 0.97, hitSlop: 0, minHeight: 48, paddingHorizontal: 20 },
  lg: { radius: 16, scaleTo: 0.98, hitSlop: 0, minHeight: 54, paddingHorizontal: 24 },
} as const

type Colors = ReturnType<typeof useTheme>["colors"]
type Palette = { fill: string; text: string; stroke?: string }

function getPalette(variant: Variant, disabled: boolean, colors: Colors): Palette {
  if (disabled) {
    // Only solid variants get a grey slab. Ghost/outline stay see-through.
    const solid = variant === "primary" || variant === "danger" || variant === "secondary"
    return { fill: solid ? colors.surface3 : "transparent", text: colors.text.muted }
  }
  switch (variant) {
    case "primary":
      return { fill: colors.primary, text: colors.onPrimary }
    case "danger":
      return { fill: colors.error, text: colors.onPrimary }
    case "outline":
      return { fill: "transparent", text: colors.text.primary, stroke: colors.borderStrong }
    case "ghost":
      return { fill: "transparent", text: colors.accentText }
    default:
      return { fill: colors.surface2, text: colors.text.primary }
  }
}

/**
 * Button. Height is a minimum, never fixed, and the label is single-line so long
 * titles truncate instead of wrapping out of the surface.
 *
 * Loading keeps the label in layout (hidden) and overlays the spinner, so the
 * button never changes size or loses its colour when it starts loading.
 */
export function AppButton({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  icon,
  ...rest
}: AppButtonProps) {
  const { colors } = useTheme()

  const sizeKey = SIZE_ALIAS[size]
  const metrics = SIZES[sizeKey]
  const palette = getPalette(variant, disabled, colors)
  const inactive = disabled || loading

  return (
    <PressableScale
      style={style}
      disabled={inactive}
      // The button paints its own disabled look; the generic 0.45 dim would double it
      // and would also wash out the loading state.
      disabledOpacity={1}
      scaleTo={metrics.scaleTo}
      hitSlop={metrics.hitSlop}
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      {...rest}
    >
      <SquircleSurface
        radius={metrics.radius}
        smoothing={1}
        fill={palette.fill}
        stroke={palette.stroke}
        style={[
          styles.surface,
          { minHeight: metrics.minHeight, paddingHorizontal: metrics.paddingHorizontal },
        ]}
      >
        <View style={styles.content}>
          <View style={[styles.row, loading && styles.hidden]}>
            {icon}
            <AppText
              variant="button"
              numberOfLines={1}
              style={[styles.text, { color: palette.text }]}
            >
              {title}
            </AppText>
          </View>
          {loading ? (
            <View style={styles.spinner} pointerEvents="none">
              <ActivityIndicator color={palette.text} size="small" />
            </View>
          ) : null}
        </View>
      </SquircleSurface>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  surface: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    flexShrink: 1,
    justifyContent: "center",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
    justifyContent: "center",
  },
  hidden: {
    opacity: 0,
  },
  spinner: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flexShrink: 1,
    textAlign: "center",
  },
})
