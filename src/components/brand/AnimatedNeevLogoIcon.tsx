import { PressableScale } from "@/components/ui/PressableScale"
import { useRootStore } from "@/stores/useRootStore"
import * as Haptics from "expo-haptics"
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg"

/* ────────────────────────────────────────────────────────────────────────────
 * NeevLogoIcon — living "N" companion
 *
 * Shape: terracotta arch pillar (left, carries the face) + pista pillar with a rounded foot (right),
 * joined by a veined leaf diagonal. Hands are leaves, hair is a sprout.
 *
 * Usage
 *   <NeevLogoIcon size={64} />                         // idle personality (random blinks, looks, waves…)
 *   <NeevLogoIcon animation="laugh" />                 // play once on mount / when it changes
 *   <NeevLogoIcon animation="wave" animationKey={n} /> // bump animationKey to replay the same one
 *   const ref = useRef<NeevLogoHandle>(null); ref.current?.play("flip")
 *   <NeevLogoIcon personality={false} />               // no random behaviour, only breathing + your calls
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
  "angry",
  "sad",
  "shy",
  "surprised",
  // leaves & hair
  "wave", // right leaf waves hello
  "waveBoth", // both leaf-hands wave
  "sprout", // hair wiggle
  "perk", // hair pops up, eyes look up
  // body
  "nudge",
  "jump",
  "flip", // front flip
  "turn", // coin turn (around vertical axis)
  "spin", // rotate in place
  "roll", // roll sideways and back
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
  /** Face, leaf hands, hair and all animation. false = flat static emblem. */
  playful?: boolean
  interactive?: boolean
  /** Random idle behaviour (blink, look around, wink, wave, jump…). */
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
  "sprout",
  "sprout",
  "tilt",
  "perk",
  "nudge",
  "wave",
  "shy",
  "laugh",
  "jump",
  "spin",
  "roll",
  "flip",
  "dance",
  "surprised",
]

const PRESS_POOL: NeevAnimation[] = [
  "jump",
  "wave",
  "waveBoth",
  "laugh",
  "wink",
  "flip",
  "roll",
  "spin",
  "turn",
  "sprout",
  "perk",
  "dance",
  "nudge",
  "surprised",
]

/* ── Geometry (200×200 viewBox) ───────────────────────────────────────────── */

const STEM_L = "M40 144 L40 78 A20 20 0 0 1 80 78 L80 144 Q80 152 72 152 L48 152 Q40 152 40 144 Z"
const STEM_R = "M128 66 Q128 58 136 58 L152 58 Q160 58 160 66 L160 136 A16 16 0 0 1 128 136 Z"
const LEAF = "M62 70 C95 75 137 112 146 144 C113 139 71 102 62 70 Z"

// face sits on the arch pillar
const EYE_LX = 51.5
const EYE_RX = 68.5
const EYE_Y = 85
const BROW_Y = 72.5
const MOUTH_X = 60
const MOUTH_Y = 101
const CHEEK_Y = 96

const INK = "#231B18"

/* ── Shared values ────────────────────────────────────────────────────────── */

const BASE_SMILE = 0.35
const BASE_BLUSH = 0.3

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
  rot: 0,
  flipX: 0,
  flipY: 0,
  sprout: 0, // hair rotation (deg)
  sproutK: 1, // hair scale
  handL: 0, // + = leaf raised
  handR: 0, // - = leaf raised
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
    rot: useSharedValue(REST.rot),
    flipX: useSharedValue(REST.flipX),
    flipY: useSharedValue(REST.flipY),
    sprout: useSharedValue(REST.sprout),
    sproutK: useSharedValue(REST.sproutK),
    handL: useSharedValue(REST.handL),
    handR: useSharedValue(REST.handR),
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

