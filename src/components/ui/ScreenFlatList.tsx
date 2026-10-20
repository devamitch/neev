import React, { forwardRef, isValidElement, useMemo } from "react"
import { FlatList, FlatListProps, StyleSheet, View, ViewStyle } from "react-native"
import Animated from "react-native-reanimated"
import { useScreenRootScrollProps, useScreenScrollContext } from "./ScreenScrollContext"
import { CollapsingLargeTitle } from "./CollapsingHeader"

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList)

export interface ScreenFlatListProps<T> extends Omit<FlatListProps<T>, "onScroll"> {
  applyBottomClearance?: boolean
  onScroll?: any
}

function ScreenFlatListInner<T>(
  {
    applyBottomClearance = true,
    contentContainerStyle,
    onScroll,
    ListHeaderComponent,
    ...rest
  }: ScreenFlatListProps<T>,
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
    <AnimatedFlatList
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

export const ScreenFlatList = forwardRef(ScreenFlatListInner) as <T>(
  props: ScreenFlatListProps<T> & { ref?: React.ForwardedRef<any> },
) => React.ReactElement
