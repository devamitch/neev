import { isValidElement, useContext, type ReactNode } from "react"
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs"
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { useTabBarInset } from "@/components/navigation/CustomTabBar"
import {
  updateDockOnScroll,
  useShowChromeOnFocus,
} from "@/components/navigation/useScrollAwareDock"
import { useLayout } from "@/theme/layout"
import { useTheme } from "@/theme/useTheme"

import { AppHeader, type AppHeaderProps } from "./AppHeader"
import {
  CollapsingHeaderBar,
  CollapsingLargeTitle,
  headerContentTop,
  useCollapsingHeader,
} from "./CollapsingHeader"

export interface ScreenContainerProps {
  children?: ReactNode
  /**
   * Screen header. An `<AppHeader …/>` becomes the shared collapsing
   * large-title header; any other node is pinned above the content as-is.
   */
  header?: ReactNode
  /** Set false to let a header scroll away with the content instead. */
  stickyHeader?: boolean
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  headerContainerStyle?: StyleProp<ViewStyle>
  scrollable?: boolean
  safeArea?: boolean
  /** Whether scrolling down slides the bottom dock away (defaults to true). */
  autoHideTabBar?: boolean
  /** Override the computed bottom clearance (dock height on tab screens, safe area elsewhere). */
  bottomInset?: number
  /**
   * Primary action(s) pinned below the scrollable content — never part of the
   * scroll, so a Start/Stop/Play-again button is always one tap away instead
   * of requiring a scroll to the bottom of a tall screen. Carries its own
   * safe-area bottom padding and a frosted background.
   */
  footer?: ReactNode
}

/** Horizontal page gutter shared by every screen. */
export const SCREEN_GUTTER = 20

/**
 * Universal screen wrapper — the single place screen chrome behaves, so every
 * tab and stack screen gets the same header and dock motion:
 * - `<AppHeader>` headers collapse from a large title to a compact pinned
 *   toolbar title on scroll (never fully hidden).
 * - Scrolling down slides the dock away; scrolling up or reaching the top
 *   brings it back. Chrome is re-shown whenever the screen gains focus.
 * - Reserves room for the dock on tab screens and clears the navigation bar
 *   on pushed screens.
 */
export function ScreenContainer({
  children,
  header,
  stickyHeader = true,
  style,
  contentContainerStyle,
  headerContainerStyle,
  scrollable = false,
  safeArea = true,
  autoHideTabBar = true,
  bottomInset,
  footer,
}: ScreenContainerProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const dockInset = useTabBarInset()
  const isTabScreen = useContext(BottomTabBarHeightContext) !== undefined
  const reduceMotion = useReducedMotion()
  const layout = useLayout()
  useShowChromeOnFocus()
  // Phones use the full width; tablets centre a readable column.
  const column: ViewStyle = {
    alignSelf: "center",
    maxWidth: layout.columnWidth,
    paddingHorizontal: layout.gutter,
    width: "100%",
  }

  // A footer is a real flex sibling below the scroll area and carries its own
  // safe-area padding, so the scroll content only needs its own breathing
  // room — not the dock/safe-area clearance the footer already absorbs.
  const clearance =
    bottomInset ?? (footer ? 24 : isTabScreen ? dockInset : insets.bottom + 32)
  const userContent = (StyleSheet.flatten(contentContainerStyle) ?? {}) as ViewStyle
  const paddingBottom = Math.max(
    typeof userContent.paddingBottom === "number" ? userContent.paddingBottom : 0,
    clearance,
  )
  const footerNode = footer ? (
    <View
      style={[
        styles.footerWrapper,
        { backgroundColor: colors.background, borderTopColor: colors.border },
      ]}
    >
      <View
        style={[
          column,
          styles.footerContent,
          { paddingBottom: Math.max(safeArea ? insets.bottom : 0, 16) + 6 },
        ]}
      >
        {footer}
      </View>
    </View>
  ) : null

  const headerProps =
    stickyHeader &&
    isValidElement(header) &&
    (header.type === AppHeader ||
      (typeof (header.props as AppHeaderProps)?.title === "string" &&
        ("showBack" in (header.props as object) ||
          "eyebrow" in (header.props as object) ||
          "subtitle" in (header.props as object))))
      ? (header.props as AppHeaderProps)
      : null
  const statusInset = safeArea ? insets.top : 0

  const scrollY = useSharedValue(0)
  const lastY = useSharedValue(0)
  const hideDock = autoHideTabBar && !reduceMotion
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y
      if (hideDock) updateDockOnScroll(e.contentOffset.y, lastY)
    },
  })
  const { titleHeight, progress } = useCollapsingHeader(scrollY)

  const ContainerComponent = safeArea ? SafeAreaView : View
  const ownsTopInset = Boolean(headerProps) || (Boolean(header) && stickyHeader)
  const containerProps = safeArea
    ? { edges: ownsTopInset ? (["left", "right"] as const) : (["top", "left", "right"] as const) }
    : {}
  const rootStyle = [styles.root, { backgroundColor: colors.background }, style]

  /* ── Collapsing large-title header (every AppHeader) ─────────────── */
  if (headerProps) {
    const contentTop = headerContentTop(headerProps, statusInset)
    const largeTitle = (
      <CollapsingLargeTitle props={headerProps} scrollY={scrollY} titleHeight={titleHeight} />
    )
    return (
      <ContainerComponent {...containerProps} style={rootStyle}>
        {scrollable ? (
          <Animated.ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              column,
              userContent,
              { paddingTop: contentTop, paddingBottom },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {largeTitle}
            {children}
          </Animated.ScrollView>
        ) : (
          <View style={[styles.fixedColumn, column, { paddingTop: contentTop }]}>
            <View>{largeTitle}</View>
            <View
              style={[
                styles.nonScrollContent,
                styles.noTop,
                styles.noSide,
                userContent,
                { paddingBottom },
              ]}
            >
              {children}
            </View>
          </View>
        )}
        {footerNode}
        <CollapsingHeaderBar
          props={headerProps}
          progress={progress}
          statusInset={statusInset}
          gutter={layout.sideInset}
        />
      </ContainerComponent>
    )
  }

  /* ── Any other header node: pinned above the content ─────────────── */
  const pinned =
    header && stickyHeader ? (
      <View
        style={[
          styles.pinnedHeader,
          { backgroundColor: colors.background, paddingTop: statusInset + 4 },
          headerContainerStyle,
        ]}
      >
        {header}
      </View>
    ) : null

  if (scrollable) {
    return (
      <ContainerComponent {...containerProps} style={rootStyle}>
        {pinned}
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, column, userContent, { paddingBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {stickyHeader ? null : header}
          {children}
        </Animated.ScrollView>
        {footerNode}
      </ContainerComponent>
    )
  }

  return (
    <ContainerComponent {...containerProps} style={rootStyle}>
      {pinned}
      <View style={[styles.nonScrollContent, column, userContent, { paddingBottom }]}>
        {stickyHeader ? null : header}
        {children}
      </View>
      {footerNode}
    </ContainerComponent>
  )
}

const styles = StyleSheet.create({
  fixedColumn: { flex: 1 },
  footerContent: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 12,
  },
  footerWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    width: "100%",
  },
  noSide: { paddingHorizontal: 0 },
  noTop: { paddingTop: 0 },
  nonScrollContent: {
    flex: 1,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 8,
  },
  pinnedHeader: {
    paddingBottom: 4,
    paddingHorizontal: SCREEN_GUTTER,
    zIndex: 10,
  },
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 8,
  },
})
