import { ProductIcons, type ProductIconName } from "@/constants/product-icons"
import { useColors } from "@/theme/useTheme"
import { Image } from "expo-image"
import React from "react"
import type { ImageStyle, StyleProp } from "react-native"

export type IconName = ProductIconName

export interface IconProps {
  name: IconName
  /** Edge length in dp. 24 matches standard list rows and toolbars. */
  size?: number
  /** Defaults to the current scheme's secondary ink; pass a theme colour to emphasise. */
  color?: string
  style?: StyleProp<ImageStyle>
}

/**
 * Flat monochrome icon component. Every icon is tinted from the active theme
 * rather than shipped twice; supports all 112 system icons.
 */
export function Icon({ name, size = 24, color, style }: IconProps) {
  const colors = useColors()
  const iconSource = ProductIcons[name] || ProductIcons.back // Fallback to back icon

  return (
    <Image
      source={iconSource}
      style={[{ width: size, height: size }, style]}
      tintColor={color ?? colors.text.secondary}
      contentFit="contain"
      accessible={false}
      cachePolicy="memory-disk"
    />
  )
}

export default Icon
