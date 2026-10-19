import { useCallback, useContext, useEffect, useRef } from "react"
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native"
import { NavigationContext } from "@react-navigation/native"
import {
  Easing,
  makeMutable,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

/**
 * Shared "screen chrome" progress, driven by the active screen's scroll:
 * 0 = header and dock fully shown, 1 = both tucked away.
 * The dock slides down off-screen and the sticky header slides up under the
 * status bar, so both move together with one timing on every screen.
 */
export const tabBarScrollProgress: SharedValue<number> = makeMutable(0)
export const dockTarget: SharedValue<number> = makeMutable(0)

const TIMING_SHOW = { duration: 240, easing: Easing.out(Easing.cubic) } as const
const TIMING_HIDE = { duration: 220, easing: Easing.out(Easing.cubic) } as const

/**
 * Show the bottom dock tab bar.
 */
export function showTabBar(immediate = false): void {
  "worklet"
  if (dockTarget.value === 0 && !immediate) return
  dockTarget.value = 0
  tabBarScrollProgress.value = immediate ? 0 : withTiming(0, TIMING_SHOW)
}

/**
 * Hide the bottom dock tab bar off-screen.
 */
/**
 * Hide the bottom dock tab bar off-screen.
 * (Persistent dock mode: Keep dock visible so tabs never get trapped/lost)
 */
export function hideTabBar(_immediate = false): void {
  "worklet"
  // Keep tab bar accessible at all times - dock auto-hide commented out for stable UX
  // if (dockTarget.value === 1 && !immediate) return
  // dockTarget.value = 1
  // tabBarScrollProgress.value = immediate ? 1 : withTiming(1, TIMING_HIDE)
  dockTarget.value = 0
  tabBarScrollProgress.value = 0
}

/**
 * Re-shows the chrome whenever the hosting screen gains focus, so a screen
 * never opens with the header or dock still tucked away by the previous one.
 * Safe outside a navigator (error boundary, previews): it simply does nothing.
 */
export function useShowChromeOnFocus(): void {
  const navigation = useContext(NavigationContext)
  useEffect(() => {
    if (!navigation) return
    if (navigation.isFocused()) showTabBar(true)
    return navigation.addListener("focus", () => showTabBar(true))
  }, [navigation])
}

/**
 * Worklet to update dock visibility based on current and previous scroll positions.
 */
export function updateDockOnScroll(
  currentY: number,
  lastY: SharedValue<number>,
  threshold = 12,
): void {
  "worklet"
  if (currentY < 0) {
    lastY.value = 0
    return
  }

  const diff = currentY - lastY.value

  if (currentY <= 24) {
    showTabBar()
    lastY.value = currentY
    return
  }

  if (diff > threshold && currentY > 48) {
    hideTabBar()
  } else if (diff < -threshold) {
    showTabBar()
  }

  lastY.value = currentY
}

/**
 * React hook for standard ScrollView/FlatList components to auto-hide the dock on scroll.
 */
export function useScrollAwareTabBar(threshold = 12) {
  const reduceMotion = useReducedMotion()
  const lastOffsetY = useRef(0)

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (reduceMotion) return
      const currentY = event.nativeEvent.contentOffset.y
      if (currentY < 0) {
        lastOffsetY.current = 0
        return
      }
      const diff = currentY - lastOffsetY.current

      if (currentY <= 24) {
        showTabBar()
        lastOffsetY.current = currentY
        return
      }

      if (diff > threshold && currentY > 48) {
        hideTabBar()
      } else if (diff < -threshold) {
        showTabBar()
      }

      lastOffsetY.current = currentY
    },
    [threshold, reduceMotion],
  )

  return { onScroll, scrollEventThrottle: 16 }
}
