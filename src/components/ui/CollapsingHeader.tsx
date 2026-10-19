/**
 * Large-title → small-title header, the one header behaviour every screen gets
 * through `ScreenContainer`.
 *
 * - At rest: a big title (with eyebrow and subtitle) sits at the top of the
 *   content; the toolbar holds only back / actions.
 * - On scroll: the big title scrolls away and fades, and a compact centred
 *   title fades into the pinned toolbar with a hairline under it. The toolbar
 *   never hides, so back and actions are always one tap away.
 * - Pulling down past the top gently enlarges the big title.
 * Everything is driven on the UI thread by the screen's scroll offset.
 */
import { isValidElement, useState } from "react"
import { Image, LayoutChangeEvent, Platform, StyleSheet, View, type ImageSourcePropType } from "react-native"

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
  const hasControls = Boolean(props.showBack || props.rightAction)
  return statusInset + (hasControls ? HEADER_BAR_HEIGHT : 6)
}

export function useCollapsingHeader(scrollY: SharedValue<number>) {
  const titleHeight = useSharedValue(64)
  const progress = useDerivedValue(() => {
    const h = Math.max(titleHeight.value, 40)
    return interpolate(scrollY.value, [h * 0.3, h * 0.8], [0, 1], clamp)
  })
  return { titleHeight, progress }
}

export function CollapsingLargeTitle({
  props,
  scrollY,
  titleHeight,
}: {
  props: AppHeaderProps
  scrollY: SharedValue<number>
  titleHeight: SharedValue<number>
}) {
  const onLayout = (e: LayoutChangeEvent) => {
    titleHeight.value = e.nativeEvent.layout.height
  }
  const style = useAnimatedStyle(() => {
    const y = scrollY.value
    const h = Math.max(titleHeight.value, 40)
    return {
      opacity: interpolate(y, [0, h * 0.85], [1, 0], clamp),
      transform: [{ scale: interpolate(y, [-140, 0], [1.08, 1], clamp) }],
    }
  })
  return (
    <Animated.View style={[styles.largeTitle, styles.originLeft, style]}>
      <View onLayout={onLayout}>
        <HeaderLargeTitle eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
      </View>
    </Animated.View>
  )
}

export function CollapsingHeaderBar({
  props,
  progress,
  statusInset,
  gutter,
}: {
  props: AppHeaderProps
  progress: SharedValue<number>
  statusInset: number
  gutter: number
}) {
  const { colors } = useTheme()
  const hasControls = Boolean(props.showBack || props.rightAction)
  const [rightWidth, setRightWidth] = useState(0)
  const titleInset = gutter + Math.max(props.showBack ? HEADER_BUTTON_SIZE : 0, rightWidth) + 12

  // With controls the bar is a real row the content scrolls beneath, so it is
  // always opaque; without, it only materialises as the title collapses.
  const barBg = useAnimatedStyle(() => ({ opacity: hasControls ? 1 : progress.value }))
  const hairline = useAnimatedStyle(() => ({ opacity: progress.value }))
  const smallTitle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }))

  const renderLogo = () => {
    if (props.logo === false || props.showLogo === false) {
      return null
    }
    if (isValidElement(props.logo)) {
      return <View style={styles.logoContainer}>{props.logo}</View>
    }
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
      <Image
        source={require("@assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Neev logo"
      />
    )
  }

  const sideWidth = Math.max(props.showBack ? HEADER_BUTTON_SIZE : 0, rightWidth)

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
        {/* Frosted bar: clean surface wash with native blur where supported */}
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={60}
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
        <View style={styles.leftAction} pointerEvents="box-none">
          {props.showBack ? <HeaderBackButton /> : null}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.smallTitle, { left: sideWidth + gutter, right: sideWidth + gutter }, smallTitle]}
        >
          <View style={styles.titleRow}>
            {renderLogo()}
            <AppText variant="h3" numberOfLines={1} style={[styles.center, props.titleStyle]}>
              {props.title}
            </AppText>
          </View>
        </Animated.View>

        <View
          style={styles.right}
          onLayout={(e) => setRightWidth(Math.round(e.nativeEvent.layout.width))}
          pointerEvents="box-none"
        >
          {props.rightAction}
        </View>
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
  center: {
    fontFamily: "spaceGroteskSemiBold",
    flexShrink: 1,
    textAlign: "center",
  },
  hairline: {
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: "absolute",
    right: 0,
  },
  largeTitle: { marginBottom: 20 },
  logo: {
    borderRadius: 6,
    height: 24,
    marginRight: 8,
    width: 24,
  },
  logoContainer: {
    marginRight: 8,
  },
  originLeft: { transformOrigin: "left top" },
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
