/**
 * The squircle outline, in TypeScript.
 *
 * Implements smooth squircle geometry following the Figma corner-smoothing construction.
 * Used by cards, tiles, chips, and surfaces that need Setu's organic corner silhouette.
 */

export interface SquircleGeometry {
  width: number;
  height: number;
  radius: number;
  /** 0 is a plain rounded rectangle, 1 is the fully smoothed squircle. Setu's default is 0.6. */
  smoothing?: number;
}

interface Corner {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  radius: number;
  arcSectionLength: number;
}

const QUARTER_TURN = 90;
const SQRT_TWO = Math.SQRT2;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

function corner(radius: number, budget: number, smoothing: number): Corner {
  if (radius <= 0 || budget <= 0) {
    return { a: 0, b: 0, c: 0, d: 0, p: 0, radius: 0, arcSectionLength: 0 };
  }

  const maximumSmoothing = Math.max(budget / radius - 1, 0);
  const safeSmoothing = Math.min(Math.max(smoothing, 0), 1, maximumSmoothing);
  const p = Math.min((1 + safeSmoothing) * radius, budget);

  const arcMeasure = QUARTER_TURN * (1 - safeSmoothing);
  const arcSectionLength = Math.sin(toRadians(arcMeasure / 2)) * radius * SQRT_TWO;

  const angleAlpha = (QUARTER_TURN - arcMeasure) / 2;
  const p3ToP4Distance = radius * Math.tan(toRadians(angleAlpha / 2));
  const angleBeta = 45 * safeSmoothing;
  const c = p3ToP4Distance * Math.cos(toRadians(angleBeta));
  const d = c * Math.tan(toRadians(angleBeta));

  const b = (p - arcSectionLength - c - d) / 3;
  const a = 2 * b;

  return { a, b, c, d, p, radius, arcSectionLength };
}

const round = (value: number): string => (Math.round(value * 1000) / 1000).toString();

/** An SVG path for the squircle, in the component's own coordinate space. */
export function squirclePath({ width, height, radius, smoothing = 0.6 }: SquircleGeometry): string {
  if (width <= 0 || height <= 0) return '';

  const budget = Math.min(width, height) / 2;
  const limited = Math.min(radius, budget);
  const k = corner(limited, budget, smoothing);
  const { a, b, c, d, p, arcSectionLength: arc } = k;
  const r = k.radius;

  if (r <= 0)
    return `M 0 0 L ${round(width)} 0 L ${round(width)} ${round(height)} L 0 ${round(height)} Z`;

  return [
    `M ${round(width - p)} 0`,
    `c ${round(a)} 0 ${round(a + b)} 0 ${round(a + b + c)} ${round(d)}`,
    `a ${round(r)} ${round(r)} 0 0 1 ${round(arc)} ${round(arc)}`,
    `c ${round(d)} ${round(c)} ${round(d)} ${round(b + c)} ${round(d)} ${round(a + b + c)}`,
    `L ${round(width)} ${round(height - p)}`,
    `c 0 ${round(a)} 0 ${round(a + b)} ${round(-d)} ${round(a + b + c)}`,
    `a ${round(r)} ${round(r)} 0 0 1 ${round(-arc)} ${round(arc)}`,
    `c ${round(-c)} ${round(d)} ${round(-(b + c))} ${round(d)} ${round(-(a + b + c))} ${round(d)}`,
    `L ${round(p)} ${round(height)}`,
    `c ${round(-a)} 0 ${round(-(a + b))} 0 ${round(-(a + b + c))} ${round(-d)}`,
    `a ${round(r)} ${round(r)} 0 0 1 ${round(-arc)} ${round(-arc)}`,
    `c ${round(-d)} ${round(-c)} ${round(-d)} ${round(-(b + c))} ${round(-d)} ${round(-(a + b + c))}`,
    `L 0 ${round(p)}`,
    `c 0 ${round(-a)} 0 ${round(-(a + b))} ${round(d)} ${round(-(a + b + c))}`,
    `a ${round(r)} ${round(r)} 0 0 1 ${round(arc)} ${round(-arc)}`,
    `c ${round(c)} ${round(-d)} ${round(b + c)} ${round(-d)} ${round(a + b + c)} ${round(-d)}`,
    'Z',
  ].join(' ');
}

/** The radius a shape resolves to, so a caller can keep `borderRadius` clipping in step. */
export function squircleRadius(
  shape: 'squircle' | 'rounded' | 'pill' | 'circle',
  radius: number,
  width: number,
  height: number
): number {
  if (shape === 'circle' || shape === 'pill') return Math.min(width, height) / 2;
  return Math.min(radius, Math.min(width, height) / 2);
}
