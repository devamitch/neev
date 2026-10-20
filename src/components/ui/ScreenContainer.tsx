import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs"
import { isValidElement, useContext, useEffect, type ReactNode } from "react"
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native"
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
import { SanctuaryHeader } from "./SanctuaryHeader"
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
  /**
   * Explicit scrolling ownership:
   * - 'shell-scroll-view': Shell wraps children in an Animated.ScrollView (short/static pages only).
   * - 'external': Shell provides bounded flex: 1 body and ScreenScrollContext; one root list scroller owns scroll.
   * - 'none': Fixed views, maps or custom layouts.
   */
  scrollMode?: "shell-scroll-view" | "external" | "none"
  /** Header presentation mode: compact pinned toolbar, collapsing large title, or none. */
  headerMode?: "compact" | "collapsing" | "none" | "custom"
  /** Bottom dock policy. */
  dockBehavior?: "always" | "auto-hide" | "hidden"
}

/** Horizontal page gutter shared by every screen. */
export const SCREEN_GUTTER = 20

import { hideTabBar, showTabBar } from "@/components/navigation/useScrollAwareDock"
import { ScreenScrollContext } from "./ScreenScrollContext"

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
  scrollMode,
  headerMode,
  dockBehavior,
}: ScreenContainerProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const dockInset = useTabBarInset()
  const isTabScreen = useContext(BottomTabBarHeightContext) !== undefined
  const reduceMotion = useReducedMotion()
  const layout = useLayout()
  useShowChromeOnFocus()

  // Handle dockBehavior
  useEffect(() => {
    if (dockBehavior === "hidden") {
      hideTabBar(true)
    } else if (dockBehavior === "always") {
      showTabBar(true)
    }
  }, [dockBehavior])

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
  const clearance = bottomInset ?? (footer ? 24 : isTabScreen ? dockInset : insets.bottom + 32)
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
    (header.type === AppHeader || typeof (header.props as AppHeaderProps)?.title === "string")
      ? (header.props as AppHeaderProps)
      : null
  const statusInset = safeArea ? insets.top : 0

  const scrollY = useSharedValue(0)
  const lastY = useSharedValue(0)
  const shouldAutoHide =
    dockBehavior === "hidden"
      ? false
      : dockBehavior === "always"
        ? false
        : dockBehavior === "auto-hide"
          ? !reduceMotion
          : autoHideTabBar && !reduceMotion

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y
      if (shouldAutoHide) updateDockOnScroll(e.contentOffset.y, lastY)
    },
  })
  const { titleHeight, progress } = useCollapsingHeader(scrollY)

  const ContainerComponent = safeArea ? SafeAreaView : View
  const ownsTopInset = Boolean(headerProps) || (Boolean(header) && stickyHeader)
  const containerProps = safeArea
    ? { edges: ownsTopInset ? (["left", "right"] as const) : (["top", "left", "right"] as const) }
    : {}
  const rootStyle = [styles.root, { backgroundColor: colors.background }, style]

  const resolvedScrollMode = scrollMode ?? (scrollable ? "shell-scroll-view" : "external")
  const isSanctuaryHeader =
    isValidElement(header) &&
    (header.type === SanctuaryHeader ||
      (typeof header.type === "object" && (header.type as any)?.name === "SanctuaryHeader") ||
      Boolean((header.props as any)?.mascotSize))

  const isExplicitCompact =
    headerMode === "compact" ||
    headerProps?.compact === true ||
    headerProps?.variant === "compact"

  const isCollapsingHeader =
    !isSanctuaryHeader &&
    Boolean(headerProps) &&
    !isExplicitCompact &&
    headerMode !== "none" &&
    headerMode !== "custom"

  const contextValue = {
    scrollY,
    onRootScroll: onScroll,
    clearance,
    gutter: layout.gutter,
  }

  /* ── Header: Pinned compact or custom node ─────────────── */
  const pinnedHeaderNode =
    header && stickyHeader && headerMode !== "none" ? (
      isSanctuaryHeader ? (
        <View style={[styles.sanctuaryHeaderWrapper, headerContainerStyle]}>
          {header}
        </View>
      ) : (
        <View
          style={[
            styles.pinnedHeader,
            { backgroundColor: colors.background, paddingTop: statusInset + 4 },
            headerContainerStyle,
          ]}
        >
          {header}
        </View>
      )
    ) : null

  /* ── Collapsing animated header (when not compact) ─────────────── */
  if (isCollapsingHeader && headerProps) {
    const contentTop = headerContentTop(headerProps, statusInset)
    const largeTitle = (
      <CollapsingLargeTitle props={headerProps} scrollY={scrollY} titleHeight={titleHeight} />
    )
    return (
      <ScreenScrollContext.Provider value={{ ...contextValue, headerProps, contentTop }}>
        <ContainerComponent {...containerProps} style={rootStyle}>
          {resolvedScrollMode === "shell-scroll-view" ? (
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
          ) : resolvedScrollMode === "external" ? (
            <View style={[styles.externalBody, column]}>
              {children}
            </View>
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
            scrollY={scrollY}
            statusInset={statusInset}
            gutter={layout.sideInset}
          />
        </ContainerComponent>
      </ScreenScrollContext.Provider>
    )
  }

  /* ── Standard / Compact Header Flow ─────────────── */
  return (
    <ScreenScrollContext.Provider value={contextValue}>
      <ContainerComponent {...containerProps} style={rootStyle}>
        {pinnedHeaderNode}
        {resolvedScrollMode === "shell-scroll-view" ? (
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
        ) : resolvedScrollMode === "external" ? (
          <View style={[styles.externalBody, column]}>{children}</View>
        ) : (
          <View style={[styles.nonScrollContent, column, userContent, { paddingBottom }]}>
            {stickyHeader ? null : header}
            {children}
          </View>
        )}
        {footerNode}
      </ContainerComponent>
    </ScreenScrollContext.Provider>
  )
}

const styles = StyleSheet.create({
  externalBody: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
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
  sanctuaryHeaderWrapper: {
    width: "100%",
    zIndex: 20,
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
