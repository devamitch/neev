/**
 * The shape of content that has not arrived yet.
 *
 * A skeleton is not a spinner: it holds the space the real content will take, so the layout does not
 * jump when it lands, and it indicates "this is coming" rather than "something is happening somewhere".
 *
 * The shimmer is one gradient sweeping across on the UI thread, and a single `SkeletonGroup` drives
 * every child from one clock so a screenful of them pulses together harmoniously rather than as a crowd of
 * independent flickers. Reduced motion holds the resting tone and never sweeps.
 */
import { createContext, memo, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { ThemeColors } from '@/theme/setuColors';
import { withAlpha } from '@/theme/setuGradients';
import { SetuRadius } from '@/theme/setuSpacing';
import { useColors, useThemedStyles } from '@/theme/useTheme';

const SWEEP_MS = 1400;

const ShimmerContext = createContext<SharedValue<number> | null>(null);

/** Drives every skeleton beneath it from one coordinated clock. */
export function SkeletonGroup({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [reduceMotion, sweep]);

  return <ShimmerContext.Provider value={sweep}>{children}</ShimmerContext.Provider>;
}

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  /** `circle` for avatar/round icons, `text` for a line of text, `block` for cards and charts. */
  shape?: 'block' | 'text' | 'circle';
  style?: StyleProp<ViewStyle>;
}

export const Skeleton = memo(function Skeleton({
  width = '100%',
  height,
  radius,
  shape = 'block',
  style,
}: SkeletonProps) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const shared = useContext(ShimmerContext);
  const local = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const sweep = shared ?? local;

  useEffect(() => {
    if (shared || reduceMotion) return;
    local.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [local, reduceMotion, shared]);

  const resolvedHeight = height ?? (shape === 'text' ? 14 : shape === 'circle' ? 44 : 80);
  const resolvedRadius =
    radius ?? (shape === 'circle' ? SetuRadius.pill : shape === 'text' ? SetuRadius.sm : SetuRadius.lg);

  const [layoutWidth, setLayoutWidth] = useState(0)

  const shimmer = useAnimatedStyle(() => {
    const w = layoutWidth > 0 ? layoutWidth : 320
    const x = interpolate(sweep.value, [0, 1], [-w, w])
    return {
      transform: [{ translateX: x }],
    }
  })

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0 && w !== layoutWidth) setLayoutWidth(w)
      }}
      style={[styles.base, { width, height: resolvedHeight, borderRadius: resolvedRadius }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmer]}>
        <LinearGradient
          colors={[
            withAlpha(colors.gloss, 0),
            withAlpha(colors.gloss, colors.scheme === 'dark' ? 0.08 : 0.45),
            withAlpha(colors.gloss, 0),
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // Read dynamically through useThemedStyles(); the static
    // react-native/no-unused-styles rule can't see through that indirection.
    // eslint-disable-next-line react-native/no-unused-styles
    base: {
      backgroundColor: withAlpha(colors.text.primary, 0.08),
      overflow: 'hidden',
    },
  });

export default Skeleton;
