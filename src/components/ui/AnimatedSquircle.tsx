/**
 * Animated Squircle View for BlinkQuest.
 *
 * Integrates Reanimated with the squircle silhouette, allowing cards, buttons,
 * indicators, and interactive surfaces to animate scale, position, opacity, and
 * geometry without losing their smooth squircle corners.
 */
import { memo, type ReactNode } from 'react';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { Squircle, type SquircleProps } from './Squircle';

const BaseAnimatedSquircle = Animated.createAnimatedComponent(Squircle);

export type AnimatedSquircleProps = AnimatedProps<SquircleProps> & {
  children?: ReactNode;
};

export const AnimatedSquircle = memo(function AnimatedSquircle(props: AnimatedSquircleProps) {
  return <BaseAnimatedSquircle {...props} />;
});

export default AnimatedSquircle;
