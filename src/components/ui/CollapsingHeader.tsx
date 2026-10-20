/**
 * Apple-Style Large Title Collapsing Header for Neev
 *
 * - At rest: Prominent, spacious large title with eyebrow and subtitle sits
 *   at the top of the scrollable content; top toolbar is transparent with zero
 *   wasted gaps on the left (no 40px placeholder when showBack is false).
 * - On scroll: Large title smoothly scrolls away and fades out on the UI thread,
 *   while the compact title fades into the pinned top toolbar with a frosted
 *   glass blur and hairline border.
 * - Pulling down (overscroll) scales the large title with natural spring resistance.
 */
import React, { isValidElement, useState } from "react"
import {
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native"

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated"

import { useTheme } from "@/theme/useTheme"
import { BlurView } from "expo-blur"
import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
import {
  HEADER_BAR_HEIGHT,
  HEADER_BUTTON_SIZE,
  HeaderBackButton,
  HeaderLargeTitle,
  type AppHeaderProps,
} from "./AppHeader"
import { AppText } from "./AppText"

const clamp = Extrapolation.CLAMP

/** Where content starts below the status bar for a given header. */
export function headerContentTop(props: AppHeaderProps, statusInset: number): number {
  const hasControls = Boolean(props.showBack || props.rightAction || props.showLogo !== false)
  return statusInset + (hasControls ? HEADER_BAR_HEIGHT + 4 : 8)
}

export function useCollapsingHeader(scrollY: SharedValue<number>) {
  const titleHeight = useSharedValue(64)
  const progress = useDerivedValue(() => {
    const h = Math.max(titleHeight.value, 40)
    return interpolate(scrollY.value, [h * 0.25, h * 0.85], [0, 1], clamp)
  })
  return { titleHeight, progress }
}

/**
 * Large title rendered directly in the scroll view content.
 * Has generous room, never truncated on first view, fades smoothly on scroll.
 */
export function CollapsingLargeTitle({
  props,
  scrollY,
  titleHeight,
}: {
  props: AppHeaderProps
  scrollY: SharedValue<number>
  titleHeight?: SharedValue<number>
}) {
  const onLayout = (e: LayoutChangeEvent) => {
    if (titleHeight) {
      titleHeight.value = e.nativeEvent.layout.height
    }
  }

  const style = useAnimatedStyle(() => {
    const y = scrollY.value
    return {
      opacity: interpolate(y, [0, 48], [1, 0], clamp),
      transform: [
        { translateY: interpolate(y, [0, 48], [0, -10], clamp) },
        { scale: interpolate(y, [-140, 0], [1.07, 1], clamp) },
      ],
    }
  })

  return (
    <Animated.View style={[styles.largeTitleWrapper, styles.originLeft, style]}>
      <View onLayout={onLayout}>
        <HeaderLargeTitle eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
      </View>
    </Animated.View>
  )
}

export function CollapsingHeaderBar({
  props,
  progress,
  scrollY,
  statusInset,
  gutter,
}: {
  props: AppHeaderProps
  progress: SharedValue<number>
  scrollY?: SharedValue<number>
  statusInset: number
  gutter: number
}) {
  const { colors } = useTheme()
  const [rightWidth, setRightWidth] = useState(props.rightAction ? HEADER_BUTTON_SIZE : 0)

  // Top bar background: serene translucent wash at rest, elevated frosted blur on scroll
  const barBg = useAnimatedStyle(() => {
    if (scrollY) {
      return { opacity: interpolate(scrollY.value, [0, 36], [0.88, 1], clamp) }
    }
    return { opacity: 1 }
  })

  // Hairline border fades in on scroll
  const hairline = useAnimatedStyle(() => {
    if (scrollY) {
      return { opacity: interpolate(scrollY.value, [10, 40], [0, 1], clamp) }
    }
    return { opacity: progress.value }
  })

  // Compact title fades in on scroll
  const smallTitleStyle = useAnimatedStyle(() => {
    if (scrollY) {
      return {
        opacity: interpolate(scrollY.value, [28, 56], [0, 1], clamp),
        transform: [{ translateY: interpolate(scrollY.value, [28, 56], [6, 0], clamp) }],
      }
    }
    return {
      opacity: progress.value,
      transform: [{ translateY: (1 - progress.value) * 6 }],
    }
  })

  const renderLogo = () => {
    if (props.showLogo === false) return null
    if (isValidElement(props.logo)) return <View style={styles.logoContainer}>{props.logo}</View>
    if (props.logo && typeof props.logo !== "boolean") {
      const source =
        typeof props.logo === "string" ? { uri: props.logo } : (props.logo as ImageSourcePropType)
      return (
        <Image
          source={source}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Header logo"
        />
      )
    }
    return (
      <View style={styles.logoContainer}>
        <NeevLogoIcon size={34} withBackground playful interactive />
      </View>
    )
  }

  const hasLeft = Boolean(props.showBack || props.showLogo !== false || props.logo)
  const sideWidth = Math.max(hasLeft ? HEADER_BUTTON_SIZE : 0, rightWidth)

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.bar,
        {
          height: HEADER_BAR_HEIGHT + statusInset,
          paddingTop: statusInset,
        },
      ]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, barBg]}>
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={Platform.OS === "android" ? 50 : 70}
          tint="light"
          blurMethod={Platform.OS === "android" ? "none" : undefined}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.94 }]}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.hairline, { backgroundColor: colors.border }, hairline]}
      />

      {/* Toolbar row with height locked to HEADER_BAR_HEIGHT */}
      <View style={[styles.toolbar, { paddingHorizontal: gutter }]} pointerEvents="box-none">
        {hasLeft ? (
          <View style={styles.leftAction} pointerEvents="box-none">
            {props.showBack ? <HeaderBackButton /> : renderLogo()}
          </View>
        ) : (
          <View style={styles.zeroWidth} />
        )}

        {/* Compact center title that appears when scrolled */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.smallTitle,
            { left: sideWidth + gutter, right: sideWidth + gutter },
            smallTitleStyle,
          ]}
        >
          <View style={styles.titleRow}>
            {props.showBack && renderLogo()}
            <AppText
              variant="h3"
              numberOfLines={1}
              style={[styles.compactTitleText, { color: colors.text.primary }, props.titleStyle]}
            >
              {props.title}
            </AppText>
          </View>
        </Animated.View>

        {props.rightAction ? (
          <View
            style={styles.right}
            onLayout={(e) => setRightWidth(Math.round(e.nativeEvent.layout.width))}
            pointerEvents="box-none"
          >
            {props.rightAction}
          </View>
        ) : (
          <View style={styles.zeroWidth} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    height: HEADER_BAR_HEIGHT,
    justifyContent: "space-between",
    position: "relative",
    width: "100%",
  },
  leftAction: {
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: HEADER_BUTTON_SIZE,
  },
  zeroWidth: {
    width: 0,
    height: 0,
  },
  compactTitleText: {
    fontFamily: "spaceGroteskSemiBold",
    fontSize: 16.5,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  hairline: {
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: "absolute",
    right: 0,
  },
  largeTitleWrapper: {
    marginBottom: 8,
  },
  logo: {
    borderRadius: 6,
    height: 24,
    marginRight: 8,
    width: 24,
  },
  logoContainer: {
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  originLeft: {
    transformOrigin: "left top",
  },
  right: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    minWidth: HEADER_BUTTON_SIZE,
  },
  smallTitle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    maxWidth: "100%",
  },
})
