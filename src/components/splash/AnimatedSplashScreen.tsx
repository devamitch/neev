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
 * Look: continues from the native splash mark ("Neev" means foundation): the mark
 * settles upward, a terracotta foundation line draws beneath it, the wordmark rises
 * letter by letter and a short tagline follows. Flat colour, no gradients or shadows.
 */
import { PressableScale } from "@/components/ui/PressableScale"
import { Image } from "expo-image"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import { SystemBars } from "react-native-edge-to-edge"
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

import { AppText } from "@/components/ui/AppText"
import { setuColors } from "@/theme/setuColors"

const HOLD_MS = 1900
const HOLD_REDUCED_MS = 900
const EXIT_MS = 280
const READY_FALLBACK_MS = 600

/** Same artwork as the native splash, so the hand-off has no visual jump. */
const MARK = require("@assets/images/splash-screen.png")
const MARK_SIZE = 168
const MARK_START_SCALE = 1.2
const MARK_END_SCALE = 0.78
const MARK_RISE = -64
const LINE_WIDTH = 96
const TERRACOTTA = "#DA7756"
/** The splash artwork's own background (also the native splash colour in app.json). */
const SPLASH_CANVAS = "#F7F6F0"
const WORD = "Neev".split("")
const LETTER_STAGGER = 70

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
  const markProgress = useSharedValue(0)
  const lineProgress = useSharedValue(0)
  const wordProgress = useSharedValue(0)
  const taglineProgress = useSharedValue(0)

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

    const ease = Easing.out(Easing.cubic)
    if (reducedMotion) {
      markProgress.value = 1
      lineProgress.value = 1
      wordProgress.value = withTiming(1, { duration: 200 })
      taglineProgress.value = withTiming(1, { duration: 200 })
    } else {
      markProgress.value = withDelay(80, withTiming(1, { duration: 620, easing: Easing.inOut(Easing.cubic) }))
      lineProgress.value = withDelay(420, withTiming(1, { duration: 520, easing: ease }))
      wordProgress.value = withDelay(
        520,
        withTiming(1, { duration: 420 + LETTER_STAGGER * (WORD.length - 1), easing: Easing.linear }),
      )
      taglineProgress.value = withDelay(1050, withTiming(1, { duration: 420, easing: ease }))
    }

    holdTimerRef.current = setTimeout(finish, reducedMotion ? HOLD_REDUCED_MS : HOLD_MS)

    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [isReady, reducedMotion, finish, markProgress, lineProgress, wordProgress, taglineProgress])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      cancelAnimation(rootOpacity)
      cancelAnimation(markProgress)
      cancelAnimation(lineProgress)
      cancelAnimation(wordProgress)
      cancelAnimation(taglineProgress)
    }
  }, [rootOpacity, markProgress, lineProgress, wordProgress, taglineProgress])

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
    transform: [{ scale: interpolate(rootOpacity.value, [0, 1], [1.03, 1]) }],
  }))

  // On exit the mark and words leave first, then the canvas, so the artwork's own
  // background never shows as a box over the next screen.
  const contentExitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rootOpacity.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
  }))

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rootOpacity.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(markProgress.value, [0, 1], [0, MARK_RISE]) },
      { scale: interpolate(markProgress.value, [0, 1], [MARK_START_SCALE, MARK_END_SCALE]) },
    ],
  }))

  // The foundation the mark settles onto.
  const lineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lineProgress.value, [0, 0.2, 1], [0, 1, 1]),
    transform: [{ scaleX: lineProgress.value }],
  }))

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineProgress.value,
    transform: [{ translateY: interpolate(taglineProgress.value, [0, 1], [6, 0]) }],
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
        <Animated.View style={[styles.mark, markStyle]}>
          <Image
            source={MARK}
            style={styles.markImage}
            contentFit="contain"
            priority="high"
            transition={0}
            onDisplay={markReady}
            accessible={false}
          />
        </Animated.View>

        <Animated.View style={[styles.copy, contentExitStyle]} pointerEvents="none">
          <Animated.View style={[styles.line, lineStyle]} />
          <View style={styles.word} accessible accessibilityLabel="Neev">
            {WORD.map((letter, i) => (
              <Letter key={i} letter={letter} index={i} progress={wordProgress} />
            ))}
          </View>
          <Animated.View style={taglineStyle}>
            <AppText variant="body" style={styles.tagline}>
              The foundation of your family
            </AppText>
          </Animated.View>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  )
}

/** One wordmark letter; each rises a beat after the one before it. */
function Letter({
  letter,
  index,
  progress,
}: {
  letter: string
  index: number
  progress: SharedValue<number>
}) {
  const total = 420 + LETTER_STAGGER * (WORD.length - 1)
  const start = (index * LETTER_STAGGER) / total
  const end = (index * LETTER_STAGGER + 420) / total
  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [start, end], [0, 1], Extrapolation.CLAMP)
    const eased = 1 - Math.pow(1 - t, 3)
    return {
      opacity: eased,
      transform: [{ translateY: (1 - eased) * 14 }],
    }
  })
  return (
    <Animated.Text style={[styles.letter, style]} accessible={false}>
      {letter}
    </Animated.Text>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: SPLASH_CANVAS,
  },
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  mark: {
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  markImage: {
    width: "100%",
    height: "100%",
  },
  copy: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    marginTop: 8,
  },
  line: {
    width: LINE_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: TERRACOTTA,
    marginBottom: 18,
  },
  word: {
    flexDirection: "row",
  },
  letter: {
    color: setuColors.primaryInk,
    fontFamily: "Geist-Bold",
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  tagline: {
    color: setuColors.secondaryInk,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
})