// every animation returns its length in ms
function makeAnimations(v: NeevValues, size: number): Record<NeevAnimation, () => number> {
  const H = size * 0.2
  const out = Easing.out(Easing.quad)
  const inn = Easing.in(Easing.quad)
  const cubic = Easing.inOut(Easing.cubic)

  const glance = (dir: number) => () => {
    v.lookX.value = hold(dir, 220, 900, 280, 0)
    v.rot.value = hold(dir * 3, 220, 900, 280, 0)
    return 1400
  }

  return {
    blink: () => {
      v.eyeL.value = seq(to(0, 80), to(1, 110))
      v.eyeR.value = seq(to(0, 80), to(1, 110))
      return 190
    },

    wink: () => {
      v.eyeR.value = hold(0, 110, 520, 140, 1)
      v.smile.value = hold(1, 150, 520, 250, BASE_SMILE)
      v.blush.value = hold(0.9, 150, 520, 250, BASE_BLUSH)
      v.lift.value = hold(0.5, 150, 520, 250, 0)
      v.rot.value = hold(-5, 150, 520, 250, 0)
      return 920
    },

    lookLeft: glance(-1),
    lookRight: glance(1),

    lookAround: () => {
      v.lookX.value = seq(to(-1, 250), to(-1, 500), to(1, 380), to(1, 500), to(0, 300))
      v.lookY.value = seq(to(-0.3, 250), to(-0.3, 500), to(0.25, 380), to(0.25, 500), to(0, 300))
      return 1930
    },

    smile: () => {
      v.smile.value = hold(1, 220, 1100, 350, BASE_SMILE)
      v.squint.value = hold(0.3, 220, 1100, 350, 0)
      v.blush.value = hold(1, 220, 1100, 350, BASE_BLUSH)
      return 1670
    },

    laugh: () => {
      v.smile.value = hold(1, 150, 1300, 300, BASE_SMILE)
      v.squint.value = hold(1, 150, 1300, 300, 0)
      v.blush.value = hold(1, 150, 1300, 300, BASE_BLUSH)
      v.open.value = seq(
        to(0.6, 150),
        withRepeat(seq(to(1, 130), to(0.45, 130)), 5, false),
        to(0, 300),
      )
      v.squash.value = seq(withRepeat(seq(to(0.95, 130), to(1.04, 130)), 6, false), to(1, 120))
      v.handR.value = seq(withRepeat(seq(to(-18, 130), to(-4, 130)), 6, false), to(0, 150))
      v.handL.value = seq(withRepeat(seq(to(18, 130), to(4, 130)), 6, false), to(0, 150))
      v.sprout.value = seq(withRepeat(seq(to(7, 130), to(-7, 130)), 6, false), to(0, 150))
      return 1750
    },

    angry: () => {
      const J = size * 0.04
      v.angry.value = hold(1, 180, 1500, 450, 0)
      v.smile.value = hold(-0.9, 180, 1500, 450, BASE_SMILE)
      v.open.value = hold(0.3, 180, 1500, 450, 0)
      v.blush.value = hold(0, 180, 1500, 450, BASE_BLUSH)
      v.shiftX.value = seq(to(0, 180), withRepeat(seq(to(-J, 45), to(J, 45)), 16, false), to(0, 60))
      v.handR.value = seq(
        to(-20, 180),
        withRepeat(seq(to(-30, 70), to(-14, 70)), 10, false),
        to(0, 300),
      )
      v.handL.value = seq(
        to(20, 180),
        withRepeat(seq(to(30, 70), to(14, 70)), 10, false),
        to(0, 300),
      )
      v.sprout.value = seq(
        to(-12, 180),
        withRepeat(seq(to(-16, 60), to(-8, 60)), 12, false),
        to(0, 300),
      )
      return 2130
    },

    sad: () => {
      v.angry.value = hold(-1, 300, 1500, 450, 0)
      v.smile.value = hold(-0.7, 300, 1500, 450, BASE_SMILE)
      v.lookY.value = hold(0.7, 300, 1500, 450, 0)
      v.eyeL.value = hold(0.8, 300, 1500, 450, 1)
      v.eyeR.value = hold(0.8, 300, 1500, 450, 1)
      v.sprout.value = hold(18, 300, 1500, 450, 0)
      v.handR.value = hold(24, 300, 1500, 450, 0)
      v.handL.value = hold(-24, 300, 1500, 450, 0)
      v.rot.value = hold(-3, 300, 1500, 450, 0)
      return 2250
    },

    shy: () => {
      v.lookX.value = hold(-0.8, 250, 1300, 350, 0)
      v.lookY.value = hold(0.8, 250, 1300, 350, 0)
      v.blush.value = hold(1, 250, 1300, 350, BASE_BLUSH)
      v.smile.value = hold(0.6, 250, 1300, 350, BASE_SMILE)
      v.rot.value = hold(-6, 250, 1300, 350, 0)
      v.sprout.value = hold(10, 250, 1300, 350, 0)
      return 1900
    },

    surprised: () => {
      v.eyeL.value = hold(1.25, 110, 1000, 300, 1)
      v.eyeR.value = hold(1.25, 110, 1000, 300, 1)
      v.open.value = hold(0.9, 110, 1000, 300, 0)
      v.smile.value = hold(0, 110, 1000, 300, BASE_SMILE)
      v.lift.value = hold(1, 110, 1000, 300, 0)
      v.sproutK.value = hold(1.3, 110, 1000, 300, 1)
      v.sprout.value = seq(to(-8, 110), to(6, 120), to(0, 200))
      v.handR.value = hold(-18, 110, 1000, 300, 0)
      v.handL.value = hold(18, 110, 1000, 300, 0)
      v.jumpY.value = seq(to(-H * 0.35, 110, out), to(0, 160, inn))
      v.squash.value = seq(to(1.1, 110), to(1, 250))
      return 1420
    },

    wave: () => {
      v.handR.value = seq(
        to(-32, 220),
        withRepeat(seq(to(-6, 170), to(-34, 170)), 5, false),
        to(0, 260),
      )
      v.smile.value = hold(0.9, 220, 1700, 260, BASE_SMILE)
      v.lookX.value = hold(0.7, 220, 1700, 260, 0)
      v.rot.value = hold(-4, 220, 1700, 260, 0)
      return 2180
    },

    waveBoth: () => {
      v.handR.value = seq(
        to(-32, 220),
        withRepeat(seq(to(-6, 170), to(-34, 170)), 5, false),
        to(0, 260),
      )
      v.handL.value = seq(
        to(32, 220),
        withRepeat(seq(to(34, 170), to(6, 170)), 5, false),
        to(0, 260),
      )
      v.smile.value = hold(1, 220, 1700, 260, BASE_SMILE)
      v.squint.value = hold(0.4, 220, 1700, 260, 0)
      return 2180
    },

    sprout: () => {
      v.sprout.value = seq(
        to(-16, 90),
        to(14, 110),
        to(-10, 100),
        to(8, 100),
        to(-4, 90),
        to(0, 100),
      )
      v.sproutK.value = hold(1.15, 120, 100, 280, 1)
      return 600
    },

    perk: () => {
      v.sproutK.value = seq(to(1.35, 160, Easing.out(Easing.back(2))), to(1.35, 700), to(1, 300))
      v.sprout.value = seq(to(-6, 160), to(6, 200), to(-3, 200), to(0, 600))
      v.lift.value = hold(1, 160, 700, 300, 0)
      v.eyeL.value = hold(1.2, 160, 700, 300, 1)
      v.eyeR.value = hold(1.2, 160, 700, 300, 1)
      v.lookY.value = hold(-1, 200, 660, 300, 0)
      v.squash.value = seq(to(1.06, 160), to(1, 300))
      return 1160
    },

    nudge: () => {
      const N = size * 0.07
      v.shiftX.value = seq(to(-N, 110), to(N * 0.7, 120), to(-N * 0.35, 110), to(0, 120))
      v.rot.value = seq(to(-9, 110), to(6, 120), to(-3, 110), to(0, 120))
      v.sprout.value = seq(to(10, 110), to(-8, 120), to(4, 110), to(0, 120))
      v.lookX.value = hold(1, 110, 350, 250, 0)
      v.open.value = hold(0.35, 110, 250, 200, 0)
      v.lift.value = hold(0.6, 110, 250, 200, 0)
      return 700
    },

    jump: () => {
      v.jumpY.value = seq(to(0, 130), to(-H, 280, out), to(0, 260, inn))
      v.squash.value = seq(
        to(0.84, 130),
        to(1.1, 140),
        to(1, 140),
        to(1.05, 190),
        to(0.84, 70),
        withSpring(1, { damping: 6, stiffness: 260 }),
      )
      v.handR.value = seq(to(8, 130), to(-35, 200), to(-35, 150), to(0, 300))
      v.handL.value = seq(to(-8, 130), to(35, 200), to(35, 150), to(0, 300))
      v.sprout.value = seq(to(12, 130), to(-14, 280), to(8, 200), to(0, 250))
      v.smile.value = hold(1, 150, 560, 300, BASE_SMILE)
      v.open.value = hold(0.5, 150, 500, 250, 0)
      return 900
    },

    flip: () => {
      v.jumpY.value = seq(to(-H * 0.9, 330, out), to(0, 330, inn))
      v.flipX.value = seq(to(360, 660, cubic), to(0, 0))
      v.squash.value = seq(to(1, 660), to(0.88, 60), withSpring(1, { damping: 7, stiffness: 260 }))
      v.sprout.value = seq(to(-12, 200), to(12, 260), to(0, 300))
      v.smile.value = hold(1, 150, 520, 300, BASE_SMILE)
      return 1000
    },

    turn: () => {
      v.flipY.value = seq(to(360, 800, cubic), to(0, 0))
      v.smile.value = hold(1, 200, 400, 250, BASE_SMILE)
      return 850
    },

    spin: () => {
      v.rot.value = seq(to(360, 750, cubic), to(0, 0))
      v.handR.value = hold(-25, 200, 350, 200, 0)
      v.handL.value = hold(25, 200, 350, 200, 0)
      v.smile.value = hold(1, 200, 350, 200, BASE_SMILE)
      return 900
    },

    roll: () => {
      v.rot.value = seq(to(360, 520, cubic), to(0, 520, cubic))
      v.shiftX.value = seq(to(size * 0.22, 520, cubic), to(0, 520, cubic))
      v.open.value = hold(0.5, 200, 640, 200, 0)
      v.smile.value = hold(1, 200, 640, 200, BASE_SMILE)
      v.squint.value = hold(0.7, 200, 640, 200, 0)
      return 1040
    },

    tilt: () => {
      v.rot.value = seq(to(9, 280), to(9, 650), to(-4, 260), to(-4, 350), to(0, 260))
      v.lookY.value = hold(-0.3, 280, 1260, 260, 0)
      v.lift.value = hold(0.6, 280, 1260, 260, 0)
      return 1800
    },

    dance: () => {
      v.rot.value = seq(withRepeat(seq(to(-9, 220), to(9, 220)), 6, false), to(0, 200))
      v.jumpY.value = withRepeat(seq(to(-H * 0.28, 110, out), to(0, 110, inn)), 12, false)
      v.handR.value = seq(withRepeat(seq(to(-30, 220), to(0, 220)), 6, false), to(0, 200))
      v.handL.value = seq(withRepeat(seq(to(0, 220), to(30, 220)), 6, false), to(0, 200))
      v.sprout.value = seq(withRepeat(seq(to(12, 220), to(-12, 220)), 6, false), to(0, 200))
      v.smile.value = hold(1, 200, 2400, 240, BASE_SMILE)
      v.open.value = hold(0.5, 200, 2400, 240, 0)
      v.squint.value = hold(0.5, 200, 2400, 240, 0)
      v.blush.value = hold(1, 200, 2400, 240, BASE_BLUSH)
      return 2840
    },
  }
}

