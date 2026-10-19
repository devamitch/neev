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

import React from "react"
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
import { useRootStore, useShallow } from "@/stores/useRootStore"
import { AppText } from "./AppText"
import { SquircleSurface } from "./SquircleSurface"

const SWIPE_DISMISS_THRESHOLD = 90

export function MindfulNotificationBanner() {
  const router = useRouter()
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

  const translateX = useSharedValue(0)
  const opacity = useSharedValue(1)

  const handleDismiss = () => {
    if (activeNotif) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      dismissMindfulNotification(activeNotif.id)
    }
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX
    })
    .onEnd((e) => {
      const isPastThreshold = Math.abs(e.translationX) > SWIPE_DISMISS_THRESHOLD
      const isFlung = Math.abs(e.velocityX) > 700

      if (isPastThreshold || isFlung) {
        const direction = e.translationX < 0 ? -1 : 1
        translateX.value = withTiming(direction * 450, { duration: 180 })
        opacity.value = withTiming(0, { duration: 180 }, () => {
          runOnJS(handleDismiss)()
        })
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 350 })
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
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
    <View style={styles.container} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.bannerWrapper, animatedStyle]}>
          <SquircleSurface
            radius={20}
            smoothing={0.7}
            fill="#FDFBF7"
            stroke="rgba(217, 119, 6, 0.22)"
            strokeWidth={1}
            style={styles.surface}
          >
            <View style={styles.contentRow}>
              {/* Notification Body */}
              <View style={styles.textColumn}>
                <View style={styles.headerRow}>
                  <AppText variant="label" style={styles.categoryPill}>
                    {activeNotif.space ? activeNotif.space.toUpperCase() : "SANCTUARY"}
                  </AppText>
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
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityLabel="Dismiss notification"
              >
                <Ionicons name="close" size={16} color="#78716C" />
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
    top: 54,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  bannerWrapper: {
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  surface: {
    padding: 14,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  textColumn: {
    flex: 1,
    paddingRight: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  categoryPill: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
    letterSpacing: 0.6,
  },
  timeText: {
    fontSize: 11,
    color: "#A8A29E",
  },
  titleText: {
    fontSize: 14,
    color: "#292524",
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 12,
    color: "#57534E",
    lineHeight: 17,
  },
  actionButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(217, 119, 6, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "600",
  },
  dismissButton: {
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 14,
    marginTop: -2,
  },
})
