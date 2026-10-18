/**
 * BlinkQuest's corner silhouette, for everything from a badge to a full-bleed card.
 *
 * It is a plain React Native `View` that paints a squircle behind its children, so padding, margin,
 * width, height, flex, alignment, style arrays and conditional styles all behave exactly as they do
 * on a standard `View`.
 *
 * It reads the same style keys `SquircleSurface` does — `backgroundColor`, `borderColor`,
 * `borderWidth`, `borderRadius` — and paints them against the squircle path instead of a rectangle,
 * so the two are interchangeable at a call site.
 *
 * `gradient` and `borderGradient` paint the fill and the edge as gradients along the same path.
 */
import { memo, useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { squirclePath, squircleRadius } from '@/theme/squirclePath';
import type { Stops } from '@/theme/setuGradients';
import { useColors } from '@/theme/useTheme';

export type SquircleShape = 'squircle' | 'rounded' | 'pill' | 'circle';

export interface SquircleGradientDirection {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface SquircleProps extends ViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  shape?: SquircleShape;
  radius?: number;
  /** 0 is a plain rounded rectangle, 1 is fully smoothed squircle. BlinkQuest default is 1. */
  smoothing?: number;
  /** Overrides `style.backgroundColor`. Pass `transparent` for a border-only shape. */
  fill?: string;
  /** Fills the shape with a gradient instead of a flat colour. */
  gradient?: Stops | null;
  /** Defaults to top-left to bottom-right diagonal. */
  gradientDirection?: SquircleGradientDirection;
  /** Strokes the edge with a gradient instead of `style.borderColor`. Needs a `borderWidth`. */
  borderGradient?: Stops | null;
  /** Defaults to the same diagonal as the fill. */
  borderGradientDirection?: SquircleGradientDirection;
  /** Clips children to the resolved radius. Defaults to true unless overflow: 'visible'. */
  clip?: boolean;
}

const DEFAULT_RADIUS = 20;
const DIAGONAL: Required<SquircleGradientDirection> = { x1: 0, y1: 0, x2: 1, y2: 1 };

export const Squircle = memo(function Squircle({
  children,
  style,
  shape = 'squircle',
  radius,
  smoothing = 1,
  fill,
  gradient,
  gradientDirection,
  borderGradient,
  borderGradientDirection,
  clip: clipProp,
  onLayout,
  ...rest
}: SquircleProps) {
  const colors = useColors();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height }
      );
      onLayout?.(event);
    },
    [onLayout]
  );

  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;

  const styleRadius =
    typeof flattened?.borderRadius === 'number' ? flattened.borderRadius : undefined;
  const resolvedRadius = squircleRadius(
    shape,
    radius ?? styleRadius ?? DEFAULT_RADIUS,
    size.width,
    size.height
  );

  const strokeWidth =
    typeof flattened?.borderWidth === 'number' && flattened.borderWidth > 0
      ? flattened.borderWidth
      : 0;

  const inset = strokeWidth / 2;
  const path = useMemo(
    () =>
      squirclePath({
        width: Math.max(0, size.width - strokeWidth),
        height: Math.max(0, size.height - strokeWidth),
        radius: Math.max(0, resolvedRadius - inset),
        smoothing: shape === 'rounded' ? 0 : smoothing,
      }),
    [inset, resolvedRadius, shape, size.height, size.width, smoothing, strokeWidth]
  );

  const flatFill = fill ?? asColor(flattened?.backgroundColor) ?? colors.surface;
  const flatStroke =
    strokeWidth > 0 ? (asColor(flattened?.borderColor) ?? colors.border) : undefined;

  const fillId = `sqf${uid}`;
  const strokeId = `sqs${uid}`;
  const usesFillGradient = isStops(gradient);
  const usesStrokeGradient = strokeWidth > 0 && isStops(borderGradient);

  const clip = clipProp ?? flattened?.overflow !== 'visible';
  const drawn = size.width > 0 && size.height > 0 && path.length > 0;

  return (
    <View
      {...rest}
      onLayout={handleLayout}
      style={[
        flattened,
        drawn
          ? {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              borderWidth: 0,
            }
          : {
              backgroundColor: flatFill,
              borderColor: flatStroke,
              borderWidth: strokeWidth,
            },
        clip ? { borderRadius: resolvedRadius, overflow: 'hidden' } : { borderRadius: 0 },
      ]}
    >
      {drawn ? (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}
        >
          {usesFillGradient || usesStrokeGradient ? (
            <Defs>
              {usesFillGradient ? (
                <LinearGradient id={fillId} {...{ ...DIAGONAL, ...gradientDirection }}>
                  {gradient!.map((color, index) => (
                    <Stop
                      key={index}
                      offset={offsetAt(index, gradient!.length)}
                      stopColor={color}
                    />
                  ))}
                </LinearGradient>
              ) : null}
              {usesStrokeGradient ? (
                <LinearGradient
                  id={strokeId}
                  {...{ ...DIAGONAL, ...(borderGradientDirection ?? gradientDirection) }}
                >
                  {borderGradient!.map((color, index) => (
                    <Stop
                      key={index}
                      offset={offsetAt(index, borderGradient!.length)}
                      stopColor={color}
                    />
                  ))}
                </LinearGradient>
              ) : null}
            </Defs>
          ) : null}
          <G transform={`translate(${inset}, ${inset})`}>
            <Path
              d={path}
              fill={usesFillGradient ? `url(#${fillId})` : flatFill}
              stroke={usesStrokeGradient ? `url(#${strokeId})` : flatStroke}
              strokeWidth={strokeWidth}
            />
          </G>
        </Svg>
      ) : null}
      {children}
    </View>
  );
});

function asColor(value: ViewStyle['backgroundColor']): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isStops(value: Stops | null | undefined): value is Stops {
  return Array.isArray(value) && value.length >= 2;
}

function offsetAt(index: number, length: number): number {
  return length > 1 ? index / (length - 1) : 0;
}

export default Squircle;
