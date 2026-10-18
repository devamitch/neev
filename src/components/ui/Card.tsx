import { useTheme } from "@/theme/useTheme"
import { useMemo } from "react"
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { SquircleSurface } from "./SquircleSurface"

export interface CardProps {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  radius?: number
  level?: 1 | 2 | 3
}

/**
 * Surface container. Default padding is 16 unless `style` sets any padding key.
 * Everything in `style` goes straight onto the single squircle View - no inner wrapper.
 */
export function Card({ children, style, radius = 20, level = 1 }: CardProps) {
  const { colors } = useTheme()

  const fill = level === 3 ? colors.surface3 : level === 2 ? colors.surface2 : colors.surface

  const hasPadding = useMemo(() => {
    const flat = StyleSheet.flatten(style)
    return !!flat && Object.keys(flat).some((key) => key.startsWith("padding"))
  }, [style])

  return (
    <SquircleSurface
      radius={radius}
      smoothing={1}
      fill={fill}
      style={[styles.card, hasPadding ? null : styles.defaultPadding, style]}
    >
      {children}
    </SquircleSurface>
  )
}

const styles = StyleSheet.create({
  card: {
    elevation: 0,
    shadowOpacity: 0,
  },
  defaultPadding: {
    padding: 16,
  },
})
