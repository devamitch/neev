/**
 * First-run intro slider.
 *
 * - One calm palette: a single canvas colour for every slide, one pista button
 *   colour, and terracotta only as a small accent (eyebrow + active dot). Nothing
 *   changes colour while swiping.
 * - Artwork sits in a rounded squircle card so each scene reads as intentional.
 * - Edge-to-edge: the root paints behind the status bar and the Android
 *   navigation bar. Content is inset with safe-area values.
 * - No Reanimated worklet callbacks into JS (no runOnJS / scheduleOnRN): the
 *   exit fade is a timing animation plus a JS timer, so it cannot break across
 *   Reanimated / Worklets version changes.
 * - Reduced-motion aware: parallax and scale are switched off, fades remain.
 * - Android back steps to the previous slide before leaving the screen.
 */

import { PressableScale } from "@/components/ui/PressableScale"
import { Image } from "expo-image"
import { memo, useCallback, useEffect, useRef, useState } from "react"
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
  eyebrow: string
  title: string
  description: string
  image: ImageSourcePropType
}

const SLIDES: readonly IntroSlide[] = [
  {
    id: "home",
    eyebrow: "Your family, together",
    title: "One home for the whole family",
    description:
      "Schedules, chores and plans for parents, grandparents and kids — shared only with the people you invite.",
    image: AssetIllustrations.sanctuaryHome,
  },
  {
    id: "plan",
    eyebrow: "Plan together",
    title: "Functions without the chaos",
    description:
      "Plan birthdays, weddings and school events, and split the tasks so everyone knows who's doing what.",
    image: AssetIllustrations.functionsRituals,
  },
  {
    id: "remember",
    eyebrow: "Keep what matters",
    title: "Recipes, stories and contacts",
    description:
      "Save family recipes, stories and important numbers in one private place the whole family can rely on.",
    image: AssetIllustrations.heirloomVault,
  },
]

const SLIDE_COUNT = SLIDES.length
const LAST = SLIDE_COUNT - 1

// ─── Tokens ─────────────────────────────────────────────────────────────────

const EXIT_MS = 260
const SIDE_PADDING = 28
const DOT_SIZE = 8
const DOT_ACTIVE = 24
const CTA_HEIGHT = 56
const INACTIVE_DOT = "rgba(26, 24, 21, 0.14)"
const ON_ACCENT = "#FFFFFF"
/** Pista button colour (4.6:1 against white text). */
const CTA_COLOR = "#5A7A64"
/** Terracotta — used sparingly as the one accent. */
const ACCENT = setuColors.accentText

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
    opacity: rootOpacity.value,
  }))

  const ctaStyle = useAnimatedStyle(() => ({
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
            accessibilityLabel="Neev logo"
          />
          <AppText variant="label" style={styles.brandName}>
            Neev
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
        <View style={styles.artCard}>
          <Image
            source={slide.image}
            style={styles.artImage}
            contentFit="cover"
            priority="high"
            transition={0}
            accessible={false}
          />
        </View>
      </Animated.View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <AppText variant="overline" maxFontSizeMultiplier={1.2} style={styles.eyebrow}>
          {slide.eyebrow}
        </AppText>
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
  active: boolean
  onPress: (index: number) => void
}

function PaginationDot({ index, width, scrollX, active, onPress }: PaginationDotProps) {
  const dotStyle = useAnimatedStyle(() => {
    const f = interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP,
    )
    return {
      width: DOT_SIZE + (DOT_ACTIVE - DOT_SIZE) * f,
      backgroundColor: interpolateColor(f, [0, 1], [INACTIVE_DOT, ACCENT]),
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
    backgroundColor: setuColors.canvas,
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
    paddingVertical: 8,
  },
  artCard: {
    aspectRatio: 1,
    borderCurve: "continuous",
    borderRadius: 36,
    height: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    backgroundColor: setuColors.surface2,
  },
  artImage: {
    width: "100%",
    height: "100%",
  },
  eyebrow: {
    color: ACCENT,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
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
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: CTA_COLOR,
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
