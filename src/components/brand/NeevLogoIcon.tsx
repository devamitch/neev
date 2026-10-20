import React, { memo, useEffect } from "react"
import { StyleSheet } from "react-native"
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import * as Haptics from "expo-haptics"
import { PressableScale } from "@/components/ui/PressableScale"
import { useRootStore } from "@/stores/useRootStore"

export interface NeevLogoIconProps {
  size?: number
  withBackground?: boolean
  playful?: boolean
  interactive?: boolean
  style?: object
  onPress?: () => void
}

const NEEV_WHISPERS = [
  "Neev is looking after your family sanctuary today 🌱",
  "Take a mindful breath. Your household routines are in harmony 🕊️",
  "All family tasks & schedules are running peacefully 🌿",
  "Grandparents and loved ones are safe & connected 💛",
  "A gentle reminder to pause and share a warm smile together 🌸",
]

/**
 * Official Neev Vector Brand Emblem & Living Sanctuary Companion:
 * Terracotta Arch (#DA7756 / #C98A60) + Pista Leaf Sprout (#7D8C7D / #8DAE88) forming the "N" mark
 * on porcelain medallion (#FAF9F5).
 *
 * In playful mode:
 * - Subtle organic breathing loop
 * - Natural periodic eye blink & curious head tilt
 * - Expressive mindful eyes, rosy cheeks, and warm smile
 * - Joyful spring bounce & mindful companion whisper on press
 */
export const NeevLogoIcon = memo(function NeevLogoIcon({
  size = 48,
  withBackground = true,
  playful = true,
  interactive = true,
  style,
  onPress,
}: NeevLogoIconProps) {
  // Breathing, tilting & eye animations
  const breathe = useSharedValue(1)
  const rotation = useSharedValue(0)
  const eyeBlink = useSharedValue(1)
  const lookOffset = useSharedValue(0)

  useEffect(() => {
    if (!playful) return

    // Gentle calm breathing
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    )

    // Periodic organic eye blink & subtle curious glance every 4.5 seconds
    const interval = setInterval(() => {
      // Natural double or single blink
      eyeBlink.value = withSequence(
        withTiming(0.08, { duration: 80 }),
        withTiming(1, { duration: 100 }),
      )
      // Slight curious glance
      lookOffset.value = withSequence(
        withTiming(1.5, { duration: 400 }),
        withTiming(0, { duration: 600 }),
      )
    }, 4500)

    // Occasional gentle curious tilt
    const tiltInterval = setInterval(() => {
      rotation.value = withSequence(
        withTiming(2.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1.5, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      )
    }, 9000)

    return () => {
      clearInterval(interval)
      clearInterval(tiltInterval)
    }
  }, [playful, breathe, eyeBlink, lookOffset, rotation])

  const handlePress = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    if (playful) {
      // Joyful spring bounce, playful wink & wobble
      eyeBlink.value = withSequence(
        withTiming(0.05, { duration: 120 }),
        withTiming(1, { duration: 140 }),
      )
      rotation.value = withSequence(
        withTiming(-8, { duration: 90 }),
        withTiming(9, { duration: 100 }),
        withSpring(0, { damping: 9, stiffness: 240 }),
      )
      breathe.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 300 }),
        withSpring(1.0, { damping: 10, stiffness: 210 }),
      )
    }

    if (onPress) {
      onPress()
    } else {
      // Neev companion speaks a random mindful family whisper
      const randomWhisper = NEEV_WHISPERS[Math.floor(Math.random() * NEEV_WHISPERS.length)]
      useRootStore.getState().showToast({
        message: randomWhisper,
        type: "info",
        actionLabel: "Sanctuary",
      })
    }
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: breathe.value },
      { rotateZ: `${rotation.value}deg` },
    ],
  }))

  const eyeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: eyeBlink.value },
      { translateX: lookOffset.value },
    ],
  }))

  const content = (
    <Animated.View style={[styles.container, { width: size, height: size }, playful && animatedStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {withBackground && (
          <Circle
            cx="100"
            cy="100"
            r="92"
            fill="#FAFBF9"
            stroke="rgba(125, 140, 125, 0.22)"
            strokeWidth="3"
          />
        )}

        {/* ── Terracotta Foundation Arch ('N' Left Pillar & Arch) ── */}
        <Path
          d="M 50 144 L 50 82 C 50 58 70 46 94 46 C 110 46 118 56 118 72 C 108 86 96 106 88 126 L 80 144 C 80 147 77 150 74 150 L 56 150 C 52.6 150 50 147.4 50 144 Z"
          fill="#DA7756"
        />

        {/* ── Right Pista Green Column of the 'N' ── */}
        <Path
          d="M 124 116 L 124 144 C 124 147.3 126.7 150 130 150 L 148 150 C 151.3 150 154 147.3 154 144 L 154 84 C 154 84 146 94 136 104 L 124 116 Z"
          fill="#7D8C7D"
        />

        {/* ── Living Sprout Leaf (Diagonal of 'N' in Pista Green) ── */}
        <G>
          <Path
            d="M 80 150 C 80 140 85 118 96 96 C 108 72 126 55 154 48 C 154 68 150 94 136 116 C 122 138 100 150 80 150 Z"
            fill="#8DAE88"
          />

          {/* Central Spine Vein */}
          <Path
            d="M 86 142 Q 106 106 146 58"
            stroke="#FFFFFF"
            strokeWidth="3.2"
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
        </G>

        {/* ── Top Living Head Sprout (Playful & Expressive) ── */}
        <Path
          d="M 94 48 C 96 32 108 22 124 22 C 126 36 118 48 104 52 Z"
          fill="#8DAE88"
        />
        <Path
          d="M 96 48 Q 106 36 120 25"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />

        {/* ── Playful Living Companion Face (Mindful, Kind & Expressive) ── */}
        {playful && (
          <G>
            {/* Soft Peach-Terracotta Rosy Cheeks */}
            <Ellipse cx="66" cy="88" rx="8" ry="4.5" fill="rgba(255, 210, 195, 0.65)" />
            <Ellipse cx="106" cy="80" rx="8" ry="4.5" fill="rgba(255, 210, 195, 0.65)" />

            {/* Left Eye: White sclera, dark iris, twin light highlights */}
            <Circle cx="74" cy="77" r="7" fill="#FFFFFF" />
            <Circle cx="75.5" cy="77" r="4.5" fill="#231B18" />
            <Circle cx="77" cy="75" r="1.8" fill="#FFFFFF" />
            <Circle cx="74" cy="79" r="0.9" fill="#FFFFFF" />

            {/* Right Eye: White sclera, dark iris, twin light highlights */}
            <Circle cx="98" cy="71" r="7" fill="#FFFFFF" />
            <Circle cx="99.5" cy="71" r="4.5" fill="#231B18" />
            <Circle cx="101" cy="69" r="1.8" fill="#FFFFFF" />
            <Circle cx="98" cy="73" r="0.9" fill="#FFFFFF" />

            {/* Gentle Warm Eyebrows */}
            <Path
              d="M 69 68 Q 75 64 80 67"
              stroke="#FFF8F5"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 93 62 Q 99 58 104 61"
              stroke="#FFF8F5"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Warm Friendly Happy Smile */}
            <Path
              d="M 77 94 Q 87 103 97 91"
              stroke="#FFFFFF"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
          </G>
        )}
      </Svg>
    </Animated.View>
  )

  if (interactive) {
    return (
      <PressableScale
        onPress={handlePress}
        hitSlop={6}
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel="Neev Sanctuary Companion"
      >
        {content}
      </PressableScale>
    )
  }

  return content
})

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
})

export default NeevLogoIcon
