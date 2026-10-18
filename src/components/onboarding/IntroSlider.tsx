/**
 * First-run intro slider.
 *
 * - Flat colour only: the page background, pagination and CTA all interpolate
 *   between per-slide colours while scrolling. No gradients, shadows or borders.
 * - Backgrounds are sampled from the artwork, so each illustration sits on the
 *   page with no visible box around it.
 * - Edge-to-edge: the root paints behind the status bar and the Android
 *   navigation bar, so both always match the current slide. Content is inset
 *   with safe-area values. Icon colour is pinned to dark (every slide is light).
 * - No Reanimated worklet callbacks into JS (no runOnJS / scheduleOnRN): the
 *   exit fade is a timing animation plus a JS timer, so it cannot break across
 *   Reanimated / Worklets version changes.
 * - Reduced-motion aware: parallax and scale are switched off, fades remain.
 * - Android back steps to the previous slide before leaving the screen.
 */

import { PressableScale } from "@/components/ui/PressableScale"
import { Image } from "expo-image"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { SystemBars } from "react-native-edge-to-edge"
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AppText } from "@/components/ui/AppText"
import { AssetIllustrations } from "@/constants/assets"
import { setuColors } from "@/theme/setuColors"

// ─── Content ────────────────────────────────────────────────────────────────

interface IntroSlide {
  id: string
  title: string
  description: string
  image: ImageSourcePropType
  /** Flat page colour, sampled from the artwork's own background. */
  background: string
  /** Pagination + CTA colour. All pass 4.5:1 against white button text. */
  accent: string
}

const SLIDES: readonly IntroSlide[] = [
  {
    id: "sanctuary",
    title: "The Sanctuary for Every Family",
    description:
      "One app. Every role. Every stage. Coordinated with the calm, structured wisdom of a trusted elder.",
    image: AssetIllustrations.familyHome,
    background: "#F4F7F4",
    accent: "#5A7A64",
  },
  {
    id: "functions",
    title: "Shared Functions & Rituals",
    description:
      "Plan weddings, pujas, milestone birthdays, and school events with shared task delegations for everyone.",
    image: AssetIllustrations.schoolingKids,
    background: "#FAF6F0",
    accent: "#C27835",
  },
  {
    id: "knowledge",
    title: "Heirloom Wisdom & Lifeline Vault",
    description:
      "Preserve ancestral recipes, elder life lessons, and emergency contacts safely stored on your device.",
    image: AssetIllustrations.heirloomVault,
    background: "#F0F4F6",
    accent: "#4E7A7A",
  },
]

const SLIDE_COUNT = SLIDES.length
const LAST = SLIDE_COUNT - 1
const BACKGROUNDS = SLIDES.map((s) => s.background)
const ACCENTS = SLIDES.map((s) => s.accent)

// ─── Tokens ─────────────────────────────────────────────────────────────────

const EXIT_MS = 260
const SIDE_PADDING = 28
const DOT_SIZE = 8
const DOT_ACTIVE = 24
const CTA_HEIGHT = 56
const INACTIVE_DOT = "rgba(26, 24, 21, 0.16)"
const ON_ACCENT = "#FFFFFF"

const clampIndex = (i: number) => Math.max(0, Math.min(LAST, i))

// ─── Slider ─────────────────────────────────────────────────────────────────

interface IntroSliderProps {
  onFinishIntro: () => void
}

