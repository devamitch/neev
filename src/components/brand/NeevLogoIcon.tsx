import React, { memo } from "react"
import Svg, { Rect, Path, G } from "react-native-svg"

export interface NeevLogoIconProps {
  size?: number
  withBackground?: boolean
}

/**
 * Official Neev (नींव) Brand Mark:
 * Minimalist terracotta foundation arch (#D2A584) with a sprouting sage green leaf (#9AB596)
 * and delicate white veins on warm porcelain (#FAF9F5).
 */
export const NeevLogoIcon = memo(function NeevLogoIcon({
  size = 48,
  withBackground = true,
}: NeevLogoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {withBackground && (
        <Rect width="120" height="120" rx="30" fill="#FAF9F5" />
      )}

      {/* Terracotta Foundation Arch (नींव) */}
      <Path
        d="M 38 88 A 22 22 0 0 1 82 88 L 72 88 A 12 12 0 0 0 48 88 Z"
        fill="#D2A584"
      />

      {/* Living Sprout / Leaf rising from foundation */}
      <G>
        <Path
          d="M 59 66 C 58 52 50 42 62 26 C 74 38 82 48 68 64 C 65 67 61 68 59 66 Z"
          fill="#9AB596"
        />
        {/* Leaf Vein */}
        <Path
          d="M 60 64 Q 63 46 67 31"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 62 50 Q 67 47 72 48"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 64 41 Q 68 38 72 40"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </G>
    </Svg>
  )
})

export default NeevLogoIcon
