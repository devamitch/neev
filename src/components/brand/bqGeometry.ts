/**
 * Shared geometry for the BlinkQuest "bq" mark (assets/images/logo.png):
 * two interlocking rings with a b-stem rising on the left and a q-stem
 * dropping on the right, sleeping eyes inside the rings and a smile below.
 * Both the static and the animated icon draw from these numbers so the
 * mark is identical everywhere.
 */
export const BQ_VIEWBOX = { width: 120, height: 104 } as const
export const BQ_ASPECT = BQ_VIEWBOX.height / BQ_VIEWBOX.width

/** Ring centre-line radius and stroke (outer edge 24.5, inner hole 13.5). */
export const BQ_RING = { r: 19, stroke: 11, cy: 50, bx: 40, qx: 80 } as const
export const BQ_STEM_B = { x: 15.5, y: 4, width: 10.5, height: 60, rx: 1.4 } as const
export const BQ_STEM_Q = { x: 94, y: 30, width: 10.5, height: 66, rx: 1.4 } as const

export const BQ_FEATURE_STROKE = 3.6
export const BQ_EYE_HALF = 7.5
export const BQ_EYE_Y = 48

/** Sleeping eye: a soft "‿" arc centred on a ring. */
export function bqSleepingEye(cx: number, depth = 4.5): string {
  "worklet"
  const y = BQ_EYE_Y
  return `M ${cx - BQ_EYE_HALF} ${y} Q ${cx} ${y + depth * 2} ${cx + BQ_EYE_HALF} ${y}`
}

/** Happy / laughing eye: an upturned "^" arc centred on a ring. */
export function bqHappyEye(cx: number): string {
  "worklet"
  const y = BQ_EYE_Y + 4
  return `M ${cx - BQ_EYE_HALF} ${y} Q ${cx} ${y - 10} ${cx + BQ_EYE_HALF} ${y}`
}

/** Inner hole radius of each ring (where the eyes live). */
export const BQ_HOLE_R = BQ_RING.r - BQ_RING.stroke / 2

/** Smile under the rings; `depth` deepens it into a grin. */
export function bqSmile(depth = 8): string {
  "worklet"
  return `M 47 83 Q 60 ${83 + depth * 2} 73 83`
}