export function IntroSlider({ onFinishIntro }: IntroSliderProps) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()

  const scrollRef = useRef<ScrollView>(null)
  const activeIndexRef = useRef(0)
  const finishedRef = useRef(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(onFinishIntro)

  const [activeIndex, setActiveIndex] = useState(0)
  const [pagerHeight, setPagerHeight] = useState(0)
  const [isDone, setIsDone] = useState(false)

  const scrollX = useSharedValue(0)
  const rootOpacity = useSharedValue(1)
  const ctaScale = useSharedValue(1)

  const isLast = activeIndex === LAST
  const compact = height < 700
  const side = Math.max(SIDE_PADDING, insets.left, insets.right)
  const stops = useMemo(() => SLIDES.map((_, i) => i * width), [width])

  // Always call the latest callback without re-running effects.
  useEffect(() => {
    callbackRef.current = onFinishIntro
  }, [onFinishIntro])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      cancelAnimation(scrollX)
      cancelAnimation(rootOpacity)
      cancelAnimation(ctaScale)
    }
  }, [scrollX, rootOpacity, ctaScale])

  // Keep the current slide aligned after rotation / split-screen / resize.
  useEffect(() => {
    const x = activeIndexRef.current * width
    scrollRef.current?.scrollTo({ x, y: 0, animated: false })
    scrollX.value = x
  }, [width, scrollX])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true

    rootOpacity.value = withTiming(0, {
      duration: EXIT_MS,
      easing: Easing.in(Easing.cubic),
    })

    exitTimerRef.current = setTimeout(() => {
      setIsDone(true)
      callbackRef.current()
    }, EXIT_MS + 20)
  }, [rootOpacity])

  const goTo = useCallback(
    (index: number) => {
      const next = clampIndex(index)
      activeIndexRef.current = next
      setActiveIndex(next)
      scrollRef.current?.scrollTo({ x: next * width, y: 0, animated: true })
    },
    [width],
  )

  const handleNext = useCallback(() => {
    if (activeIndexRef.current >= LAST) finish()
    else goTo(activeIndexRef.current + 1)
  }, [finish, goTo])

  // Android back: previous slide first, then fall through to the system.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (finishedRef.current) return true
      if (activeIndexRef.current > 0) {
        goTo(activeIndexRef.current - 1)
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [goTo])

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x
    },
  })

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = clampIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))
      if (next !== activeIndexRef.current) {
        activeIndexRef.current = next
        setActiveIndex(next)
      }
    },
    [width],
  )

  const rootStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollX.value, stops, BACKGROUNDS),
    opacity: rootOpacity.value,
  }))

  const ctaStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollX.value, stops, ACCENTS),
    transform: [{ scale: ctaScale.value }],
  }))

  // "Continue" cross-fades into "Get started" as the last slide arrives.
  const continueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(LAST - 1) * width, LAST * width],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }))
  const startStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(LAST - 1) * width, LAST * width],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }))
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(LAST - 1) * width, LAST * width],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }))

  if (isDone) return null

  return (
    // Static canvas behind the fading layer so the exit never flashes the
    // navigator's background colour.
    <View style={styles.backdrop}>
      <SystemBars style="dark" />

      <Animated.View style={[styles.root, rootStyle]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: side }]}>
          <Image
            source={require("@assets/images/logo.png")}
            style={styles.brandLogo}
            contentFit="contain"
            priority="high"
            accessibilityLabel="BlinkQuest logo"
          />
          <AppText variant="label" style={styles.brandName}>
            BlinkQuest
          </AppText>
        </View>

        <Animated.ScrollView
          ref={scrollRef as never}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={settle}
          onScrollEndDrag={settle}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height)
            setPagerHeight((prev) => (prev === h ? prev : h))
          }}
          style={styles.pager}
        >
          {SLIDES.map((slide, index) => (
            <SlidePage
              key={slide.id}
              slide={slide}
              index={index}
              width={width}
              height={pagerHeight}
              side={side}
              scrollX={scrollX}
              motion={reducedMotion ? 0 : 1}
              compact={compact}
            />
          ))}
        </Animated.ScrollView>

        <View
          style={[styles.footer, { paddingHorizontal: side, paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.footerRow}>
            <View style={styles.dots} accessibilityRole="tablist">
              {SLIDES.map((slide, index) => (
                <PaginationDot
                  key={slide.id}
                  index={index}
                  width={width}
                  scrollX={scrollX}
                  accent={slide.accent}
                  active={index === activeIndex}
                  onPress={goTo}
                />
              ))}
            </View>

            <Animated.View style={skipStyle} pointerEvents={isLast ? "none" : "auto"}>
              <PressableScale
                onPress={finish}
                hitSlop={12}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityLabel="Skip introduction"
                accessibilityElementsHidden={isLast}
                importantForAccessibility={isLast ? "no-hide-descendants" : "auto"}
                style={styles.skip}
              >
                <AppText variant="body" style={styles.skipText}>
                  Skip
                </AppText>
              </PressableScale>
            </Animated.View>
          </View>

          <PressableScale
            onPress={handleNext}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Get started" : "Continue"}
          >
            <Animated.View style={[styles.cta, ctaStyle]}>
              <Animated.View style={[styles.ctaLabel, continueStyle]}>
                <AppText variant="label" style={styles.ctaText}>
                  Continue
                </AppText>
              </Animated.View>
              <Animated.View style={[styles.ctaLabel, startStyle]}>
                <AppText variant="label" style={styles.ctaText}>
                  Get started
                </AppText>
              </Animated.View>
            </Animated.View>
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

interface SlidePageProps {
  slide: IntroSlide
  index: number
  width: number
  height: number
  side: number
  scrollX: SharedValue<number>
  /** 1 = parallax + scale, 0 = reduced motion (fades only). */
  motion: number
  compact: boolean
}

const SlidePage = memo(function SlidePage({
  slide,
  index,
  width,
  height,
  side,
  scrollX,
  motion,
  compact,
}: SlidePageProps) {
  // Artwork lags behind the swipe, copy runs slightly ahead of it.
  const artStyle = useAnimatedStyle(() => {
    const p = (scrollX.value - index * width) / Math.max(width, 1)
    const edge = 1 - 0.08 * motion
    return {
      opacity: interpolate(p, [-1, 0, 1], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: p * width * 0.26 * motion },
        { scale: interpolate(p, [-1, 0, 1], [edge, 1, edge], Extrapolation.CLAMP) },
      ],
    }
  })

  const copyStyle = useAnimatedStyle(() => {
    const p = (scrollX.value - index * width) / Math.max(width, 1)
    return {
      opacity: interpolate(p, [-0.6, 0, 0.6], [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: -p * width * 0.1 * motion }],
    }
  })

  return (
    <View style={[styles.page, { width, height: height || undefined, paddingHorizontal: side }]}>
      <Animated.View style={[styles.art, artStyle]}>
        <Image
          source={slide.image}
          style={styles.artImage}
          contentFit="contain"
          priority="high"
          accessible={false}
        />
      </Animated.View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <AppText
          variant="h1"
          accessibilityRole="header"
          maxFontSizeMultiplier={1.2}
          style={[styles.title, compact && styles.titleCompact]}
        >
          {slide.title}
        </AppText>
        <AppText variant="body" maxFontSizeMultiplier={1.25} style={styles.description}>
          {slide.description}
        </AppText>
      </Animated.View>
    </View>
  )
})

// ─── Pagination ─────────────────────────────────────────────────────────────

interface PaginationDotProps {
  index: number
  width: number
  scrollX: SharedValue<number>
  accent: string
  active: boolean
  onPress: (index: number) => void
}

function PaginationDot({ index, width, scrollX, accent, active, onPress }: PaginationDotProps) {
  const dotStyle = useAnimatedStyle(() => {
    const f = interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP,
    )
    return {
      width: DOT_SIZE + (DOT_ACTIVE - DOT_SIZE) * f,
      backgroundColor: interpolateColor(f, [0, 1], [INACTIVE_DOT, accent]),
    }
  })

  return (
    <PressableScale
      onPress={() => onPress(index)}
      hitSlop={{ top: 14, bottom: 14, left: 5, right: 5 }}
      accessibilityRole="tab"
      accessibilityLabel={`Page ${index + 1} of ${SLIDE_COUNT}`}
      accessibilityState={{ selected: active }}
      scaleTo={0.9}
    >
      <Animated.View style={[styles.dot, dotStyle]} />
    </PressableScale>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: setuColors.canvas,
  },
  root: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingBottom: 4,
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brandName: {
    color: setuColors.primaryInk,
    fontSize: 16,
    letterSpacing: -0.3,
  },

  pager: {
    flex: 1,
  },
  page: {
    paddingTop: 8,
  },
  art: {
    flex: 1,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  artImage: {
    width: "100%",
    height: "100%",
  },
  copy: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: setuColors.primaryInk,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  titleCompact: {
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  description: {
    color: setuColors.secondaryInk,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 420,
  },

  footer: {
    paddingTop: 8,
  },
  footerRow: {
    minHeight: 44,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  skip: {
    paddingVertical: 10,
    paddingLeft: 16,
  },
  skipText: {
    color: setuColors.secondaryInk,
    fontSize: 14,
  },

  cta: {
    height: CTA_HEIGHT,
    borderRadius: 18,
    overflow: "hidden",
  },
  ctaLabel: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: ON_ACCENT,
    fontSize: 15,
    letterSpacing: 0.1,
  },
})
