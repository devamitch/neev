import React, { forwardRef } from "react"
import { ScrollViewProps, StyleSheet, ViewStyle } from "react-native"
import Animated from "react-native-reanimated"
import { useScreenRootScrollProps } from "./ScreenScrollContext"

export interface ScreenScrollViewProps extends ScrollViewProps {
  applyBottomClearance?: boolean
}

function ScreenScrollViewInner(
  { applyBottomClearance = true, contentContainerStyle, onScroll, ...rest }: ScreenScrollViewProps,
  ref: React.ForwardedRef<any>,
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
    <Animated.ScrollView
      ref={ref}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScroll={onScroll ?? rootProps.onScroll}
      contentContainerStyle={[contentContainerStyle, { paddingBottom }]}
      {...rest}
    />
  )
}

export const ScreenScrollView = forwardRef(ScreenScrollViewInner)
