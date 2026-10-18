import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { useRootStore, useShallow, type RootStoreState } from '@/stores/useRootStore';
import { SquircleSurface } from './SquircleSurface';
import { AppText } from './AppText';

const SWIPE_DISMISS_DISTANCE = 80;

/** A single toast row: swipe left or right past the threshold (or flick it) to dismiss. */
function ToastRow({
  message,
  theme,
  onDismiss,
}: {
  message: string;
  theme: { bg: string; fg: string; stroke: string };
  onDismiss: () => void;
}) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const past = Math.abs(e.translationX) > SWIPE_DISMISS_DISTANCE;
      const flung = Math.abs(e.velocityX) > 800;
      if (past || flung) {
        const direction = e.translationX < 0 ? -1 : 1;
        translateX.value = withTiming(direction * 400, { duration: 160 });
        opacity.value = withTiming(0, { duration: 160 }, () => runOnJS(onDismiss)());
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 420 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.pressable, styles.shadowWrap, rowStyle]}>
        <PressableScale onPress={onDismiss} scaleTo={0.96}>
          <SquircleSurface
            radius={14}
            smoothing={1}
            fill={theme.bg}
            stroke={theme.stroke}
            strokeWidth={1}
            style={styles.surface}
          >
            <View style={styles.content}>
              <AppText
                variant="caption"
                style={[styles.text, { color: theme.fg }]}
                numberOfLines={2}
              >
                {message}
              </AppText>
            </View>
          </SquircleSurface>
        </PressableScale>
      </Animated.View>
    </GestureDetector>
  );
}

export function Toast() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { toasts, hideToast } = useRootStore(
    useShallow((s: RootStoreState) => ({
      toasts: s.toasts,
      hideToast: s.hideToast,
    })),
  );

  if (toasts.length === 0) return null;

  const getToastColors = (type: string) => {
    switch (type) {
      case 'success':
        return { bg: colors.successSurface, fg: colors.success, stroke: colors.success };
      case 'error':
        return { bg: colors.errorSurface, fg: colors.error, stroke: colors.error };
      case 'warning':
        return { bg: colors.warningSurface, fg: colors.warning, stroke: colors.warning };
      default:
        return { bg: colors.surface2, fg: colors.primary, stroke: colors.primaryAlpha };
    }
  };

  return (
    <View style={[styles.container, { top: insets.top + 10 }]} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastRow
          key={toast.id}
          message={toast.message}
          theme={getToastColors(toast.type)}
          onDismiss={() => hideToast(toast.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
  },
  pressable: {
    width: '100%',
    maxWidth: 380,
  },
  // Shadows must live on the wrapper, not the squircle surface itself — SquircleSurface
  // clips with overflow: 'hidden' to match its drawn path, which silently eats any
  // shadow placed on the same style object on Android.
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  surface: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
  },
});
