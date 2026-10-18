import React from "react"
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Path,
  Line,
  Text as SvgText,
} from "react-native-svg"

interface NeevLogoIconProps {
  size?: number
  withBackground?: boolean
}

/**
 * Official Neev (नींव) Brand Mark:
 * Serene Sage & Cedar arch with the foundational italic "N" and grounded plinth line.
 */
export function NeevLogoIcon({ size = 48, withBackground = true }: NeevLogoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="neevGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#8A9B8A" />
          <Stop offset="100%" stopColor="#6B7D6B" />
        </SvgLinearGradient>
      </Defs>

      {withBackground && (
        <Rect width="120" height="120" rx="30" fill="#E0EDE8" />
      )}

      {/* Sanctuary Arch */}
      <Path
        d="M60 22 C38 22, 26 42, 26 62 C26 78, 36 90, 60 98 C84 90, 94 78, 94 62 C94 42, 82 22, 60 22Z"
        fill="none"
        stroke="url(#neevGrad)"
        strokeWidth="4"
        opacity="0.35"
      />

      {/* Foundational "N" */}
      <SvgText
        x="60"
        y="72"
        fontSize="54"
        fontWeight="700"
        fontStyle="italic"
        fill="#3D5250"
        textAnchor="middle"
        letterSpacing="-1"
      >
        N
      </SvgText>

      {/* Plinth Foundation line */}
      <Line
        x1="38"
        y1="88"
        x2="82"
        y2="88"
        stroke="#6B7D6B"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
    </Svg>
  )
}