/* ── Worklet helpers ──────────────────────────────────────────────────────── */

// rotate/scale a full-size layer around a point given in viewBox units
function pivotTransform(px: number, py: number, k: number, deg: number, scale: number) {
  "worklet"
  const x = (px - 100) * k
  const y = (py - 100) * k
  return [
    { translateX: x },
    { translateY: y },
    { rotateZ: `${deg}deg` },
    { scale },
    { translateX: -x },
    { translateY: -y },
  ] as NonNullable<ViewStyle["transform"]>
}

function mouthPath(s: number, o: number) {
  "worklet"
  const w = 6 + 3 * Math.max(s, 0) + 1.6 * o
  const c = 9 * s
  const d = 9 * o
  return `M ${MOUTH_X - w} ${MOUTH_Y} Q ${MOUTH_X} ${MOUTH_Y + c} ${MOUTH_X + w} ${MOUTH_Y} Q ${MOUTH_X} ${
    MOUTH_Y + c + 2 * d
  } ${MOUTH_X - w} ${MOUTH_Y} Z`
}

function browPath(cx: number, side: number, a: number, lift: number) {
  "worklet"
  const by = BROW_Y - lift * 4
  const outerY = by - a * 2.2
  const innerY = by + a * 5.5
  const ctrlY = (outerY + innerY) / 2 - 2.4 * (1 - Math.abs(a))
  return `M ${cx + side * 6} ${outerY} Q ${cx} ${ctrlY} ${cx - side * 5} ${innerY}`
}

