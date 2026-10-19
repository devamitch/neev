import { Ionicons } from "@expo/vector-icons"
import React, { useCallback, useEffect } from "react"
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useTheme } from "@/theme/useTheme"
import { BlurView } from "expo-blur"
import { AppText } from "./AppText"
import { PressableScale } from "./PressableScale"

const { height: SCREEN_HEIGHT } = Dimensions.get("window")
const SWIPE_CLOSE_THRESHOLD = 80
const SWIPE_VELOCITY_THRESHOLD = 500

export interface AppBottomSheetModalProps {
  visible: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  eyebrow?: string
  children: React.ReactNode
  maxHeight?: number | `${number}%`
  showHandle?: boolean
  showCloseButton?: boolean
  avoidKeyboard?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  headerRight?: React.ReactNode
}

/**
 * Universal Neev Bottom Sheet Modal.
 *
 * Implements:
 * 1. UI-thread pan gesture to drag down and dismiss with spring physics.
 * 2. Animated frosted backdrop that dismisses on tap.
 * 3. Squircle top corners and centered pill handle.
 * 4. Safe-area bottom padding so buttons are never covered by navigation bars.
 * 5. Hardware back button handling on Android.
 */
export function AppBottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  maxHeight = "85%",
  showHandle = true,
  showCloseButton = true,
  avoidKeyboard = true,
  contentContainerStyle,
  headerRight,
}: AppBottomSheetModalProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const translateY = useSharedValue(SCREEN_HEIGHT)
  const backdropOpacity = useSharedValue(0)

  const handleDismiss = useCallback(() => {
    onClose()
  }, [onClose])

  const startCloseAnimation = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 180 })
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(handleDismiss)()
      }
    })
  }, [backdropOpacity, translateY, handleDismiss])

  useEffect(() => {
    if (visible) {
      translateY.value = SCREEN_HEIGHT
      backdropOpacity.value = 0
      backdropOpacity.value = withTiming(1, { duration: 220 })
      translateY.value = withSpring(0, {
        damping: 26,
        stiffness: 240,
        mass: 0.8,
      })
    }
  }, [visible, backdropOpacity, translateY])

  const panGesture = Gesture.Pan()
    .activeOffsetY([0, 10])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY
      }
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_CLOSE_THRESHOLD || e.velocityY > SWIPE_VELOCITY_THRESHOLD) {
        runOnJS(startCloseAnimation)()
      } else {
        translateY.value = withSpring(0, { damping: 24, stiffness: 260 })
      }
    })

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={startCloseAnimation}
      accessibilityRole={"alert"}
    >
      <View style={styles.modalRoot}>
        {/* Animated backdrop with tap to close */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <BlurView intensity={60} tint="light" blurMethod="none" style={StyleSheet.absoluteFill} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={startCloseAnimation}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          />
        </Animated.View>

        {/* Bottom sheet surface container with pan gesture */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          enabled={avoidKeyboard}
          style={styles.keyboardAvoid}
        >
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheetSurface,
                {
                  backgroundColor: colors.background,
                  borderTopColor: colors.border,
                  borderLeftColor: colors.border,
                  borderRightColor: colors.border,
                  maxHeight,
                  paddingBottom: Math.max(insets.bottom, 16) + 8,
                },
                sheetAnimatedStyle,
              ]}
            >
              {/* Drag handle pill */}
              {showHandle && (
                <View style={styles.handleContainer}>
                  <View style={[styles.handlePill, { backgroundColor: colors.border }]} />
                </View>
              )}

              {/* Sheet header row */}
              {(Boolean(title) || Boolean(showCloseButton) || Boolean(headerRight)) && (
                <View style={styles.headerRow}>
                  <View style={styles.titleColumn}>
                    {eyebrow ? (
                      <AppText
                        variant="overline"
                        style={{ color: colors.accentText, marginBottom: 2 }}
                      >
                        {eyebrow}
                      </AppText>
                    ) : null}
                    {title ? (
                      <AppText variant="h3" style={styles.titleText}>
                        {title}
                      </AppText>
                    ) : null}
                    {subtitle ? (
                      <AppText
                        variant="caption"
                        style={{ color: colors.text.secondary, marginTop: 2 }}
                      >
                        {subtitle}
                      </AppText>
                    ) : null}
                  </View>

                  <View style={styles.headerActions}>
                    {headerRight}
                    {showCloseButton && (
                      <PressableScale
                        onPress={startCloseAnimation}
                        hitSlop={8}
                        scaleTo={0.92}
                        style={[styles.closeButton, { backgroundColor: colors.surface2 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Close modal"
                      >
                        <Ionicons name="close" size={20} color={colors.text.primary} />
                      </PressableScale>
                    )}
                  </View>
                </View>
              )}

              {/* Sheet body */}
              <View style={[styles.body, contentContainerStyle]}>{children}</View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  keyboardAvoid: {
    justifyContent: "flex-end",
    width: "100%",
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 20,
    width: "100%",
  },
  handleContainer: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: "100%",
  },
  handlePill: {
    borderRadius: 2.5,
    height: 5,
    width: 38,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  titleColumn: {
    flex: 1,
    paddingRight: 12,
  },
  titleText: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  body: {
    width: "100%",
  },
})
