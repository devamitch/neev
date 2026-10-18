import { Dimensions, PixelRatio, TextStyle } from 'react-native';

const { width } = Dimensions.get('window');
// Mild width scaling, clamped so large phones don't inflate type and small ones stay legible
const scale = Math.min(Math.max(width / 390, 0.92), 1.06);

export function normalize(size: number): number {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * Type scale. Fraunces (editorial serif) for screen titles and hero numbers,
 * Geist for everything functional. AppText maps fontWeight to the matching
 * static Geist file, so the weights below are the source of truth.
 */
export const SetuTypography = {
  display: {
    fontFamily: 'Fraunces-Variable',
    fontSize: normalize(34),
    lineHeight: normalize(40),
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: 'Fraunces-Variable',
    fontSize: normalize(30),
    lineHeight: normalize(36),
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: 'Geist-SemiBold',
    fontSize: normalize(21),
    lineHeight: normalize(27),
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: 'Geist-SemiBold',
    fontSize: normalize(17),
    lineHeight: normalize(23),
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: 'Geist-Regular',
    fontSize: normalize(15),
    lineHeight: normalize(22),
  },
  bodyMedium: {
    fontFamily: 'Geist-Medium',
    fontSize: normalize(15),
    lineHeight: normalize(22),
    fontWeight: '500' as TextStyle['fontWeight'],
  },
  bodyBold: {
    fontFamily: 'Geist-SemiBold',
    fontSize: normalize(15),
    lineHeight: normalize(22),
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  caption: {
    fontFamily: 'Geist-Regular',
    fontSize: normalize(13),
    lineHeight: normalize(18),
  },
  captionBold: {
    fontFamily: 'Geist-SemiBold',
    fontSize: normalize(13),
    lineHeight: normalize(18),
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  label: {
    fontFamily: 'Geist-Medium',
    fontSize: normalize(13),
    lineHeight: normalize(16),
    fontWeight: '500' as TextStyle['fontWeight'],
  },
  overline: {
    fontFamily: 'Geist-SemiBold',
    fontSize: normalize(11),
    lineHeight: normalize(14),
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 1.1,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },
  button: {
    fontFamily: 'Geist-SemiBold',
    fontSize: normalize(15),
    lineHeight: normalize(20),
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  code: {
    fontFamily: 'Courier',
    fontSize: normalize(14),
    lineHeight: normalize(20),
  },
} as const;
