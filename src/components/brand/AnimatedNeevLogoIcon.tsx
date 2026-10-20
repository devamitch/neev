import { PressableScale } from "@/components/ui/PressableScale"
import { useRootStore } from "@/stores/useRootStore"
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Skia,
  vec,
} from "@shopify/react-native-skia"
import * as Haptics from "expo-haptics"
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import { StyleProp, ViewStyle } from "react-native"
import {
  Easing,
  SharedValue,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"

/* ────────────────────────────────────────────────────────────────────────────
 * NeevLogoIcon — the exact Neev mark, drawn and animated entirely in
 * React Native Skia.
 *
 * Terracotta arch (carries the face) + green leaf diagonal + green pillar.
 * The leaf is the character's expressive "hand/hair": it waves, perks,
 * droops, and can even hide the face when Neev is shy.
 *
 * Usage
 *   <NeevLogoIcon size={64} />                         // idle personality
 *   <NeevLogoIcon animation="laugh" />                 // play once on mount / change
 *   <NeevLogoIcon animation="wave" animationKey={n} /> // bump key to replay
 *   const ref = useRef<NeevLogoHandle>(null); ref.current?.play("flip")
 *   <NeevLogoIcon personality={false} />               // only breathing + your calls
 *   <NeevLogoIcon playful={false} />                   // flat static emblem
 * ──────────────────────────────────────────────────────────────────────────── */

export const NEEV_ANIMATIONS = [
  // eyes
  "blink",
  "wink",
  "lookLeft",
  "lookRight",
  "lookAround",
  // moods
  "smile",
  "laugh",
  "surprised",
  "shy", // leaf swings over the face — peek-a-boo
  "sad",
  "angry",
  "sleepy",
  "love",
  // leaf
  "wave",
  "perk",
  "shine", // light sweeps across the leaf
  // body
  "wiggle",
  "hop",
  "flip", // somersault
  "turn", // coin turn
  "tilt", // curious head tilt
  "dance",
] as const

export type NeevAnimation = (typeof NEEV_ANIMATIONS)[number]

export interface NeevLogoHandle {
  play: (name: NeevAnimation) => void
  reset: () => void
}

export interface NeevLogoIconProps {
  size?: number
  withBackground?: boolean
  /** Face, leaf motion and all animation. false = flat static emblem. */
  playful?: boolean
  interactive?: boolean
  /** Random idle behaviour (blink, look around, wink, wave, hop…). */
  personality?: boolean
  /** Plays when this changes (and on mount). */
  animation?: NeevAnimation
  /** Change it to replay the same `animation`. */
  animationKey?: number | string
  onAnimationEnd?: (name: NeevAnimation) => void
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}

const NEEV_WHISPERS = [
  "Neev is looking after your family sanctuary today 🌱",
  "Take a mindful breath. Your household routines are in harmony 🕊️",
  "All family tasks & schedules are running peacefully 🌿",
  "Grandparents and loved ones are safe & connected 💛",
  "A gentle reminder to pause and share a warm smile together 🌸",
]

const IDLE_POOL: NeevAnimation[] = [
  "blink",
  "blink",
  "blink",
  "blink",
  "blink",
  "blink",
  "lookAround",
  "lookLeft",
  "lookRight",
  "smile",
  "smile",
  "wink",
  "tilt",
  "perk",
  "wave",
  "shine",
  "shine",
  "shy",
  "wiggle",
  "laugh",
  "hop",
  "love",
  "surprised",
  "sleepy",
  "flip",
  "dance",
]

const PRESS_POOL: NeevAnimation[] = [
  "hop",
  "wave",
  "laugh",
  "wink",
  "flip",
  "turn",
  "perk",
  "dance",
  "love",
  "wiggle",
  "surprised",
  "shine",
]

/* ── Palette (sampled from the logo PNG) ──────────────────────────────────── */

const C = {
  medallion: "#F5F5EF",
  vein: "#F7F6F0",
  terracotta: "#D09D78",
  leaf: "#9AB394",
  ink: "#33231D",
  mouth: "#5A241C",
  blush: "#F0B49F",
  flush: "#D6402B",
  heart: "#E8745A",
}

/* ── Geometry (1024 × 1024, traced from the PNG) ──────────────────────────── */

const ARCH =
  "M255 752 L255 395 A140 140 0 0 1 528 362 C476 410 434 495 416 595 C408 650 402 710 398 768 L271 768 C262 768 255 761 255 752 Z"
const PILLAR =
  "M768 441 L768 746 C768 758 758 768 746 768 L646 768 C634 768 626 760 625 748 C622 700 618 650 610 603 C675 568 733 515 768 441 Z"
const LEAF =
  "M765 255 C771 330 771 395 768 441 C735 505 650 552 572 584 C520 604 478 620 450 640 C428 658 418 705 418 768 L398 768 C400 715 412 672 432 632 C434 540 470 438 532 378 C595 318 680 275 765 255 Z"

// [path, strokeWidth]
const VEINS: [string, number][] = [
  ["M460 587 C520 545 650 425 736 310", 9],
  ["M512 553 C550 548 596 548 628 534", 6.5],
  ["M583 487 C630 474 682 464 709 437", 6.5],
  ["M520 534 C516 490 528 448 549 418", 6.5],
  ["M628 440 C622 405 635 372 651 347", 6.5],
]

const HEART = "M0 20 C-34 -4 -26 -36 0 -18 C26 -36 34 -4 0 20 Z"

// medallion + stage
const CX = 512
const CY = 512
const FEET_X = 512
const FEET_Y = 768
const LEAF_BASE_X = 408
const LEAF_BASE_Y = 770
const H = 80 // hop height, in logo units

// face sits on the arch
const EYE_LX = 318
const EYE_RX = 402
const EYE_Y = 432
const EYE_W = 28
const EYE_H = 40
const BROW_Y = 380
const MOUTH_X = 360
const MOUTH_Y = 486
const CHEEK_Y = 470

// visible window into the 1024 canvas
const VIEW_BG = { x: 140, y: 140, s: 744 }
const VIEW_FLAT = { x: 187, y: 150, s: 650 } // headroom for hops
const VIEW_TIGHT = { x: 230, y: 230, s: 564 } // static emblem

/* ── Shared values ────────────────────────────────────────────────────────── */

const BASE_SMILE = 0.45
const BASE_BLUSH = 0.35

const REST = {
  eyeL: 1, // 0 closed … 1 open … 1.25 wide
  eyeR: 1,
  lookX: 0, // -1 left … 1 right
  lookY: 0, // -1 up … 1 down
  smile: BASE_SMILE, // -1 frown … 1 big smile
  open: 0, // mouth open 0…1
  squint: 0, // happy ^ ^ eyes 0…1
  angry: 0, // 1 angry brows + red flush, -1 sad brows
  lift: 0, // brows up 0…1
  blush: BASE_BLUSH,
  jumpY: 0,
  squash: 1,
  shiftX: 0,
  tilt: 0, // lean around the feet (deg)
  spin: 0, // rotate around the centre (deg)
  turn: 0, // coin turn around the vertical axis (deg)
  leafRot: 0, // leaf swing around its base (deg, negative = up and left)
  leafK: 1, // leaf scale from its base
  shine: -1, // light sweep position along the leaf
  heart: 0, // floating heart 0…1
}

type RestKey = keyof typeof REST
type NeevValues = Record<RestKey | "breathe" | "sway", SharedValue<number>>

function useNeevValues(): NeevValues {
  const v = {
    eyeL: useSharedValue(REST.eyeL),
    eyeR: useSharedValue(REST.eyeR),
    lookX: useSharedValue(REST.lookX),
    lookY: useSharedValue(REST.lookY),
    smile: useSharedValue(REST.smile),
    open: useSharedValue(REST.open),
    squint: useSharedValue(REST.squint),
    angry: useSharedValue(REST.angry),
    lift: useSharedValue(REST.lift),
    blush: useSharedValue(REST.blush),
    jumpY: useSharedValue(REST.jumpY),
    squash: useSharedValue(REST.squash),
    shiftX: useSharedValue(REST.shiftX),
    tilt: useSharedValue(REST.tilt),
    spin: useSharedValue(REST.spin),
    turn: useSharedValue(REST.turn),
    leafRot: useSharedValue(REST.leafRot),
    leafK: useSharedValue(REST.leafK),
    shine: useSharedValue(REST.shine),
    heart: useSharedValue(REST.heart),
    breathe: useSharedValue(1),
    sway: useSharedValue(0),
  }
  return useRef(v).current
}

/* ── Animation library ────────────────────────────────────────────────────── */

type Ease = (t: number) => number
const to = (value: number, ms: number, easing: Ease = Easing.inOut(Easing.quad)) =>
  withTiming(value, { duration: ms, easing })
const seq = withSequence
// go to `value`, stay, come back to `rest`
const hold = (value: number, up: number, stay: number, down: number, rest: number) =>
  withSequence(to(value, up), to(value, stay), to(rest, down))
// ping-pong between a and b, n times
const wob = (a: number, b: number, ms: number, n: number) =>
  withRepeat(withSequence(to(a, ms), to(b, ms)), n, false)

// every animation returns its length in ms
function makeAnimations(v: NeevValues): Record<NeevAnimation, () => number> {
  const out = Easing.out(Easing.quad)
  const inn = Easing.in(Easing.quad)
  const cubic = Easing.inOut(Easing.cubic)
  const N = 38 // wiggle distance
  const J = 14 // angry shake distance

  const glance = (dir: number) => () => {
    v.lookX.value = hold(dir, 200, 800, 260, 0)
    v.tilt.value = hold(dir * 3, 200, 800, 260, 0)
    return 1260
  }

  return {
    blink: () => {
      v.eyeL.value = seq(to(0, 70), to(1, 110))
      v.eyeR.value = seq(to(0, 70), to(1, 110))
      return 180
    },

    wink: () => {
      v.eyeR.value = hold(0, 100, 460, 140, 1)
      v.smile.value = hold(1, 140, 460, 240, BASE_SMILE)
      v.blush.value = hold(1, 140, 460, 240, BASE_BLUSH)
      v.lift.value = hold(0.4, 140, 460, 240, 0)
      v.tilt.value = hold(-4, 140, 460, 240, 0)
      return 840
    },

    lookLeft: glance(-1),
    lookRight: glance(1),

    lookAround: () => {
      v.lookX.value = seq(to(-1, 240), to(-1, 480), to(1, 380), to(1, 480), to(0, 280))
      v.lookY.value = seq(to(-0.3, 240), to(-0.3, 480), to(0.25, 380), to(0.25, 480), to(0, 280))
      v.tilt.value = seq(to(-2, 240), to(-2, 480), to(2, 380), to(2, 480), to(0, 280))
      return 1860
    },

    smile: () => {
      v.smile.value = hold(1, 220, 1100, 340, BASE_SMILE)
      v.squint.value = hold(0.35, 220, 1100, 340, 0)
      v.blush.value = hold(1, 220, 1100, 340, BASE_BLUSH)
      return 1660
    },

    laugh: () => {
      v.smile.value = hold(1, 150, 1300, 300, BASE_SMILE)
      v.squint.value = hold(1, 150, 1300, 300, 0)
      v.blush.value = hold(1, 150, 1300, 300, BASE_BLUSH)
      v.open.value = seq(to(0.6, 150), wob(1, 0.45, 130, 5), to(0, 300))
      v.squash.value = seq(wob(0.96, 1.03, 130, 6), to(1, 100))
      v.jumpY.value = withRepeat(seq(to(-H * 0.1, 130, out), to(0, 130, inn)), 6, false)
      v.leafRot.value = seq(wob(-9, -2, 130, 6), to(0, 200))
      v.tilt.value = seq(wob(-3, 3, 130, 6), to(0, 150))
      return 1750
    },

    surprised: () => {
      v.eyeL.value = hold(1.25, 110, 1000, 300, 1)
      v.eyeR.value = hold(1.25, 110, 1000, 300, 1)
      v.open.value = hold(0.9, 110, 1000, 300, 0)
      v.smile.value = hold(0, 110, 1000, 300, BASE_SMILE)
      v.lift.value = hold(1, 110, 1000, 300, 0)
      v.leafK.value = hold(1.1, 110, 1000, 300, 1)
      v.leafRot.value = hold(-5, 110, 1000, 300, 0)
      v.jumpY.value = seq(to(-H * 0.4, 110, out), to(0, 170, inn))
      v.squash.value = seq(to(1.1, 110), to(1, 260))
      return 1410
    },

    // the leaf swings across the face like a hand — only one eye peeks out
    shy: () => {
      v.leafRot.value = hold(-20, 300, 1100, 400, 0)
      v.lookX.value = hold(-0.7, 250, 1300, 350, 0)
      v.lookY.value = hold(0.7, 250, 1300, 350, 0)
      v.blush.value = hold(1, 250, 1300, 350, BASE_BLUSH)
      v.smile.value = hold(0.7, 250, 1300, 350, BASE_SMILE)
      v.tilt.value = hold(-6, 250, 1300, 350, 0)
      return 1900
    },

    sad: () => {
      v.angry.value = hold(-1, 300, 1500, 450, 0)
      v.smile.value = hold(-0.75, 300, 1500, 450, BASE_SMILE)
      v.lookY.value = hold(0.6, 300, 1500, 450, 0)
      v.eyeL.value = hold(0.8, 300, 1500, 450, 1)
      v.eyeR.value = hold(0.8, 300, 1500, 450, 1)
      v.tilt.value = hold(-3, 300, 1500, 450, 0)
      v.squash.value = hold(0.97, 300, 1500, 450, 1)
      v.leafRot.value = hold(5, 300, 1500, 450, 0) // leaf droops
      return 2250
    },

    angry: () => {
      v.angry.value = hold(1, 180, 1500, 450, 0)
      v.smile.value = hold(-0.85, 180, 1500, 450, BASE_SMILE)
      v.open.value = hold(0.25, 180, 1500, 450, 0)
      v.blush.value = hold(0, 180, 1500, 450, BASE_BLUSH)
      v.squash.value = hold(0.97, 180, 1500, 450, 1)
      v.shiftX.value = seq(to(0, 180), withRepeat(seq(to(-J, 45), to(J, 45)), 16, false), to(0, 60))
      v.leafRot.value = seq(
        to(-6, 180),
        withRepeat(seq(to(-9, 60), to(-3, 60)), 12, false),
        to(0, 300),
      )
      return 2130
    },

    sleepy: () => {
      v.eyeL.value = seq(to(0.5, 500), to(0.12, 500), to(0.12, 1400), to(1, 350))
      v.eyeR.value = seq(to(0.5, 500), to(0.12, 500), to(0.12, 1400), to(1, 350))
      v.open.value = seq(to(0, 900), to(0.9, 450), to(0.9, 500), to(0, 350))
      v.lookY.value = hold(0.4, 500, 1800, 400, 0)
      v.smile.value = hold(0.1, 500, 1800, 400, BASE_SMILE)
      v.tilt.value = seq(to(3, 700), to(-2, 600), to(4, 700), to(0, 500))
      v.leafRot.value = hold(3, 700, 1400, 500, 0)
      return 2750
    },

    love: () => {
      v.heart.value = seq(to(0, 0), to(1, 1500, out), to(0, 0))
      v.smile.value = hold(1, 200, 1500, 300, BASE_SMILE)
      v.squint.value = hold(1, 200, 1500, 300, 0)
      v.blush.value = hold(1, 200, 1500, 300, BASE_BLUSH)
      v.squash.value = seq(wob(1.05, 0.99, 170, 4), to(1, 150))
      v.leafRot.value = seq(wob(-7, 0, 200, 4), to(0, 150))
      v.tilt.value = hold(-4, 250, 1300, 350, 0)
      return 2000
    },

    wave: () => {
      v.leafRot.value = seq(to(-8, 220), wob(-17, -6, 170, 5), to(0, 260))
      v.smile.value = hold(0.9, 220, 1700, 260, BASE_SMILE)
      v.lookX.value = hold(0.6, 220, 1700, 260, 0)
      v.tilt.value = hold(-3, 220, 1700, 260, 0)
      return 2180
    },

    perk: () => {
      v.leafK.value = seq(to(1.1, 170, Easing.out(Easing.back(2))), to(1.1, 700), to(1, 300))
      v.leafRot.value = seq(to(-4, 170), to(-1, 200), to(-3, 200), to(0, 600))
      v.lift.value = hold(1, 170, 700, 300, 0)
      v.eyeL.value = hold(1.15, 170, 700, 300, 1)
      v.eyeR.value = hold(1.15, 170, 700, 300, 1)
      v.lookY.value = hold(-0.8, 200, 670, 300, 0)
      v.squash.value = seq(to(1.05, 170), to(1, 300))
      return 1170
    },

    shine: () => {
      v.shine.value = seq(to(-0.3, 0), to(1.3, 1100, cubic), to(-1, 0))
      v.smile.value = hold(0.8, 200, 800, 200, BASE_SMILE)
      return 1200
    },

    wiggle: () => {
      v.shiftX.value = seq(to(-N, 100), to(N * 0.7, 110), to(-N * 0.35, 100), to(0, 110))
      v.tilt.value = seq(to(-6, 100), to(4, 110), to(-2, 100), to(0, 110))
      v.leafRot.value = seq(to(-6, 100), to(2, 110), to(-3, 100), to(0, 110))
      v.lookX.value = hold(1, 100, 300, 200, 0)
      v.open.value = hold(0.3, 100, 200, 120, 0)
      v.lift.value = hold(0.6, 100, 200, 120, 0)
      return 600
    },

    hop: () => {
      v.jumpY.value = seq(to(0, 130), to(-H, 280, out), to(0, 260, inn))
      v.squash.value = seq(
        to(0.84, 130),
        to(1.12, 140),
        to(1, 140),
        to(1.04, 190),
        to(0.86, 70),
        withSpring(1, { damping: 6, stiffness: 260 }),
      )
      // the leaf lags behind the body, then whips over on landing
      v.leafRot.value = seq(to(6, 130), to(-10, 280), to(4, 200), to(0, 250))
      v.tilt.value = seq(to(2, 130), to(-3, 280), to(0, 260))
      v.smile.value = hold(1, 150, 520, 300, BASE_SMILE)
      v.open.value = hold(0.5, 150, 420, 250, 0)
      return 950
    },

    flip: () => {
      v.jumpY.value = seq(to(-H * 1.1, 330, out), to(0, 330, inn))
      v.spin.value = seq(to(360, 660, cubic), to(0, 0))
      v.squash.value = seq(to(1, 660), to(0.86, 60), withSpring(1, { damping: 7, stiffness: 260 }))
      v.leafRot.value = seq(to(-10, 250), to(8, 300), to(0, 300))
      v.smile.value = hold(1, 150, 520, 300, BASE_SMILE)
      return 1000
    },

    turn: () => {
      v.turn.value = seq(to(360, 850, cubic), to(0, 0))
      v.jumpY.value = seq(to(-H * 0.25, 400, out), to(0, 450, inn))
      v.smile.value = hold(1, 200, 450, 250, BASE_SMILE)
      return 900
    },

    tilt: () => {
      v.tilt.value = seq(to(8, 280), to(8, 650), to(-3, 260), to(-3, 330), to(0, 260))
      v.leafRot.value = seq(to(-6, 280), to(-6, 650), to(2, 260), to(2, 330), to(0, 260))
      v.lookY.value = hold(-0.3, 280, 1240, 260, 0)
      v.lift.value = hold(0.6, 280, 1240, 260, 0)
      return 1780
    },

    dance: () => {
      v.tilt.value = seq(wob(-8, 8, 220, 6), to(0, 200))
      v.shiftX.value = seq(wob(-N * 0.5, N * 0.5, 220, 6), to(0, 200))
      v.jumpY.value = withRepeat(seq(to(-H * 0.22, 110, out), to(0, 110, inn)), 12, false)
      v.squash.value = seq(wob(0.97, 1.03, 110, 12), to(1, 100))
      v.leafRot.value = seq(wob(-12, 3, 220, 6), to(0, 200))
      v.smile.value = hold(1, 200, 2400, 240, BASE_SMILE)
      v.open.value = hold(0.5, 200, 2400, 240, 0)
      v.squint.value = hold(0.5, 200, 2400, 240, 0)
      v.blush.value = hold(1, 200, 2400, 240, BASE_BLUSH)
      return 2840
    },
  }
}

/* ── Worklet helpers ──────────────────────────────────────────────────────── */

type Tf =
  | { translateX: number }
  | { translateY: number }
  | { rotate: number }
  | { scale: number }
  | { scaleX: number }
  | { scaleY: number }

const rad = (deg: number) => {
  "worklet"
  return (deg * Math.PI) / 180
}

const clamp01 = (n: number) => {
  "worklet"
  return Math.min(1, Math.max(0, n))
}

function mouthPath(s: number, o: number) {
  "worklet"
  const w = 24 + 12 * Math.max(s, 0) + 7 * o
  const c = 34 * s
  const d = 28 * o
  const p = Skia.Path.Make()
  p.moveTo(MOUTH_X - w, MOUTH_Y)
  p.quadTo(MOUTH_X, MOUTH_Y + c, MOUTH_X + w, MOUTH_Y)
  p.quadTo(MOUTH_X, MOUTH_Y + c + 2 * d, MOUTH_X - w, MOUTH_Y)
  p.close()
  return p
}

function browPath(cx: number, side: number, a: number, lift: number) {
  "worklet"
  const by = BROW_Y - lift * 12
  const outerY = by - a * 10
  const innerY = by + a * 26
  const ctrlY = (outerY + innerY) / 2 - 7 * (1 - Math.abs(a))
  const p = Skia.Path.Make()
  p.moveTo(cx + side * 17, outerY)
  p.quadTo(cx, ctrlY, cx - side * 14, innerY)
  return p
}

/* ── Static artwork ───────────────────────────────────────────────────────── */

const LeafArt = memo(function LeafArt() {
  return (
    <>
      <Path path={LEAF} color={C.leaf} />
      {VEINS.map(([d, w]) => (
        <Path key={d} path={d} style="stroke" strokeWidth={w} strokeCap="round" color={C.vein} />
      ))}
    </>
  )
})

// soft light that sweeps diagonally across the leaf
const LeafShine = memo(function LeafShine({ shine }: { shine: SharedValue<number> }) {
  const start = useDerivedValue(() => {
    const s = shine.value - 0.2
    return vec(420 + 350 * s, 720 - 465 * s)
  })
  const end = useDerivedValue(() => {
    const s = shine.value + 0.2
    return vec(420 + 350 * s, 720 - 465 * s)
  })
  return (
    <Path path={LEAF}>
      <LinearGradient
        start={start}
        end={end}
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
      />
    </Path>
  )
})

/* ── Animated face ────────────────────────────────────────────────────────── */

type SV = SharedValue<number>

const Eye = memo(function Eye({
  cx,
  open,
  lookX,
  lookY,
  squint,
}: {
  cx: number
  open: SV
  lookX: SV
  lookY: SV
  squint: SV
}) {
  const h = useDerivedValue(() => Math.max(4, EYE_H * open.value))
  const x = useDerivedValue(() => cx - EYE_W / 2 + lookX.value * 9)
  const y = useDerivedValue(() => EYE_Y + lookY.value * 7 - h.value / 2)
  const gx = useDerivedValue(() => cx + lookX.value * 9 + 5.5)
  const gy = useDerivedValue(() => y.value + Math.min(h.value, EYE_H) * 0.3)
  const inkO = useDerivedValue(() => clamp01(1 - squint.value * 2.2))
  const glintO = useDerivedValue(() => (open.value > 0.4 ? inkO.value : 0))
  const arcO = useDerivedValue(() => clamp01((squint.value - 0.2) * 2.5))
  const arc = `M ${cx - 15} ${EYE_Y + 8} Q ${cx} ${EYE_Y - 16} ${cx + 15} ${EYE_Y + 8}`
  return (
    <>
      <Oval x={x} y={y} width={EYE_W} height={h} color={C.ink} opacity={inkO} />
      <Circle cx={gx} cy={gy} r={5.5} color="#FFFFFF" opacity={glintO} />
      <Path
        path={arc}
        style="stroke"
        strokeWidth={8}
        strokeCap="round"
        color={C.ink}
        opacity={arcO}
      />
    </>
  )
})

const Brow = memo(function Brow({
  cx,
  side,
  angry,
  lift,
}: {
  cx: number
  side: number
  angry: SV
  lift: SV
}) {
  const path = useDerivedValue(() => browPath(cx, side, angry.value, lift.value))
  const o = useDerivedValue(() => clamp01(Math.max(Math.abs(angry.value) * 1.6, lift.value * 1.3)))
  return (
    <Path path={path} style="stroke" strokeWidth={7} strokeCap="round" color={C.ink} opacity={o} />
  )
})

const Cheek = memo(function Cheek({ cx, blush }: { cx: number; blush: SV }) {
  const o = useDerivedValue(() => 0.25 + 0.6 * blush.value)
  return (
    <Oval x={cx - 20} y={CHEEK_Y - 12} width={40} height={24} color={C.blush} opacity={o}>
      <BlurMask blur={7} style="normal" />
    </Oval>
  )
})

const Mouth = memo(function Mouth({ smile, open }: { smile: SV; open: SV }) {
  const path = useDerivedValue(() => mouthPath(smile.value, open.value))
  const fillO = useDerivedValue(() => clamp01(open.value * 6))
  return (
    <>
      <Path path={path} color={C.mouth} opacity={fillO} />
      <Path
        path={path}
        style="stroke"
        strokeWidth={7}
        strokeCap="round"
        strokeJoin="round"
        color={C.ink}
      />
    </>
  )
})

const Face = memo(function Face({ v }: { v: NeevValues }) {
  const { eyeL, eyeR, lookX, lookY, smile, open, squint, angry, lift, blush } = v
  const openL = useDerivedValue(() =>
    Math.max(0, eyeL.value * (1 - 0.38 * Math.max(0, angry.value)) * (1 - squint.value)),
  )
  const openR = useDerivedValue(() =>
    Math.max(0, eyeR.value * (1 - 0.38 * Math.max(0, angry.value)) * (1 - squint.value)),
  )
  return (
    <Group>
      <Cheek cx={296} blush={blush} />
      <Cheek cx={424} blush={blush} />
      <Eye cx={EYE_LX} open={openL} lookX={lookX} lookY={lookY} squint={squint} />
      <Eye cx={EYE_RX} open={openR} lookX={lookX} lookY={lookY} squint={squint} />
      <Brow cx={EYE_LX} side={-1} angry={angry} lift={lift} />
      <Brow cx={EYE_RX} side={1} angry={angry} lift={lift} />
      <Mouth smile={smile} open={open} />
    </Group>
  )
})

const Heart = memo(function Heart({ heart }: { heart: SV }) {
  const t = useDerivedValue<Tf[]>(() => [
    { translateX: 520 },
    { translateY: 235 - 80 * heart.value },
    { scale: 0.45 + 0.65 * heart.value },
  ])
  const o = useDerivedValue(() => Math.sin(Math.PI * clamp01(heart.value)))
  return (
    <Group transform={t} opacity={o}>
      <Path path={HEART} color={C.heart} />
    </Group>
  )
})

const Shadow = memo(function Shadow({ jumpY, shiftX }: { jumpY: SV; shiftX: SV }) {
  const w = useDerivedValue(() => 440 * (1 + jumpY.value / (H * 4)))
  const x = useDerivedValue(() => 512 + shiftX.value - w.value / 2)
  const o = useDerivedValue(() => 0.1 * (1 + jumpY.value / (H * 2.2)))
  return (
    <Oval x={x} y={766} width={w} height={32} color="#46322A" opacity={o}>
      <BlurMask blur={10} style="normal" />
    </Oval>
  )
})

/* ── Component ────────────────────────────────────────────────────────────── */

export const NeevLogoIcon = memo(
  forwardRef<NeevLogoHandle, NeevLogoIconProps>(function NeevLogoIcon(
    {
      size = 48,
      withBackground = true,
      playful = true,
      interactive = true,
      personality = true,
      animation,
      animationKey,
      onAnimationEnd,
      style,
      onPress,
    },
    ref,
  ) {
    const v = useNeevValues()
    const reduceMotion = useReducedMotion()
    const animations = useMemo(() => makeAnimations(v), [v])

    const busyUntil = useRef(0)
    const lastPress = useRef<NeevAnimation | null>(null)
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
    const onEndRef = useRef(onAnimationEnd)
    onEndRef.current = onAnimationEnd

    const play = useCallback(
      (name: NeevAnimation) => {
        if (!playful) return
        const ms = animations[name]()
        busyUntil.current = Date.now() + ms
        const id = setTimeout(() => {
          timers.current.delete(id)
          onEndRef.current?.(name)
        }, ms)
        timers.current.add(id)
      },
      [animations, playful],
    )

    const reset = useCallback(() => {
      ;(Object.keys(REST) as RestKey[]).forEach((key) => {
        cancelAnimation(v[key])
        v[key].value = REST[key]
      })
      busyUntil.current = 0
    }, [v])

    useImperativeHandle(ref, () => ({ play, reset }), [play, reset])

    // continuous life: breathing + gentle leaf sway
    useEffect(() => {
      if (!playful || reduceMotion) return
      v.breathe.value = withRepeat(
        withSequence(
          withTiming(1.022, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      )
      v.sway.value = -1
      v.sway.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
      return () => {
        cancelAnimation(v.breathe)
        cancelAnimation(v.sway)
        v.breathe.value = 1
        v.sway.value = 0
      }
    }, [playful, reduceMotion, v])

    // random personality
    useEffect(() => {
      if (!playful || !personality || reduceMotion) return
      let alive = true
      let timer: ReturnType<typeof setTimeout>
      const tick = () => {
        if (!alive) return
        if (Date.now() >= busyUntil.current) {
          play(IDLE_POOL[Math.floor(Math.random() * IDLE_POOL.length)])
        }
        timer = setTimeout(tick, 2200 + Math.random() * 3800)
      }
      timer = setTimeout(tick, 1800)
      return () => {
        alive = false
        clearTimeout(timer)
      }
    }, [playful, personality, reduceMotion, play])

    // controlled one-shot
    useEffect(() => {
      if (animation) play(animation)
    }, [animation, animationKey, play])

    useEffect(() => {
      const pending = timers.current
      return () => {
        pending.forEach(clearTimeout)
        pending.clear()
      }
    }, [])

    const handlePress = useCallback(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (playful) {
        let next = PRESS_POOL[Math.floor(Math.random() * PRESS_POOL.length)]
        if (next === lastPress.current)
          next = PRESS_POOL[(PRESS_POOL.indexOf(next) + 1) % PRESS_POOL.length]
        lastPress.current = next
        play(next)
      }
      if (onPress) {
        onPress()
      } else {
        useRootStore.getState().showToast({
          message: NEEV_WHISPERS[Math.floor(Math.random() * NEEV_WHISPERS.length)],
          type: "info",
          actionLabel: "Sanctuary",
        })
      }
    }, [onPress, play, playful])

    const { squash, shiftX, jumpY, tilt, spin, turn, breathe, sway, leafRot, leafK, angry } = v

    // whole character: hop/shift on the outside, squash + lean around the feet,
    // spin/coin-turn around the centre on the inside
    const rootT = useDerivedValue<Tf[]>(() => {
      const sq = squash.value
      const c = Math.cos(rad(turn.value))
      const turnX = Math.abs(c) < 0.03 ? 0.03 : c
      return [
        { translateX: shiftX.value },
        { translateY: jumpY.value },
        { translateX: FEET_X },
        { translateY: FEET_Y },
        { rotate: rad(tilt.value) },
        { scaleX: breathe.value * (1 + (1 - sq) * 0.6) },
        { scaleY: breathe.value * sq },
        { translateX: -FEET_X },
        { translateY: -FEET_Y },
        { translateX: CX },
        { translateY: CY },
        { rotate: rad(spin.value) },
        { scaleX: turnX },
        { translateX: -CX },
        { translateY: -CY },
      ]
    })

    // leaf pivots on the base of its stem
    const leafT = useDerivedValue<Tf[]>(() => [
      { translateX: LEAF_BASE_X },
      { translateY: LEAF_BASE_Y },
      { rotate: rad(leafRot.value + sway.value * 1.4) },
      { scale: leafK.value },
      { translateX: -LEAF_BASE_X },
      { translateY: -LEAF_BASE_Y },
    ])

    const flushO = useDerivedValue(() => Math.max(0, angry.value) * 0.38)

    const view = withBackground ? VIEW_BG : playful ? VIEW_FLAT : VIEW_TIGHT
    const viewT = [{ scale: size / view.s }, { translateX: -view.x }, { translateY: -view.y }]

    const content = (
      <Canvas style={[{ width: size, height: size }, style]}>
        <Group transform={viewT}>
          {withBackground ? <Circle cx={512} cy={512} r={365} color={C.medallion} /> : null}
          {playful ? (
            <>
              <Shadow jumpY={jumpY} shiftX={shiftX} />
              <Group transform={rootT}>
                <Path path={ARCH} color={C.terracotta} />
                <Path path={ARCH} color={C.flush} opacity={flushO} />
                <Path path={PILLAR} color={C.leaf} />
                <Face v={v} />
                <Group transform={leafT}>
                  <LeafArt />
                  <LeafShine shine={v.shine} />
                </Group>
              </Group>
              <Heart heart={v.heart} />
            </>
          ) : (
            <>
              <Path path={ARCH} color={C.terracotta} />
              <Path path={PILLAR} color={C.leaf} />
              <LeafArt />
            </>
          )}
        </Group>
      </Canvas>
    )

    if (interactive) {
      return (
        <PressableScale
          onPress={handlePress}
          hitSlop={6}
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel="Neev Sanctuary Companion"
        >
          {content}
        </PressableScale>
      )
    }

    return content
  }),
)

// drop-in for both previous file names
export const AnimatedNeevLogoIcon = NeevLogoIcon

export default NeevLogoIcon
