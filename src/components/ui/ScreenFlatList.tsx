import React, { forwardRef } from "react"
import { FlatList, FlatListProps, StyleSheet, ViewStyle } from "react-native"
import Animated from "react-native-reanimated"
import { useScreenRootScrollProps } from "./ScreenScrollContext"

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList)

export interface ScreenFlatListProps<T> extends Omit<FlatListProps<T>, "onScroll"> {
  applyBottomClearance?: boolean
  onScroll?: any
}

function ScreenFlatListInner<T>(
  { applyBottomClearance = true, contentContainerStyle, onScroll, ...rest }: ScreenFlatListProps<T>,
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
    <AnimatedFlatList
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

export const ScreenFlatList = forwardRef(ScreenFlatListInner) as <T>(
  props: ScreenFlatListProps<T> & { ref?: React.ForwardedRef<any> },
) => React.ReactElement
