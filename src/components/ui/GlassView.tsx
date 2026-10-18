/**
 * Frosted glass surface. On Android, a real-time blur needs a `blurTarget` —
 * a ref to the `BlurTargetView` wrapping whatever sits *behind* this surface
 * (expo-blur's `dimezisBlurViewSdk31Plus` method silently falls back to no
 * blur at all without one, Android 12+ only). Pass one when you have it
 * (e.g. the drawer passes the tab content it sits over); without one this
 * renders as a plain translucent tint, which is still a legible, deliberate
 * look — never a crash, and never a blur method claimed but not delivered.
 */
import type { ReactNode, RefObject } from "react"
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { BlurView } from "expo-blur"

export function GlassView({
  children,
  style,
  intensity = 60,
  tint = "light",
  overlay = "rgba(250,249,245,0.55)",
  blurTarget,
}: {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  intensity?: number
  tint?: "light" | "dark" | "default" | "extraLight"
  /** Colour wash over the blur so text stays readable. */
  overlay?: string
  /** Ref to the `BlurTargetView` behind this surface; enables a real blur. */
  blurTarget?: RefObject<View | null>
}) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={intensity}
        tint={tint}
        blurMethod={blurTarget ? "dimezisBlurViewSdk31Plus" : "none"}
        blurTarget={blurTarget}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} pointerEvents="none" />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({ wrap: { overflow: "hidden" } })
