import React, { forwardRef, useCallback, useRef } from "react"
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, ViewStyle } from "react-native"
import { FlashList, type FlashListProps, type FlashListRef } from "@shopify/flash-list"
import { useScreenRootScrollProps } from "./ScreenScrollContext"
import { hideTabBar, showTabBar } from "@/components/navigation/useScrollAwareDock"

export interface ScreenFlashListProps<T> extends FlashListProps<T> {
  applyBottomClearance?: boolean
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

  const lastYRef = useRef(0)

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y
      if (rootProps.scrollY) {
        rootProps.scrollY.value = y
      }
      const diff = y - lastYRef.current
      if (y <= 24) {
        showTabBar()
      } else if (diff > 12 && y > 48) {
        hideTabBar()
      } else if (diff < -12) {
        showTabBar()
      }
      lastYRef.current = y
      onScroll?.(e)
    },
    [onScroll, rootProps.scrollY],
  )

  return (
    <FlashList<T>
      ref={ref}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScroll={handleScroll}
      contentContainerStyle={[contentContainerStyle, { paddingBottom }]}
      {...rest}
    />
  )
}

export const ScreenFlashList = forwardRef(ScreenFlashListInner) as <T>(
  props: ScreenFlashListProps<T> & { ref?: React.ForwardedRef<FlashListRef<T>> },
) => React.ReactElement
