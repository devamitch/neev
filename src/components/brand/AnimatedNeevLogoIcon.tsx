import React, { memo, useEffect } from "react"
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import Svg, { Circle, G, Path } from "react-native-svg"

export interface AnimatedNeevLogoIconProps {
  size?: number
  animated?: boolean
  withBackground?: boolean
}

const LOOP_MS = 9000

/**
 * Living Neev Vector Mark for the Bottom Action Orb:
 * Exact geometric vector translation of the canonical Neev "N" brand emblem:
 * - Terracotta Foundation Arch (#C98A60)
 * - Living Sage/Pista Sprout Leaf (#7D8C7D / #8DAE88) with delicate white veins
 * - Right pillar forming the architectural "N"
 * - Expressive Reanimated emotion cycle: calm breath → curious tilt → joyful hop & squash-stretch!
 */
export const AnimatedNeevLogoIcon = memo(function AnimatedNeevLogoIcon({
  size = 44,
  animated = false,
  withBackground = true,
}: AnimatedNeevLogoIconProps) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!animated || reduceMotion) {
      cancelAnimation(progress)
      progress.value = 0
      return
    }

    progress.value = 0
    progress.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    )

    return () => {
      cancelAnimation(progress)
    }
  }, [animated, reduceMotion, progress])

  // Living emotional choreography
  const bodyAnimStyle = useAnimatedStyle(() => {
    const p = progress.value

    // Floating translateY: calm floating + joyful hop at p=0.52
    const translateY = interpolate(
      p,
      [0, 0.22, 0.38, 0.48, 0.53, 0.58, 0.64, 0.82, 1],
      [0, -1.8, 0, 0, -5.5, 1.2, 0, -1, 0],
      Extrapolation.CLAMP,
    )

    // Playful rotation: curious tilt at p=0.4, delighted wiggle at p=0.68
    const rotate = interpolate(
      p,
      [0, 0.35, 0.42, 0.47, 0.52, 0.65, 0.7, 0.76, 0.82, 1],
      [0, 0, 6.5, -5, 0, 0, 4.5, -4.5, 0, 0],
      Extrapolation.CLAMP,
    )

    // Squash & Stretch: organic breathing + spring landing
    const scale = interpolate(
      p,
      [0, 0.2, 0.38, 0.48, 0.53, 0.58, 0.68, 1],
      [1, 1.04, 1, 1.02, 1.09, 0.94, 1.03, 1],
      Extrapolation.CLAMP,
    )

    return {
      transform: [
        { translateY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    }
  })

  // Independent living leaf sway
  const leafAnimStyle = useAnimatedStyle(() => {
    const p = progress.value
    const leafSway = interpolate(
      p,
      [0, 0.25, 0.5, 0.75, 1],
      [0, 3, -3, 2, 0],
      Extrapolation.CLAMP,
    )
    return {
      transform: [{ rotate: `${leafSway}deg` }],
      transformOrigin: "bottom center",
    }
  })

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        bodyAnimStyle,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* Porcelain circular background medallion */}
        {withBackground && (
          <Circle cx="100" cy="100" r="92" fill="#FAF9F5" />
        )}

        {/* ── Terracotta Foundation Arch (Left pillar & curve) ── */}
        <Path
          d="M 50 144 L 50 82 C 50 60 70 48 94 48 C 108 48 114 58 114 74 C 104 86 94 104 88 126 L 80 144 C 80 147 77 150 74 150 L 56 150 C 52.6 150 50 147.4 50 144 Z"
          fill="#C98A60"
        />

        {/* ── Right Green Column of the 'N' ── */}
        <Path
          d="M 124 116 L 124 144 C 124 147.3 126.7 150 130 150 L 148 150 C 151.3 150 154 147.3 154 144 L 154 84 C 154 84 146 94 136 104 L 124 116 Z"
          fill="#8DAE88"
        />
      </Svg>

      {/* ── Living Sprout Leaf (Diagonal of 'N' with delicate white veins) ── */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
          },
          leafAnimStyle,
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <G>
            {/* Organic Leaf Blade */}
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

            {/* Upper Right Leaf Vein */}
            <Path
              d="M 124 84 Q 138 78 146 68"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Middle Right Leaf Vein */}
            <Path
              d="M 116 98 Q 132 94 142 88"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Left Lower Leaf Vein */}
            <Path
              d="M 104 116 Q 96 110 92 104"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Left Upper Leaf Vein */}
            <Path
              d="M 112 102 Q 106 94 102 88"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  )
})

export default AnimatedNeevLogoIcon
