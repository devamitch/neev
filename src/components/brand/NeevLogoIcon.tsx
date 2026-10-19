import React, { memo } from "react"
import { StyleSheet, View } from "react-native"
import Svg, { Circle, G, Path } from "react-native-svg"

export interface NeevLogoIconProps {
  size?: number
  withBackground?: boolean
  style?: object
}

/**
 * Official Neev (नींव) Vector Brand Emblem:
 * Terracotta Arch (#C98A60) + Sage Leaf Sprout (#8DAE88) forming the "N" mark
 * on porcelain medallion (#FAF9F5).
 */
export const NeevLogoIcon = memo(function NeevLogoIcon({
  size = 48,
  withBackground = true,
  style,
}: NeevLogoIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {withBackground && <Circle cx="100" cy="100" r="92" fill="#FAF9F5" />}

        {/* ── Terracotta Foundation Arch ── */}
        <Path
          d="M 50 144 L 50 82 C 50 60 70 48 94 48 C 108 48 114 58 114 74 C 104 86 94 104 88 126 L 80 144 C 80 147 77 150 74 150 L 56 150 C 52.6 150 50 147.4 50 144 Z"
          fill="#C98A60"
        />

        {/* ── Right Green Column of the 'N' ── */}
        <Path
          d="M 124 116 L 124 144 C 124 147.3 126.7 150 130 150 L 148 150 C 151.3 150 154 147.3 154 144 L 154 84 C 154 84 146 94 136 104 L 124 116 Z"
          fill="#8DAE88"
        />

        {/* ── Living Sprout Leaf (Diagonal of 'N' with delicate white veins) ── */}
        <G>
          <Path
            d="M 80 150 C 80 140 85 118 96 96 C 108 72 126 55 154 48 C 154 68 150 94 136 116 C 122 138 100 150 80 150 Z"
            fill="#8DAE88"
          />

          {/* Central Spine Vein */}
          <Path
            d="M 86 142 Q 106 106 146 58"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Branching Leaf Veins */}
          <Path
            d="M 124 84 Q 138 78 146 68"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 116 98 Q 132 94 142 88"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 104 116 Q 96 110 92 104"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 112 102 Q 106 94 102 88"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
})

export default NeevLogoIcon
