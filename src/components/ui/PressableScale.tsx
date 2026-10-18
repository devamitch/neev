/**
 * A press that answers with the surface itself.
 *
 * BlinkQuest's touch feedback is physical: the thing you press gives under the finger and springs back,
 * rather than flashing an opacity. That motion is uniform everywhere — one spring, one scale,
 * one reduced-motion rule.
 *
 * It is a Pressable in every other respect. Accessibility props are forwarded rather than
 * re-declared, so screen readers and accessibility tools treat it as a native interactive control.
 */
import { memo, useCallback, useEffect, useMemo, type Ref } from "react"
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** Firm and quick: the surface feels resisted and tactile, never floaty. */
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 } as const

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
  /**
   * Plain style only. A `(state) => style` function hides the animated node from
   * Reanimated and breaks layout, so it is intentionally not supported.
   */
  style?: StyleProp<ViewStyle>
  /** How far it gives. 0.97 for cards/rows; 0.95 or 0.92 for smaller buttons/icons. */
  scaleTo?: number
  /** Opacity while `disabled`. Pass 1 when the caller styles the disabled look itself. */
  disabledOpacity?: number
  ref?: Ref<View>
}

export const PressableScale = memo(function PressableScale({
  style,
  scaleTo = 0.97,
  disabledOpacity = 0.45,
  disabled,
  onPressIn,
  onPressOut,
  ref,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion()
  const pressed = useSharedValue(0)

  // Scale only. Opacity is never animated, so it can't fight the disabled opacity below.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
  }))

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      pressed.value = reduceMotion ? 1 : withSpring(1, PRESS_SPRING)
      onPressIn?.(e)
    },
    [onPressIn, pressed, reduceMotion],
  )

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      pressed.value = reduceMotion ? 0 : withSpring(0, PRESS_SPRING)
      onPressOut?.(e)
    },
    [onPressOut, pressed, reduceMotion],
  )

  // If it becomes disabled mid-press (e.g. onPress flips `loading`), onPressOut can be
  // skipped and the surface would stay shrunk. Always spring back.
  useEffect(() => {
    if (disabled) pressed.value = reduceMotion ? 0 : withSpring(0, PRESS_SPRING)
  }, [disabled, pressed, reduceMotion])

  // Flatten once, keep the animated style directly in the array so Reanimated sees it.
  const composedStyle = useMemo(
    () => [
      StyleSheet.flatten(style),
      animatedStyle,
      disabled && disabledOpacity < 1 ? { opacity: disabledOpacity } : null,
    ],
    [style, animatedStyle, disabled, disabledOpacity],
  )

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onResponderTerminate={() => {
        pressed.value = reduceMotion ? 0 : withSpring(0, PRESS_SPRING)
      }}
      style={composedStyle}
    />
  )
})

export default PressableScale