function lidPath(cx: number, squint: number) {
  "worklet"
  const y0 = EYE_Y + 2 * squint
  const c = EYE_Y + 4 - 10 * squint
  return `M ${cx - 5.6} ${y0} Q ${cx} ${c} ${cx + 5.6} ${y0}`
}

/* ── Static artwork ───────────────────────────────────────────────────────── */

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const Medallion = () => (
  <>
    <Circle cx={100} cy={104} r={89} fill="rgba(70, 50, 40, 0.07)" />
    <Circle
      cx={100}
      cy={100}
      r={90}
      fill="#FAFBF9"
      stroke="rgba(125, 140, 125, 0.25)"
      strokeWidth={3}
    />
  </>
)

const Hand = ({ side }: { side: "left" | "right" }) =>
  side === "left" ? (
    <>
      <Path d="M42 106 C41 92 32 84 18 86 C19 100 28 108 42 106 Z" fill="#8DAE88" />
      <Path
        d="M40 104 Q30 96 21 87"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
    </>
  ) : (
    <>
      <Path d="M158 106 C159 92 168 84 182 86 C181 100 172 108 158 106 Z" fill="#8DAE88" />
      <Path
        d="M160 104 Q170 96 179 87"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
    </>
  )

const Sprout = () => (
  <>
    <Path
      d="M60 64 Q58 48 64 36"
      stroke="#7D8C7D"
      strokeWidth={3.6}
      strokeLinecap="round"
      fill="none"
    />
    <Path d="M61 52 C53 51 47 45 45 37 C54 36 60 42 61 52 Z" fill="#8DAE88" />
    <Path
      d="M60 50 Q54 45 48 39"
      stroke="#FFFFFF"
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
      opacity={0.8}
    />
    <Path d="M64 38 C61 26 71 16 86 15 C88 28 78 38 64 38 Z" fill="#8DAE88" />
    <Path
      d="M65 37 Q74 28 84 18"
      stroke="#FFFFFF"
      strokeWidth={1.8}
      strokeLinecap="round"
      fill="none"
      opacity={0.8}
    />
  </>
)

