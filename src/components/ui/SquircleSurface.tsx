/**
 * Squircle-shaped surface.
 *
 * It is ONE plain View. The squircle is painted behind the children (Skia-free SVG path, or the
 * native Android view), and every style key you pass - padding, gap, alignItems, justifyContent,
 * flexDirection, minHeight, width, height, flex - lands on that same View, so layout behaves
 * exactly like a normal `View`.
 *
 * Do not split `style` across an outer and an inner view. That is what used to leave icons,
 * button labels and chip text stuck at the top-left: `minHeight` / `height` went to the outer
 * view while `alignItems` / `justifyContent` went to an inner view that never grew to fill it,
 * so there was nothing to centre within.
 */
import { squirclePath, squircleRadius } from "@/theme/squirclePath"
import { useColors } from "@/theme/useTheme"
import { requireNativeView } from "expo"
import { memo, useCallback, useMemo, useState, type ComponentType, type ReactNode } from "react"
import {
  Platform,
  processColor,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native"
import Svg, { G, Path } from "react-native-svg"

export type SquircleShape = "squircle" | "rounded" | "pill" | "circle"

type NativeSquircleProps = ViewProps & {
  squircleBackgroundColor?: number | null
  squircleBorderColor?: number | null
  squircleHighlightColor?: number | null
  squircleAccentColor?: number | null
  squircleBorderWidth?: number | null
  squircleRadius?: number | null
  topLeftRadius?: number | null
  topRightRadius?: number | null
  bottomRightRadius?: number | null
  bottomLeftRadius?: number | null
  cornerSmoothing?: number | null
  preserveSmoothing?: boolean | null
  shape?: SquircleShape | null
  clipContent?: boolean | null
}

let NativeSquircleView: ComponentType<NativeSquircleProps> | null = null
if (Platform.OS === "android") {
  try {
    NativeSquircleView = requireNativeView<NativeSquircleProps>("ExpoSquircleView")
  } catch {
    NativeSquircleView = null
  }
}

export interface SquircleSurfaceProps extends ViewProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  radius?: number
  smoothing?: number
  /** Overrides `style.backgroundColor`. Falls back to the theme surface colour. */
  fill?: string
  stroke?: string
  strokeWidth?: number
  shape?: SquircleShape
  /** Clips children to the corner radius. Ignored when `style.overflow` is 'visible'. */
  clipContent?: boolean
}

export const SquircleSurface = memo(function SquircleSurface({
  children,
  style,
  radius = 20,
  smoothing = 1,
  fill,
  stroke,
  strokeWidth = 1,
  shape = "squircle",
  clipContent = true,
  onLayout,
  ...rest
}: SquircleSurfaceProps) {
  const colors = useColors()
  const [size, setSize] = useState({ width: 0, height: 0 })

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
      onLayout?.(e)
    },
    [onLayout],
  )

  const flat = useMemo(() => (StyleSheet.flatten(style) ?? {}) as ViewStyle, [style])

  const paint =
    fill ??
    (typeof flat.backgroundColor === "string" ? flat.backgroundColor : undefined) ??
    colors.surface
  const edge = stroke ? strokeWidth : 0
  const clip = clipContent && flat.overflow !== "visible"

  const effectiveRadius = squircleRadius(shape, radius, size.width || 100, size.height || 100)

  // Inset by half the stroke so the line sits fully inside the box instead of being clipped.
  const path = useMemo(
    () =>
      size.width > 0 && size.height > 0
        ? squirclePath({
            width: Math.max(0, size.width - edge),
            height: Math.max(0, size.height - edge),
            radius: Math.max(0, effectiveRadius - edge / 2),
            smoothing: shape === "rounded" ? 0 : smoothing,
          })
        : "",
    [edge, effectiveRadius, shape, size.height, size.width, smoothing],
  )

  const drawn = Boolean(path)
  const viewStyle = useMemo(
    () => [
      flat,
      drawn
        ? styles.clear
        : {
            backgroundColor: paint,
            borderColor: stroke,
            borderWidth: edge,
          },
      clip ? { borderRadius: effectiveRadius, overflow: "hidden" as const } : null,
    ],
    [clip, drawn, edge, effectiveRadius, flat, paint, stroke],
  )

  // Hardware-accelerated clipping when the native Android view is available.
  if (NativeSquircleView) {
    return (
      <NativeSquircleView
        {...rest}
        onLayout={handleLayout}
        squircleBackgroundColor={processColor(paint) as number | null}
        squircleBorderColor={stroke ? (processColor(stroke) as number | null) : null}
        squircleBorderWidth={edge}
        squircleRadius={effectiveRadius}
        cornerSmoothing={Math.round(smoothing * 100)}
        shape={shape}
        clipContent={clip}
        style={[flat, styles.clear]}
      >
        {children}
      </NativeSquircleView>
    )
  }

  return (
    <View {...rest} onLayout={handleLayout} style={viewStyle}>
      {path ? (
        <Svg
          pointerEvents="none"
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
        >
          <G transform={`translate(${edge / 2}, ${edge / 2})`}>
            <Path d={path} fill={paint} stroke={stroke} strokeWidth={edge} />
          </G>
        </Svg>
      ) : null}
      {children}
    </View>
  )
})

const styles = StyleSheet.create({
  // The squircle paints the fill and edge; the View itself must never draw a rectangle.
  clear: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
  },
})

export default SquircleSurface
