import { FeedbackGradients, type ThemeColors } from './setuColors';

export type Stops = readonly [string, string, ...string[]];

export interface Gradients {
  primary: Stops;
  orb: Stops;
  secondary: Stops;
  primarySoft: Stops;
  errorSoft: Stops;
  accentText: Stops;
  titleInk: Stops;
  titleInkOnMedia: Stops;
  errorText: Stops;
  success: Stops;
  error: Stops;
  info: Stops;
  warning: Stops;
}

const HEX = /^#[0-9a-f]{6}$/i;
const MEDIA_TITLE_INK: Stops = ['#FFFFFF', '#D8DAE0', '#9FA3AD'];

function channels(color: string): [number, number, number] | null {
  if (HEX.test(color)) {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const match = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
  if (!match) return null;
  const parts = match[1].split(',').map((part) => parseFloat(part));
  if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return null;
  return [parts[0], parts[1], parts[2]];
}

export function withAlpha(color: string, alpha: number): string {
  const c = channels(color);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${alpha})` : color;
}

export function mix(color: string, target: string, amount: number): string {
  const a = channels(color);
  const b = channels(target);
  if (!a || !b) return color;
  const ch = (i: number) => Math.round(a[i] * (1 - amount) + b[i] * amount);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

export function gradientsFor(colors: ThemeColors): Gradients {
  const isDark = colors.scheme === 'dark';
  return {
    primary: colors.primaryGradient,
    orb: isDark ? ['#FF8060', '#FF5634', '#C93618'] : ['#FF6E48', '#F2512C', '#C23717'],
    secondary: isDark
      ? ['#46453F', '#3A3935', '#30302E']
      : ['#FAF9F5', '#F0EEE6', '#E5E2D9'],
    primarySoft: [
      withAlpha(colors.primary, 0.22),
      withAlpha(colors.primary, 0.12),
      withAlpha(colors.primary, 0.05),
    ],
    errorSoft: [
      withAlpha(colors.error, 0.25),
      withAlpha(colors.error, 0.12),
      withAlpha(colors.error, 0.05),
    ],
    accentText: isDark
      ? ['#F0A080', '#E38563', '#C76644']
      : ['#C7541E', '#B8470F', '#933507'],
    titleInk: isDark
      ? ['#FFFFFF', '#D8DAE0', '#9FA3AD']
      : ['#1A1815', '#3B3833', '#6E6962'],
    titleInkOnMedia: MEDIA_TITLE_INK,
    errorText: isDark
      ? ['#FFA8A0', '#F59A92', '#D96E66']
      : ['#CE3B3B', '#BE3434', '#9B2424'],
    success: FeedbackGradients.success,
    error: FeedbackGradients.error,
    info: FeedbackGradients.info,
    warning: FeedbackGradients.warning,
  };
}
