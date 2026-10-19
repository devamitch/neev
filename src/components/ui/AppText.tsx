import { normalize, SetuTypography } from "@/theme/setuTypography"
import { useTheme } from "@/theme/useTheme"
import React from "react"
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from "react-native"

export type TextVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "display"
  | "body"
  | "bodyMedium"
  | "bodyBold"
  | "caption"
  | "captionBold"
  | "label"
  | "overline"
  | "button"
  | "code"
  | "heading"
  | "subheading"

export interface AppTextProps extends TextProps {
  variant?: TextVariant
  color?: string
  style?: StyleProp<TextStyle>
  children?: React.ReactNode
}

/** Static Geist files, one per weight. Android cannot synthesise weights from a custom family. */
const GEIST_BY_WEIGHT: Record<string, string> = {
  "100": "Geist-Regular",
  "200": "Geist-Regular",
  "300": "Geist-Regular",
  "400": "Geist-Regular",
  "normal": "Geist-Regular",
  "500": "Geist-Medium",
  "600": "Geist-SemiBold",
  "700": "Geist-Bold",
  "bold": "Geist-Bold",
  "800": "Geist-Bold",
  "900": "Geist-Bold",
}

const WEIGHT_BY_GEIST: Record<string, string> = {
  "Geist-Regular": "400",
  "Geist-Medium": "500",
  "Geist-SemiBold": "600",
  "Geist-Bold": "700",
}

/** Families that render as-is (SpaceGrotesk, Fraunces, monospace, etc.); unset maps onto Geist. */
const PASSTHROUGH_FAMILIES = new Set([
  "Fraunces-Variable",
  "Courier",
  "monospace",
  "spaceGroteskLight",
  "spaceGroteskRegular",
  "spaceGroteskMedium",
  "spaceGroteskSemiBold",
  "spaceGroteskBold",
  "SpaceGrotesk-Light",
  "SpaceGrotesk-Regular",
  "SpaceGrotesk-Medium",
  "SpaceGrotesk-SemiBold",
  "SpaceGrotesk-Bold",
  "Geist-Regular",
  "Geist-Medium",
  "Geist-SemiBold",
  "Geist-Bold",
])

export function AppText({
  variant = "body",
  color,
  style,
  children,
  maxFontSizeMultiplier = 1.3,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme()

  const variantStyle: TextStyle =
    (variant === "heading"
      ? SetuTypography.h2
      : variant === "subheading" || variant === "h4"
        ? SetuTypography.h3
        : (SetuTypography as any)[variant]) || SetuTypography.body

  const isQuiet = variant === "caption" || variant === "overline"
  const textColor = color ?? (isQuiet ? colors.text.secondary : colors.text.primary)

  // Resolve the requested weight to the matching static font file so every
  // screen renders the intended font at the intended weight.
  const flat = StyleSheet.flatten([variantStyle, style]) ?? {}
  const family = flat.fontFamily
  
  // Make custom fontSizes responsive if specified directly in style
  const responsiveFontSize = typeof flat.fontSize === "number" ? normalize(flat.fontSize) : undefined

  let resolved: TextStyle
  if (family && PASSTHROUGH_FAMILIES.has(family)) {
    resolved = {
      ...flat,
      fontSize: responsiveFontSize ?? flat.fontSize,
      fontFamily: family,
      fontWeight: family === "monospace" || family === "Courier" ? flat.fontWeight : undefined,
    }
  } else {
    const weight = String(flat.fontWeight ?? WEIGHT_BY_GEIST[family ?? ""] ?? "400")
    resolved = {
      ...flat,
      fontSize: responsiveFontSize ?? flat.fontSize,
      fontFamily: GEIST_BY_WEIGHT[weight] ?? "Geist-Regular",
      fontWeight: undefined,
    }
  }

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ color: textColor }, resolved]}
      {...rest}
    >
      {children}
    </Text>
  )
}
