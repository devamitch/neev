import React, { forwardRef, isValidElement, useMemo } from "react"
import { SectionList, SectionListProps, StyleSheet, View, ViewStyle } from "react-native"
import Animated from "react-native-reanimated"
import { useScreenRootScrollProps, useScreenScrollContext } from "./ScreenScrollContext"
import { CollapsingLargeTitle } from "./CollapsingHeader"

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
    ListHeaderComponent,
    ...rest
  }: ScreenSectionListProps<ItemT, SectionT>,
  ref: React.ForwardedRef<any>,
) {
  const rootProps = useScreenRootScrollProps()
  const scrollContext = useScreenScrollContext()
  const headerProps = scrollContext?.headerProps
  const scrollY = scrollContext?.scrollY

  const userContent = (StyleSheet.flatten(contentContainerStyle) ?? {}) as ViewStyle
  const paddingBottom = applyBottomClearance
    ? Math.max(
        typeof userContent.paddingBottom === "number" ? userContent.paddingBottom : 0,
        rootProps.clearance,
      )
    : userContent.paddingBottom

  const combinedHeader = useMemo(() => {
    const largeTitle =
      headerProps && scrollY ? (
        <CollapsingLargeTitle props={headerProps} scrollY={scrollY} />
      ) : null

    if (!largeTitle) {
      return ListHeaderComponent
    }

    const originalHeader = isValidElement(ListHeaderComponent)
      ? ListHeaderComponent
      : typeof ListHeaderComponent === "function"
        ? (ListHeaderComponent as any)()
        : null

    return (
      <View>
        {largeTitle}
        {originalHeader}
      </View>
    )
  }, [ListHeaderComponent, headerProps, scrollY])

  return (
    <AnimatedSectionList
      ref={ref}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScroll={onScroll ?? rootProps.onScroll}
      ListHeaderComponent={combinedHeader}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: rootProps.contentTop, paddingBottom },
      ]}
      {...(rest as any)}
    />
  )
}

export const ScreenSectionList = forwardRef(ScreenSectionListInner) as <ItemT, SectionT = any>(
  props: ScreenSectionListProps<ItemT, SectionT> & { ref?: React.ForwardedRef<any> },
) => React.ReactElement
