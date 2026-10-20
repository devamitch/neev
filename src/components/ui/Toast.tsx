import React, { useEffect, useMemo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"

import { useTheme } from "@/theme/useTheme"
import { useRootStore, useShallow, type RootStoreState } from "@/stores/useRootStore"
import { AppText } from "./AppText"
import { SquircleSurface } from "./SquircleSurface"

const SWIPE_DISMISS_THRESHOLD = 30

export function Toast() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { toasts, hideToast } = useRootStore(
    useShallow((s: RootStoreState) => ({
      toasts: s.toasts,
      hideToast: s.hideToast,
    })),
  )

  // Show the latest notification in the tray to prevent intrusive stacking
  const currentToast = useMemo(() => {
    if (toasts.length === 0) return null
    return toasts[toasts.length - 1]
  }, [toasts])

  const translateY = useSharedValue(-120)
  const opacity = useSharedValue(0)

  const handleDismiss = () => {
    if (currentToast) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      hideToast(currentToast.id)
    }
  }

  useEffect(() => {
    if (currentToast) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      translateY.value = withSpring(0, { damping: 20, stiffness: 320 })
      opacity.value = withTiming(1, { duration: 180 })

      // Auto dismiss after 3.5 seconds
      const timer = setTimeout(() => {
        translateY.value = withTiming(-120, { duration: 200 })
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleDismiss)()
        })
      }, 3500)

      return () => clearTimeout(timer)
    } else {
      translateY.value = -120
      opacity.value = 0
      return undefined
    }
  }, [currentToast])

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY
      }
    })
    .onEnd((e) => {
      if (e.translationY < -SWIPE_DISMISS_THRESHOLD || e.velocityY < -400) {
        translateY.value = withTiming(-140, { duration: 180 })
        opacity.value = withTiming(0, { duration: 180 }, () => {
          runOnJS(handleDismiss)()
        })
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 350 })
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  if (!currentToast) return null

  const getTone = (type: string) => {
    switch (type) {
      case "success":
        return {
          category: "SANCTUARY UPDATED",
          pillColor: "#10B981",
          strokeColor: "rgba(16, 185, 129, 0.25)",
          icon: "checkmark-circle" as const,
          iconBg: "rgba(16, 185, 129, 0.12)",
          title: "Action Complete",
        }
      case "error":
        return {
          category: "SANCTUARY ALERT",
          pillColor: "#EF4444",
          strokeColor: "rgba(239, 68, 68, 0.25)",
          icon: "alert-circle" as const,
          iconBg: "rgba(239, 68, 68, 0.12)",
          title: "Attention Required",
        }
      case "warning":
        return {
          category: "SANCTUARY NOTICE",
          pillColor: "#D97706",
          strokeColor: "rgba(217, 119, 6, 0.25)",
          icon: "warning" as const,
          iconBg: "rgba(217, 119, 6, 0.12)",
          title: "Sanctuary Notice",
        }
      default:
        return {
          category: "SANCTUARY TELEMETRY",
          pillColor: "#DA7756",
          strokeColor: "rgba(218, 119, 86, 0.25)",
          icon: "shield-checkmark" as const,
          iconBg: "rgba(218, 119, 86, 0.12)",
          title: "Sanctuary Telemetry",
        }
    }
  }

  const tone = getTone(currentToast.type)

  return (
    <View
      style={[styles.container, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.bannerWrapper, animatedStyle]}>
          <SquircleSurface
            radius={20}
            smoothing={0.7}
            fill="#FFFDF9"
            stroke={tone.strokeColor}
            strokeWidth={1}
            style={styles.surface}
          >
            <View style={styles.contentRow}>
              {/* Tone Icon Tile */}
              <View style={[styles.iconTile, { backgroundColor: tone.iconBg }]}>
                <Ionicons name={tone.icon} size={18} color={tone.pillColor} />
              </View>

              {/* Notification Body */}
              <View style={styles.textColumn}>
                <View style={styles.headerRow}>
                  <AppText variant="label" style={[styles.categoryPill, { color: tone.pillColor }]}>
                    {tone.category}
                  </AppText>
                  <AppText style={styles.dotSeparator}>•</AppText>
                  <AppText variant="caption" style={styles.timeText}>
                    Just now
                  </AppText>
                  {toasts.length > 1 && (
                    <View style={styles.multiBadge}>
                      <AppText style={styles.multiBadgeText}>
                        +{toasts.length - 1} more
                      </AppText>
                    </View>
                  )}
                </View>

                <AppText variant="bodyBold" numberOfLines={1} style={styles.titleText}>
                  {currentToast.title || tone.title}
                </AppText>

                <AppText variant="body" numberOfLines={2} style={styles.bodyText}>
                  {currentToast.message}
                </AppText>

                {currentToast.actionLabel ? (
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync()
                      if (currentToast.actionRoute) {
                        try {
                          router.push(currentToast.actionRoute as any)
                        } catch {}
                      }
                      handleDismiss()
                    }}
                    style={({ pressed }) => [
                      styles.actionButton,
                      { backgroundColor: tone.pillColor },
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <AppText style={styles.actionButtonText}>
                      {currentToast.actionLabel}
                    </AppText>
                    <Ionicons name="arrow-forward" size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
                  </Pressable>
                ) : null}
              </View>

              {/* Dismiss Button */}
              <Pressable
                onPress={handleDismiss}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.dismissButton,
                  pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] },
                ]}
                accessibilityLabel="Dismiss notification"
              >
                <Ionicons name="close" size={15} color="#78716C" />
              </Pressable>
            </View>
          </SquircleSurface>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: "center",
  },
  bannerWrapper: {
    width: "100%",
    maxWidth: 440,
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 9,
  },
  surface: {
    padding: 13,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    marginTop: 2,
  },
  textColumn: {
    flex: 1,
    paddingRight: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    gap: 6,
  },
  categoryPill: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  dotSeparator: {
    fontSize: 9,
    color: "#D6D3D1",
  },
  timeText: {
    fontSize: 11,
    color: "#A8A29E",
  },
  multiBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  multiBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#78716C",
  },
  titleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 12.5,
    color: "#57534E",
    lineHeight: 17,
  },
  dismissButton: {
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 14,
    marginTop: -1,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9,
    marginTop: 6,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "700",
  },
})
