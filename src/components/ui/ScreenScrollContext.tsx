import { createContext, useContext } from "react"
import type { SharedValue } from "react-native-reanimated"
import { useAnimatedScrollHandler } from "react-native-reanimated"

export type ScreenScrollHandler = ReturnType<typeof useAnimatedScrollHandler>

export interface ScreenScrollContextValue {
  scrollY: SharedValue<number>
  onRootScroll: ScreenScrollHandler
  clearance: number
  gutter: number
}

export const ScreenScrollContext = createContext<ScreenScrollContextValue | null>(null)

export function useScreenScrollContext() {
  return useContext(ScreenScrollContext)
}

/**
 * Hook for root list components (ScreenFlatList, ScreenSectionList, ScreenFlashList)
 * to attach the canonical Reanimated scroll handler and retrieve shared clearance.
 */
export function useScreenRootScrollProps() {
  const context = useContext(ScreenScrollContext)
  if (!context) {
    return {
      onScroll: undefined,
      scrollEventThrottle: 16 as const,
      clearance: 24,
      gutter: 20,
      scrollY: null,
    }
  }
  return {
    onScroll: context.onRootScroll,
    scrollEventThrottle: 16 as const,
    clearance: context.clearance,
    gutter: context.gutter,
    scrollY: context.scrollY,
  }
}