const Flush = ({ angry }: { angry: SharedValue<number> }) => {
  const props = useAnimatedProps(() => ({ opacity: Math.max(0, angry.value) * 0.4 }))
  return <AnimatedPath d={STEM_L} fill="#D6402B" opacity={0} animatedProps={props} />
}

const Body = ({ uid, flush }: { uid: string; flush?: SharedValue<number> }) => (
  <>
    <Defs>
      <LinearGradient id={`${uid}t`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#E8896A" />
        <Stop offset="1" stopColor="#CB6845" />
      </LinearGradient>
      <LinearGradient id={`${uid}p`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#8B9A8B" />
        <Stop offset="1" stopColor="#6F806F" />
      </LinearGradient>
      <LinearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#9CBF96" />
        <Stop offset="1" stopColor="#7FA37A" />
      </LinearGradient>
    </Defs>
    <Path d={LEAF} fill={`url(#${uid}l)`} />
    <G stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.65}>
      <Path d="M72 80 L136 136" />
      <Path d="M88 94 L98 90" />
      <Path d="M103 107 L113 103" />
      <Path d="M118 121 L127 117" />
      <Path d="M86 96 L84 106" />
      <Path d="M101 109 L99 119" />
      <Path d="M116 123 L114 132" />
    </G>
    <Path d={STEM_L} fill={`url(#${uid}t)`} />
    {flush ? <Flush angry={flush} /> : null}
    <Path d={STEM_R} fill={`url(#${uid}p)`} />
    <Path
      d="M47 122 L47 142"
      stroke="rgba(255,255,255,0.3)"
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M153 68 L153 130 Q153 136 150 140"
      stroke="rgba(255,255,255,0.22)"
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
    />
  </>
)

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
  const sclera = useAnimatedProps(() => ({ ry: Math.max(0.01, 7 * open.value) }))
  const iris = useAnimatedProps(() => ({
    cx: cx + lookX.value * 2.2,
    cy: EYE_Y + lookY.value * 1.9,
    ry: Math.max(0.01, 4.4 * Math.min(open.value, 1.1)),
  }))
  const glint = useAnimatedProps(() => ({
    cx: cx + lookX.value * 2.2 + 1.5,
    cy: EYE_Y + lookY.value * 1.9 - 1.7,
    opacity: open.value > 0.5 ? 1 : 0,
  }))
  const lid = useAnimatedProps(() => ({
    d: lidPath(cx, squint.value),
    opacity: Math.min(1, Math.max(0, 1 - open.value / 0.35)),
  }))
  return (
    <>
      <AnimatedEllipse cx={cx} cy={EYE_Y} rx={6.4} ry={7} fill="#FFFFFF" animatedProps={sclera} />
      <AnimatedEllipse cx={cx} cy={EYE_Y} rx={4} ry={4.4} fill={INK} animatedProps={iris} />
      <AnimatedCircle cx={cx + 1.5} cy={EYE_Y - 1.7} r={1.5} fill="#FFFFFF" animatedProps={glint} />
      <AnimatedPath
        d={lidPath(cx, 0)}
        opacity={0}
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
        animatedProps={lid}
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
  const props = useAnimatedProps(() => ({ d: browPath(cx, side, angry.value, lift.value) }))
  return (
    <AnimatedPath
      d={browPath(cx, side, 0, 0)}
      stroke="#2B211D"
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
      animatedProps={props}
    />
  )
})

