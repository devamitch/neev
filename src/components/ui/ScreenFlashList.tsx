import React, { forwardRef } from "react"
import { StyleSheet, ViewStyle } from "react-native"
import Animated from "react-native-reanimated"
import { FlashList, type FlashListProps, type FlashListRef } from "@shopify/flash-list"
import { useScreenRootScrollProps } from "./ScreenScrollContext"

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList as any)

export interface ScreenFlashListProps<T> extends Omit<FlashListProps<T>, "onScroll"> {
  applyBottomClearance?: boolean
  onScroll?: any
}

function ScreenFlashListInner<T>(
  { applyBottomClearance = true, contentContainerStyle, onScroll, ...rest }: ScreenFlashListProps<T>,
  ref: React.ForwardedRef<FlashListRef<T>>,
) {
  const rootProps = useScreenRootScrollProps()
  const userContent = (StyleSheet.flatten(contentContainerStyle) ?? {}) as ViewStyle
  const paddingBottom = applyBottomClearance
    ? Math.max(
        typeof userContent.paddingBottom === "number" ? userContent.paddingBottom : 0,
        rootProps.clearance,
      )
    : userContent.paddingBottom

  return (
    <AnimatedFlashList
      ref={ref}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScroll={onScroll ?? rootProps.onScroll}
      contentContainerStyle={[contentContainerStyle, { paddingBottom }]}
      {...(rest as any)}
    />
  )
}

export const ScreenFlashList = forwardRef(ScreenFlashListInner) as <T>(
  props: ScreenFlashListProps<T> & { ref?: React.ForwardedRef<FlashListRef<T>> },
) => React.ReactElement
