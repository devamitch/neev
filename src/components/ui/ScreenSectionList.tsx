import React, { forwardRef } from "react"
import { SectionList, SectionListProps, StyleSheet, ViewStyle } from "react-native"
import Animated from "react-native-reanimated"
import { useScreenRootScrollProps } from "./ScreenScrollContext"

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList)

export interface ScreenSectionListProps<ItemT, SectionT = any>
  extends Omit<SectionListProps<ItemT, SectionT>, "onScroll"> {
  applyBottomClearance?: boolean
  onScroll?: any
}

function ScreenSectionListInner<ItemT, SectionT = any>(
  {
    applyBottomClearance = true,
    contentContainerStyle,
    onScroll,
    ...rest
  }: ScreenSectionListProps<ItemT, SectionT>,
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
    <AnimatedSectionList
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

export const ScreenSectionList = forwardRef(ScreenSectionListInner) as <ItemT, SectionT = any>(
  props: ScreenSectionListProps<ItemT, SectionT> & { ref?: React.ForwardedRef<any> },
) => React.ReactElement
