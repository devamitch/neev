/**
 * Neev Family Sanctuary Bottom Dock (Traced identically from BlinkQuest canonical dock architecture):
 * - Edge-to-edge, anchored to bottom: no side or bottom gaps; runs under system navigation area
 * - 70px content row, rounded top corners
 * - Raised hump: raised-cosine wave wrapping the 60px central action orb
 * - Refined Pista palette: Deep obsidian dock (#192216), authentic Pista green (#709758), muted sage (#8F9F8B)
 * - Labels under every item, perfectly aligned on the same horizontal baseline
 */

import { memo, useCallback, useEffect, useMemo, type ComponentProps } from "react"
import { StyleSheet, useWindowDimensions, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import type { Tabs } from "expo-router"
import { router } from "expo-router"
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, {
  ClipPath,
  Defs,
  Path,
} from "react-native-svg"

import { PressableScale } from "@/components/ui/PressableScale"
import { useLayout } from "@/theme/layout"

import {
  hideTabBar,
  showTabBar,
  tabBarScrollProgress,
  useScrollAwareTabBar,
} from "./useScrollAwareDock"

export { hideTabBar, showTabBar, tabBarScrollProgress, useScrollAwareTabBar }

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

type TabMeta = {
  activeIcon: keyof typeof Ionicons.glyphMap
  inactiveIcon: keyof typeof Ionicons.glyphMap
  label: string
}

const TAB_META: Record<string, TabMeta> = {
  dashboard: { activeIcon: "home", inactiveIcon: "home-outline", label: "Sanctuary" },
  schedule: { activeIcon: "calendar", inactiveIcon: "calendar-outline", label: "Functions" },
  knowledge: { activeIcon: "book", inactiveIcon: "book-outline", label: "Vault" },
  family: { activeIcon: "people", inactiveIcon: "people-outline", label: "Family" },
}

const ORB_ROUTE = "quick-action"

/* ── BlinkQuest Canonical Dock Constants (Pista Edition) ───────── */
const DOCK_COLOR = "#192216"
const ACCENT_COLOR = "#709758"
const MUTED_COLOR = "#8F9F8B"

const CENTER_SIZE = 60
const BAR_H = 70
const TOP_R = 24
/**
 * Raised-cosine wave:
 *   h(x) = HUMP_RISE · (1 + cos(π·x / HUMP_HALF)) / 2,  |x| ≤ HUMP_HALF
 * 31.5px tall, 94px each side, centred on the orb.
 */
const HUMP_RISE = 31.5
const HUMP_HALF = 94
const HUMP_H = 34
const ORB_CENTER_Y = HUMP_H
const DOCK_TOP = 0
const BOTTOM_EXTRA = 6
const TAB_BAR_CONTENT_HEIGHT = DOCK_TOP + HUMP_H + BAR_H
const CENTER_SLOT = 96
const ICON_SIZE = 24
const LABEL_LINE = 14
const TAB_CONTENT_H = ICON_SIZE + 2 + 2 + LABEL_LINE
const LABEL_TOP = HUMP_H + (BAR_H - TAB_CONTENT_H) / 2 + ICON_SIZE + 4
const SCAN_LABEL_GAP = LABEL_TOP - (ORB_CENTER_Y + CENTER_SIZE / 2)

const GLYPH_SWAP = { duration: 180, easing: Easing.out(Easing.quad) } as const
const PRESS = { duration: 90, easing: Easing.out(Easing.quad) } as const

const bottomPad = (insetBottom: number) => insetBottom + BOTTOM_EXTRA

const FLOAT_GAP = 16
const FLOAT_MAX_W = 600

export function useTabBarInset(): number {
  const insets = useSafeAreaInsets()
  const { isTablet } = useLayout()
  return isTablet
    ? TAB_BAR_CONTENT_HEIGHT + insets.bottom + FLOAT_GAP + 20
    : TAB_BAR_CONTENT_HEIGHT + bottomPad(insets.bottom) + 16
}

const haptic = (run: () => Promise<void>) => {
  void run().catch(() => undefined)
}

/* ── Dock silhouette: flat top, rounded corners, raised-cosine wave ── */
const WAVE_STEPS = 24

/** Smooth cubic chain Catmull-Rom through sampled points (identical to BlinkQuest) */
function wavePath(cx: number): string {
  const pts: [number, number][] = []
  for (let i = 0; i <= WAVE_STEPS; i++) {
    const x = -HUMP_HALF + (2 * HUMP_HALF * i) / WAVE_STEPS
    const h = (HUMP_RISE * (1 + Math.cos((Math.PI * x) / HUMP_HALF))) / 2
    pts.push([cx + x, HUMP_H - h])
  }
  const f = (n: number) => n.toFixed(2)
  let d = `L ${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

function buildTopEdge(w: number): string[] {
  const T = HUMP_H
  const r = TOP_R
  return [
    `A ${r} ${r} 0 0 1 ${r} ${T}`,
    wavePath(w / 2),
    `L ${w - r} ${T}`,
    `A ${r} ${r} 0 0 1 ${w} ${T + r}`,
  ]
}

function buildBarPath(w: number, h: number, bottomR = 0): string {
  if (bottomR <= 0) {
    return [`M 0 ${h}`, `L 0 ${HUMP_H + TOP_R}`, ...buildTopEdge(w), `L ${w} ${h}`, "Z"].join(" ")
  }
  const br = bottomR
  return [
    `M 0 ${h - br}`,
    `L 0 ${HUMP_H + TOP_R}`,
    ...buildTopEdge(w),
    `L ${w} ${h - br}`,
    `A ${br} ${br} 0 0 1 ${w - br} ${h}`,
    `L ${br} ${h}`,
    `A ${br} ${br} 0 0 1 0 ${h - br}`,
    "Z",
  ].join(" ")
}

function buildRimPath(w: number): string {
  const y = HUMP_H + TOP_R + 6
  return [`M 0 ${y}`, `L 0 ${HUMP_H + TOP_R}`, ...buildTopEdge(w), `L ${w} ${y}`].join(" ")
}

/* ── Tab Button Component ──────────────────────────────────────── */
interface TabButtonProps {
  routeKey: string
  routeName: string
  activeIcon: keyof typeof Ionicons.glyphMap
  inactiveIcon: keyof typeof Ionicons.glyphMap
  label: string
  focused: boolean
  onTabPress: (key: string, name: string, focused: boolean) => void
}

const TabButton = memo(function TabButton({
  routeKey,
  routeName,
  activeIcon,
  inactiveIcon,
  label,
  focused,
  onTabPress,
}: TabButtonProps) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(focused ? 1 : 0)

  useEffect(() => {
    const next = focused ? 1 : 0
    progress.value = reduceMotion ? next : withTiming(next, GLYPH_SWAP)
  }, [progress, focused, reduceMotion])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.04 }],
  }))

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [MUTED_COLOR, ACCENT_COLOR]),
  }))

  const iconName = focused ? activeIcon : inactiveIcon
  const iconColor = focused ? ACCENT_COLOR : MUTED_COLOR

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={() => onTabPress(routeKey, routeName, focused)}
      android_ripple={{ color: "rgba(112, 151, 88, 0.15)", borderless: true, radius: 28 }}
      scaleTo={0.94}
      style={styles.tab}
      testID={`tab-${routeName}`}
    >
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Ionicons name={iconName} size={ICON_SIZE} color={iconColor} />
      </Animated.View>
      <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </PressableScale>
  )
})

/* ── Main CustomTabBar Component ───────────────────────────────── */
export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const { width } = useWindowDimensions()

  useEffect(() => {
    showTabBar(true)
  }, [state.index])

  const { isTablet } = useLayout()
  const bleed = isTablet ? 0 : 2
  const barW = isTablet ? Math.min(width - 48, FLOAT_MAX_W) : Math.ceil(width) + bleed * 2
  const barH = HUMP_H + BAR_H + (isTablet ? 0 : bottomPad(insets.bottom))
  const floatBottom = isTablet ? insets.bottom + FLOAT_GAP : 0

  const barPath = useMemo(
    () => buildBarPath(barW, barH, isTablet ? TOP_R : 0),
    [barW, barH, isTablet],
  )
  const rimPath = useMemo(() => buildRimPath(barW), [barW])

  const routes = useMemo(
    () => state.routes.filter((route) => route.name !== ORB_ROUTE && TAB_META[route.name]),
    [state.routes],
  )

  const half = Math.ceil(routes.length / 2)
  const left = routes.slice(0, half)
  const right = routes.slice(half)
  const activeIndex = routes.findIndex((route) => route.key === state.routes[state.index]?.key)

  const press = useSharedValue(0)

  const orbPress = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.08 }],
  }))

  const totalHiddenY = barH + floatBottom + 12
  const containerAnimStyle = useAnimatedStyle(() => {
    const scrollFactor = tabBarScrollProgress.value
    return {
      transform: [{ translateY: scrollFactor * totalHiddenY }],
      opacity: Math.max(0, 1 - scrollFactor * 1.2),
    }
  })

  const onTabPress = useCallback(
    (key: string, name: string, focused: boolean) => {
      const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true })
      if (event.defaultPrevented) return
      if (!focused) {
        haptic(() => Haptics.selectionAsync())
        navigation.navigate(name)
      }
    },
    [navigation],
  )

  const handleOrbPress = useCallback(() => {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
    router.push("/modal/quick-action" as any)
  }, [])

  const currentRoute = state.routes[state.index]
  if (currentRoute?.name === ORB_ROUTE || !TAB_META[currentRoute?.name]) {
    const currentOptions = descriptors[currentRoute?.key]?.options
    const isExplicitlyHidden =
      currentOptions?.tabBarStyle &&
      (currentOptions.tabBarStyle as { display?: string }).display === "none"
    if (isExplicitlyHidden || !TAB_META[currentRoute?.name]) {
      return null
    }
  }

  const renderTab = (route: (typeof routes)[number], index: number) => {
    const meta = TAB_META[route.name]
    if (!meta) return null
    return (
      <TabButton
        key={route.key}
        routeKey={route.key}
        routeName={route.name}
        activeIcon={meta.activeIcon}
        inactiveIcon={meta.inactiveIcon}
        label={meta.label}
        focused={activeIndex === index}
        onTabPress={onTabPress}
      />
    )
  }

  return (
    <Animated.View
      testID="tab-bar"
      pointerEvents="box-none"
      style={[styles.dock, { bottom: floatBottom }, containerAnimStyle]}
    >
      <View style={{ width: barW, height: barH, alignSelf: "center" }} pointerEvents="box-none">
        <Svg width={barW} height={barH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <ClipPath id="dockClip">
              <Path d={barPath} />
            </ClipPath>
          </Defs>
          {/* Solid deep Pista obsidian body (No tacky gradient) */}
          <Path d={barPath} fill={DOCK_COLOR} />
          {/* Hairline outline tracing the silhouette */}
          <Path d={rimPath} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
        </Svg>

        {/* Tab buttons row */}
        <View
          style={[styles.row, { paddingHorizontal: bleed }]}
          accessibilityRole="tablist"
        >
          <View style={styles.side}>{left.map((route, i) => renderTab(route, i))}</View>
          <View style={styles.centerSlot} />
          <View style={styles.side}>
            {right.map((route, i) => renderTab(route, i + left.length))}
          </View>
        </View>

        {/* Central Action Orb with Action label */}
        <Animated.View pointerEvents="box-none" style={[styles.centerWrap, orbPress]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Sanctuary Action"
            testID="tab-action-orb"
            hitSlop={6}
            onPressIn={() => {
              press.value = reduceMotion ? 1 : withTiming(1, PRESS)
            }}
            onPressOut={() => {
              press.value = reduceMotion ? 0 : withTiming(0, PRESS)
            }}
            onPress={handleOrbPress}
            scaleTo={0.94}
            style={styles.orbButton}
          >
            <View style={styles.centerOrb}>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>

            <Animated.Text style={styles.scanLabel} numberOfLines={1}>
              Action
            </Animated.Text>
          </PressableScale>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

/* ── Styles (Identical to BlinkQuest Canonical Architecture) ───── */
const styles = StyleSheet.create({
  centerOrb: {
    alignItems: "center",
    backgroundColor: ACCENT_COLOR,
    borderRadius: CENTER_SIZE / 2,
    height: CENTER_SIZE,
    justifyContent: "center",
    paddingTop: 0,
    width: CENTER_SIZE,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  centerSlot: {
    width: CENTER_SLOT,
  },
  centerWrap: {
    alignItems: "center",
    left: "50%",
    marginLeft: -CENTER_SIZE / 2,
    position: "absolute",
    top: ORB_CENTER_Y - CENTER_SIZE / 2,
    width: CENTER_SIZE,
  },
  dock: {
    alignItems: "center",
    bottom: 0,
    left: 0,
    paddingTop: DOCK_TOP,
    position: "absolute",
    right: 0,
    zIndex: 1000,
  },
  iconWrap: {
    alignItems: "center",
    height: ICON_SIZE,
    justifyContent: "center",
    width: ICON_SIZE,
  },
  label: {
    color: MUTED_COLOR,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: LABEL_LINE,
    marginTop: 2,
  },
  orbButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    height: BAR_H,
    left: 0,
    position: "absolute",
    right: 0,
    top: HUMP_H,
  },
  scanLabel: {
    color: "#E7E5E4",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: LABEL_LINE,
    marginTop: SCAN_LABEL_GAP,
    width: CENTER_SLOT,
    textAlign: "center",
  },
  side: {
    flex: 1,
    flexDirection: "row",
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    justifyContent: "center",
  },
})