const Cheek = memo(function Cheek({ cx, blush }: { cx: number; blush: SV }) {
  const props = useAnimatedProps(() => ({ opacity: 0.25 + 0.6 * blush.value }))
  return (
    <AnimatedEllipse
      cx={cx}
      cy={CHEEK_Y}
      rx={4.2}
      ry={2.8}
      fill="#FFC2B0"
      opacity={0.4}
      animatedProps={props}
    />
  )
})

const Mouth = memo(function Mouth({ smile, open }: { smile: SV; open: SV }) {
  const props = useAnimatedProps(() => ({
    d: mouthPath(smile.value, open.value),
    fillOpacity: Math.min(1, open.value * 6),
  }))
  return (
    <AnimatedPath
      d={mouthPath(BASE_SMILE, 0)}
      stroke="#3A2A24"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#5A1E19"
      fillOpacity={0}
      animatedProps={props}
    />
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
    <G>
      <Cheek cx={46.5} blush={blush} />
      <Cheek cx={73.5} blush={blush} />
      <Eye cx={EYE_LX} open={openL} lookX={lookX} lookY={lookY} squint={squint} />
      <Eye cx={EYE_RX} open={openR} lookX={lookX} lookY={lookY} squint={squint} />
      <Brow cx={EYE_LX} side={-1} angry={angry} lift={lift} />
      <Brow cx={EYE_RX} side={1} angry={angry} lift={lift} />
      <Mouth smile={smile} open={open} />
    </G>
  )
})

