/**
 * Neev Mindful Notification Banner
 * A serene, floating, dismissable banner for purposeful family nudges.
 *
 * Features:
 * - Dismissable via tap on '✕' or swipe gesture
 * - Calming typography and organic squircle styling
 * - Actionable buttons navigating straight to the relevant space
 * - Haptic feedback for tactile mindfulness
 */

import React, { useEffect } from "react"
import { StyleSheet, View, Pressable } from "react-native"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import { Ionicons } from "@expo/vector-icons"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { AppText } from "./AppText"
import { SquircleSurface } from "./SquircleSurface"

const SWIPE_DISMISS_THRESHOLD = 30

export function MindfulNotificationBanner() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isAuthenticated, mindfulNotifications, activeBannerNotificationId, dismissMindfulNotification } =
    useRootStore(
      useShallow((s) => ({
        isAuthenticated: s.isAuthenticated,
        mindfulNotifications: s.mindfulNotifications,
        activeBannerNotificationId: s.activeBannerNotificationId,
        dismissMindfulNotification: s.dismissMindfulNotification,
      })),
    )

  const activeNotif = isAuthenticated
    ? mindfulNotifications.find(
        (n) => n.id === activeBannerNotificationId && !n.isDismissed,
      )
    : undefined

  const translateY = useSharedValue(-140)
  const opacity = useSharedValue(0)

  const handleDismiss = () => {
    if (activeNotif) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      dismissMindfulNotification(activeNotif.id)
    }
  }

  useEffect(() => {
    if (activeNotif) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 })
      opacity.value = withTiming(1, { duration: 180 })

      // Auto dismiss after 4.5 seconds to never block header area permanently
      const timer = setTimeout(() => {
        translateY.value = withTiming(-140, { duration: 200 })
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleDismiss)()
        })
      }, 4500)

      return () => clearTimeout(timer)
    } else {
      translateY.value = -140
      opacity.value = 0
      return undefined
    }
  }, [activeNotif])

  const pan = Gesture.Pan()
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

  if (!activeNotif) return null

  const handleAction = () => {
    if (activeNotif.actionRoute) {
      void Haptics.selectionAsync()
      router.push(activeNotif.actionRoute as any)
      dismissMindfulNotification(activeNotif.id)
    }
  }

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.bannerWrapper, animatedStyle]}>
          <SquircleSurface
            radius={20}
            smoothing={0.7}
            fill="#FFFDF9"
            stroke="rgba(218, 119, 86, 0.25)"
            strokeWidth={1}
            style={styles.surface}
          >
            <View style={styles.contentRow}>
              {/* Tone Icon Tile */}
              <View style={styles.iconTile}>
                <Ionicons name="sparkles" size={17} color="#DA7756" />
              </View>

              {/* Notification Body */}
              <View style={styles.textColumn}>
                <View style={styles.headerRow}>
                  <AppText variant="label" style={styles.categoryPill}>
                    {activeNotif.space ? activeNotif.space.toUpperCase() : "SANCTUARY"}
                  </AppText>
                  <AppText style={styles.dotSeparator}>•</AppText>
                  <AppText variant="caption" style={styles.timeText}>
                    Mindful Nudge
                  </AppText>
                </View>

                <AppText variant="bodyBold" numberOfLines={1} style={styles.titleText}>
                  {activeNotif.title}
                </AppText>

                <AppText variant="body" numberOfLines={2} style={styles.bodyText}>
                  {activeNotif.body}
                </AppText>

                {activeNotif.actionLabel && (
                  <Pressable
                    onPress={handleAction}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <AppText variant="captionBold" style={styles.actionText}>
                      {activeNotif.actionLabel} →
                    </AppText>
                  </Pressable>
                )}
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
    zIndex: 9999,
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
    backgroundColor: "rgba(218, 119, 86, 0.12)",
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
    color: "#DA7756",
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
  actionButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(218, 119, 86, 0.10)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 11,
    color: "#DA7756",
    fontWeight: "700",
  },
  dismissButton: {
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 14,
    marginTop: -1,
  },
})
