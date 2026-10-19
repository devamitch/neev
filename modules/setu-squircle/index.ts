import { requireNativeView } from 'expo';
import React from 'react';
import { Platform, View, type ViewProps } from 'react-native';

export interface ExpoSquircleViewProps extends ViewProps {
  squircleBackgroundColor?: string | number;
  squircleBorderColor?: string | number;
  squircleHighlightColor?: string | number;
  squircleAccentColor?: string | number;
  squircleBorderWidth?: number;
  squircleRadius?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
  cornerSmoothing?: number;
  preserveSmoothing?: boolean;
  shape?: 'squircle' | 'rounded' | 'pill' | 'circle';
  glassEnabled?: boolean;
  glassOpacity?: number;
  glassEdgeIntensity?: number;
  glassHighlightIntensity?: number;
  glassLightX?: number;
  glassLightY?: number;
  glassInteractive?: boolean;
  clipContent?: boolean;
}

const NativeView: React.ComponentType<ExpoSquircleViewProps> | null =
  Platform.OS === 'android'
    ? (() => {
        try {
          return requireNativeView<ExpoSquircleViewProps>('ExpoSquircleView');
        } catch {
          return null;
        }
      })()
    : null;

/**
 * Native Squircle View for Android (hardware accelerated Path clipping)
 * with graceful fallback to standard View on iOS & Web.
 */
export const NativeSquircleView: React.FC<ExpoSquircleViewProps> = (props) => {
  if (NativeView) {
    return React.createElement(NativeView, props);
  }
  return React.createElement(View, props);
};

export default NativeSquircleView;