/* ── Component ────────────────────────────────────────────────────────────── */

export const AnimatedNeevLogoIcon = memo(
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
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
    const reduceMotion = useReducedMotion()
    const animations = useMemo(() => makeAnimations(v, size), [v, size])

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
          withTiming(1.025, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
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

    const k = size / 200
    const {
      squash,
      shiftX,
      jumpY,
      flipX,
      flipY,
      rot,
      breathe,
      sway,
      sprout,
      sproutK,
      handL,
      handR,
    } = v

    const rootStyle = useAnimatedStyle(() => {
      const sq = squash.value
      return {
        transform: [
          { perspective: 800 },
          { translateX: shiftX.value },
          { translateY: jumpY.value + (1 - sq) * size * 0.5 }, // keep feet planted while squashing
          { rotateX: `${flipX.value}deg` },
          { rotateY: `${flipY.value}deg` },
          { rotateZ: `${rot.value}deg` },
          { scaleX: breathe.value * (1 + (1 - sq) * 0.6) },
          { scaleY: breathe.value * sq },
        ],
      }
    })
    const handLStyle = useAnimatedStyle(() => ({
      transform: pivotTransform(42, 106, k, handL.value + sway.value * 3, 1),
    }))
    const handRStyle = useAnimatedStyle(() => ({
      transform: pivotTransform(158, 106, k, handR.value + sway.value * 3, 1),
    }))
    const sproutStyle = useAnimatedStyle(() => ({
      transform: pivotTransform(60, 62, k, sprout.value + sway.value * 4, sproutK.value),
    }))

    const svg = { width: size, height: size, viewBox: "0 0 200 200" }
    const box = { width: size, height: size }

    const content = playful ? (
      <Animated.View style={[box, rootStyle, style]}>
        {withBackground ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg {...svg}>
              <Medallion />
            </Svg>
          </View>
        ) : null}
        <Animated.View style={[StyleSheet.absoluteFill, handLStyle]} pointerEvents="none">
          <Svg {...svg}>
            <Hand side="left" />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, handRStyle]} pointerEvents="none">
          <Svg {...svg}>
            <Hand side="right" />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, sproutStyle]} pointerEvents="none">
          <Svg {...svg}>
            <Sprout />
          </Svg>
        </Animated.View>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg {...svg}>
            <Body uid={uid} flush={v.angry} />
          </Svg>
        </View>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg {...svg}>
            <Face v={v} />
          </Svg>
        </View>
      </Animated.View>
    ) : (
      <View style={[box, style]}>
        <Svg {...svg}>
          {withBackground ? <Medallion /> : null}
          <Hand side="left" />
          <Hand side="right" />
          <Sprout />
          <Body uid={uid} />
        </Svg>
      </View>
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

export default AnimatedNeevLogoIcon
