import { PressableScale } from "@/components/ui/PressableScale"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import type { Tabs } from "expo-router"
import { router } from "expo-router"
import { memo, useCallback, useEffect, useMemo, type ComponentProps } from "react"
import { StyleSheet, useWindowDimensions, View } from "react-native"
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
  Circle,
  ClipPath,
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg"

import { NeevLogoIcon } from "@/components/brand/NeevLogoIcon"
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

const ORB_ROUTE = "add-event"

/* ── Design System Constants ───────────────────────────────────── */
const DOCK_COLOR = "#262624"
const ACCENT_COLOR = "#DA7756"
const MUTED_COLOR = "#A8A29E"

const CENTER_SIZE = 60
const BAR_H = 70
const TOP_R = 24
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

const GLYPH_SWAP = { duration: 180, easing: Easing.out(Easing.quad) } as const

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

const WAVE_STEPS = 24

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
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

function buildBarPath(w: number, totalH: number, cornerR: number): string {
  const cx = w / 2
  const f = (n: number) => n.toFixed(2)
  const leftShoulderX = cx - HUMP_HALF
  const rightShoulderX = cx + HUMP_HALF

  if (cornerR > 0) {
    const r = Math.min(cornerR, leftShoulderX, totalH / 2)
    return [
      `M 0 ${f(HUMP_H + r)}`,
      `A ${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(HUMP_H)}`,
      `L ${f(leftShoulderX)} ${f(HUMP_H)}`,
      wavePath(cx),
      `L ${f(w - r)} ${f(HUMP_H)}`,
      `A ${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(HUMP_H + r)}`,
      `L ${f(w)} ${f(totalH - r)}`,
      `A ${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(totalH)}`,
      `L ${f(r)} ${f(totalH)}`,
      `A ${f(r)} ${f(r)} 0 0 1 0 ${f(totalH - r)}`,
      "Z",
    ].join(" ")
  }

  return [
    `M 0 ${f(HUMP_H)}`,
    `L ${f(leftShoulderX)} ${f(HUMP_H)}`,
    wavePath(cx),
    `L ${f(w)} ${f(HUMP_H)}`,
    `L ${f(w)} ${f(totalH)}`,
    `L 0 ${f(totalH)}`,
    "Z",
  ].join(" ")
}

function buildRimPath(w: number): string {
  const cx = w / 2
  const f = (n: number) => n.toFixed(2)
  return [
    `M 0 ${f(HUMP_H)}`,
    `L ${f(cx - HUMP_HALF)} ${f(HUMP_H)}`,
    wavePath(cx),
    `L ${f(w)} ${f(HUMP_H)}`,
  ].join(" ")
}

type TabButtonProps = {
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
      android_ripple={{ color: "rgba(218, 119, 86, 0.15)", borderless: true, radius: 28 }}
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

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
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

  const onOrbPress = useCallback(() => {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
    router.push("/modal/quick-action" as any)
  }, [])

  const cx = barW / 2
  const orbLeft = cx - CENTER_SIZE / 2
  const orbTop = ORB_CENTER_Y - CENTER_SIZE / 2

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.root,
        isTablet ? { bottom: floatBottom, alignSelf: "center", width: barW } : { left: -bleed },
        containerAnimStyle,
      ]}
    >
      <View style={[styles.canvas, { width: barW, height: barH }]} pointerEvents="none">
        <Svg width={barW} height={barH}>
          <Defs>
            <SvgLinearGradient id="dockBody" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={DOCK_COLOR} stopOpacity="0.98" />
              <Stop offset="1" stopColor="#1E1E1C" stopOpacity="1" />
            </SvgLinearGradient>
            <SvgLinearGradient id="dockRim" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgba(255,255,255,0.06)" />
              <Stop offset="0.5" stopColor="rgba(255,255,255,0.22)" />
              <Stop offset="1" stopColor="rgba(255,255,255,0.06)" />
            </SvgLinearGradient>
            <ClipPath id="dockClip">
              <Path d={barPath} />
            </ClipPath>
          </Defs>
          <Path d={barPath} fill="url(#dockBody)" />
          <Path d={rimPath} stroke="url(#dockRim)" strokeWidth={1} fill="none" />
        </Svg>
      </View>

      <View style={[styles.dockRow, { width: barW, top: HUMP_H, height: BAR_H }]}>
        <View style={styles.tabWing}>
          {left.map((route) => {
            const meta = TAB_META[route.name]
            const focused = state.routes[state.index]?.key === route.key
            return (
              <TabButton
                key={route.key}
                routeKey={route.key}
                routeName={route.name}
                activeIcon={meta.activeIcon}
                inactiveIcon={meta.inactiveIcon}
                label={meta.label}
                focused={focused}
                onTabPress={onTabPress}
              />
            )
          })}
        </View>

        <View style={styles.centerGap} pointerEvents="none" />

        <View style={styles.tabWing}>
          {right.map((route) => {
            const meta = TAB_META[route.name]
            const focused = state.routes[state.index]?.key === route.key
            return (
              <TabButton
                key={route.key}
                routeKey={route.key}
                routeName={route.name}
                activeIcon={meta.activeIcon}
                inactiveIcon={meta.inactiveIcon}
                label={meta.label}
                focused={focused}
                onTabPress={onTabPress}
              />
            )
          })}
        </View>
      </View>

      <View
        style={[
          styles.orbAnchor,
          {
            left: orbLeft,
            top: orbTop,
            width: CENTER_SIZE,
            height: CENTER_SIZE,
          },
        ]}
      >
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Add Family Event or Wisdom"
          onPress={onOrbPress}
          scaleTo={0.92}
          style={styles.orbButton}
          testID="tab-add-event-orb"
        >
          <Animated.View style={[styles.orbSurface, orbPress]}>
            <Svg width={CENTER_SIZE} height={CENTER_SIZE}>
              <Defs>
                <SvgLinearGradient id="orbGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#E28464" />
                  <Stop offset="0.6" stopColor={ACCENT_COLOR} />
                  <Stop offset="1" stopColor="#9C4426" />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx={CENTER_SIZE / 2}
                cy={CENTER_SIZE / 2}
                r={CENTER_SIZE / 2 - 1}
                fill="url(#orbGrad)"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1.5}
              />
            </Svg>
            <View style={styles.orbIconWrap}>
              <Ionicons name="add" size={32} color="#FFFFFF" />
            </View>
          </Animated.View>
        </PressableScale>
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.orbLabelRow,
          {
            top: LABEL_TOP,
            left: cx - CENTER_SLOT / 2,
            width: CENTER_SLOT,
          },
        ]}
      >
        <Animated.Text style={styles.orbLabel}>Schedule</Animated.Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    bottom: 0,
    zIndex: 999,
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  dockRow: {
    position: "absolute",
    left: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  tabWing: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: "100%",
  },
  centerGap: {
    width: CENTER_SLOT,
    height: "100%",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 3,
  },
  orbAnchor: {
    position: "absolute",
    zIndex: 1001,
  },
  orbButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
  },
  orbSurface: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  orbIconWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  orbLabelRow: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  orbLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: ACCENT_COLOR,
  },
})
