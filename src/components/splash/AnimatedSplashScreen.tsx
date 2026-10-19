/**
 * Animated splash shown right after the native splash.
 *
 * Crash-proofing:
 * - Pure Reanimated + expo-image. No Lottie view, so no native animation
 *   failure path and no JSON asset that can go missing.
 * - No worklet -> JS callbacks (no runOnJS / scheduleOnRN). Timing is driven by
 *   JS timers that are cleared on unmount, so a Reanimated / Worklets upgrade
 *   cannot break the exit.
 * - Finishes exactly once (tap, timer and unmount can race safely).
 * - `onReady` fires once the logo has decoded (or after a short fallback), so
 *   the parent can hide the native splash with no blank frame in between.
 *
 * Look: flat colour only. One soft "inhale" halo behind the logo, then the
 * wordmark rises in. No gradients, shadows or borders.
 */
import { PressableScale } from "@/components/ui/PressableScale"
import { Image } from "expo-image"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import { SystemBars } from "react-native-edge-to-edge"
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

import { AppText } from "@/components/ui/AppText"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import { setuColors } from "@/theme/setuColors"

const HOLD_MS = 1800
const HOLD_REDUCED_MS = 900
const EXIT_MS = 260
const READY_FALLBACK_MS = 600

const LOGO_SIZE = 84
const MARK_SIZE = 220
const HALO_OUTER = "rgba(125, 156, 123, 0.12)" // sage
const HALO_INNER = "rgba(218, 119, 86, 0.09)" // terracotta

interface AnimatedSplashScreenProps {
  /** Fires once when the logo is on screen. Use it to hide the native splash. */
  onReady?: () => void
  /** Fires once after the exit fade completes. */
  onAnimationFinish?: () => void
}

export function AnimatedSplashScreen({ onReady, onAnimationFinish }: AnimatedSplashScreenProps) {
  const reducedMotion = useReducedMotion()

  const [isReady, setIsReady] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const readyRef = useRef(false)
  const finishedRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onReadyRef = useRef(onReady)
  const onFinishRef = useRef(onAnimationFinish)

  const rootOpacity = useSharedValue(1)
  const logoProgress = useSharedValue(0)
  const copyProgress = useSharedValue(0)
  const haloProgress = useSharedValue(0)

  // Always call the latest callbacks without restarting the animation.
  useEffect(() => {
    onReadyRef.current = onReady
    onFinishRef.current = onAnimationFinish
  }, [onReady, onAnimationFinish])

  const markReady = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    setIsReady(true)
  }, [])

  // Never wait forever on the image.
  useEffect(() => {
    const t = setTimeout(markReady, READY_FALLBACK_MS)
    return () => clearTimeout(t)
  }, [markReady])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)

    rootOpacity.value = withTiming(0, {
      duration: EXIT_MS,
      easing: Easing.in(Easing.quad),
    })

    exitTimerRef.current = setTimeout(() => {
      setIsDone(true)
      onFinishRef.current?.()
    }, EXIT_MS + 20)
  }, [rootOpacity])

  // Entrance starts only once the logo is visible.
  useEffect(() => {
    if (!isReady) return

    onReadyRef.current?.()

    if (reducedMotion) {
      logoProgress.value = withTiming(1, { duration: 200 })
      copyProgress.value = withTiming(1, { duration: 200 })
      haloProgress.value = 1
    } else {
      logoProgress.value = withDelay(
        60,
        withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      )
      copyProgress.value = withDelay(
        420,
        withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      )
      haloProgress.value = withTiming(1, {
        duration: HOLD_MS,
        easing: Easing.inOut(Easing.sin),
      })
    }

    holdTimerRef.current = setTimeout(finish, reducedMotion ? HOLD_REDUCED_MS : HOLD_MS)

    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [isReady, reducedMotion, finish, logoProgress, copyProgress, haloProgress])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      cancelAnimation(rootOpacity)
      cancelAnimation(logoProgress)
      cancelAnimation(copyProgress)
      cancelAnimation(haloProgress)
    }
  }, [rootOpacity, logoProgress, copyProgress, haloProgress])

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }))

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoProgress.value,
    transform: [{ scale: reducedMotion ? 1 : interpolate(logoProgress.value, [0, 1], [0.9, 1]) }],
  }))

  const haloOuterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(haloProgress.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [
      { scale: reducedMotion ? 1 : interpolate(haloProgress.value, [0, 1], [0.84, 1.04]) },
    ],
  }))

  const haloInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(haloProgress.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [
      { scale: reducedMotion ? 1 : interpolate(haloProgress.value, [0, 1], [0.72, 0.92]) },
    ],
  }))

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyProgress.value,
    transform: [
      { translateY: reducedMotion ? 0 : interpolate(copyProgress.value, [0, 1], [10, 0]) },
    ],
  }))

  if (isDone) return null

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      {/* Light canvas everywhere: dark status + navigation bar icons. */}
      <SystemBars style="dark" />

      <PressableScale
        style={styles.fill}
        onPress={finish}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel="Neev"
        accessibilityHint="Skips the intro animation"
      >
        <View style={styles.mark}>
          <Animated.View style={[styles.haloOuter, haloOuterStyle]} />
          <Animated.View style={[styles.haloInner, haloInnerStyle]} />
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <NeevLogoIcon size={84} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <AppText variant="display" style={styles.title}>
            Neev
          </AppText>
          <AppText variant="body" style={styles.tagline}>
            Family Functions Schedulers & Shared Knowledge
          </AppText>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: setuColors.canvas,
  },
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 32,
  },

  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  haloOuter: {
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    backgroundColor: HALO_OUTER,
  },
  haloInner: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: HALO_INNER,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.16,
    overflow: "hidden",
  },

  copy: {
    width: "100%",
    alignItems: "center",
    marginTop: -40,
  },
  title: {
    color: setuColors.primaryInk,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.7,
    textAlign: "center",
  },
  tagline: {
    color: setuColors.secondaryInk,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 5,
    maxWidth: 290,
  },
})
