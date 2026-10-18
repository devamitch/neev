/**
 * The living BlinkQuest mark for the Scan orb.
 *
 * Same "bq" geometry as the static logo. In the orb the rings become white
 * goggles with soft peach "eye whites" so the charcoal pupils read clearly at
 * dock size. One linear 12 s timeline drives every expression, so nothing
 * drifts out of sync:
 *   sleeps in the logo pose (breathing) → wakes with a hop → looks left →
 *   right → up → down → winks with a grin → laughs (^ ^ eyes, big grin,
 *   head shake) → blinks → sneaks a peek up-left → dozes off again.
 * Everything runs on the UI thread through Reanimated animated props; with
 * Reduce Motion on, the mark rests in its calm logo pose.
 */
import { useEffect } from "react"
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg"

import {
  BQ_ASPECT,
  BQ_EYE_Y,
  BQ_FEATURE_STROKE,
  BQ_HOLE_R,
  BQ_RING,
  BQ_STEM_B,
  BQ_STEM_Q,
  BQ_VIEWBOX,
  bqHappyEye,
  bqSleepingEye,
  bqSmile,
} from "./bqGeometry"

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface AnimatedBlinkQuestLogoIconProps {
  /** Width in dp; height follows the logo aspect. Defaults to 40. */
  size?: number
  /** Ring and stem color when not inverted (defaults to terracotta). */
  color?: string
  /** Eyes and smile (defaults to charcoal). */
  charcoalColor?: string
  /** White goggles for the terracotta orb (default true). */
  inverted?: boolean
  /** Set false to hold the calm logo pose. */
  animated?: boolean
}

const LOOP_MS = 12000
const PUPIL_R = 6
const GLINT_R = 1.7
const LOOK_X = 6
const LOOK_Y = 5
const STROKE = BQ_FEATURE_STROKE + 0.8

// Timeline keyframes (fraction of the loop).
const OPEN_K = [0, 0.12, 0.16, 0.88, 0.92, 1]
const OPEN_V = [0, 0, 1, 1, 0, 0]
const LOOKX_K = [0.17, 0.2, 0.26, 0.29, 0.34, 0.36, 0.81, 0.83, 0.86, 0.88]
const LOOKX_V = [0, -1, -1, 1, 1, 0, 0, -0.75, -0.75, 0]
const LOOKY_K = [0.36, 0.39, 0.43, 0.46, 0.5, 0.52, 0.81, 0.83, 0.86, 0.88]
const LOOKY_V = [0, -1, -1, 1, 1, 0, 0, -0.75, -0.75, 0]
const WINK_K = [0.53, 0.55, 0.59, 0.61]
const WINK_V = [0, 1, 1, 0]
const LAUGH_K = [0.62, 0.64, 0.74, 0.76]
const LAUGH_V = [0, 1, 1, 0]
const BLINK_K = [0.78, 0.792, 0.806]
const BLINK_V = [0, 1, 0]
const GRIN_K = [0.16, 0.2, 0.53, 0.55, 0.61, 0.64, 0.74, 0.77, 0.88, 0.92]
const GRIN_V = [8, 9, 9, 12, 11, 14, 14, 9, 9, 8]
const SHAKE_K = [0.64, 0.66, 0.68, 0.7, 0.72, 0.74, 0.76]
const SHAKE_V = [0, -14, 14, -12, 10, -6, 0]

const clamp = Extrapolation.CLAMP

export function AnimatedBlinkQuestLogoIcon({
  size = 40,
  color = "#DA7756",
  charcoalColor = "#262624",
  inverted = true,
  animated = true,
}: AnimatedBlinkQuestLogoIconProps) {
  const reduceMotion = useReducedMotion()
  const t = useSharedValue(0)
  const live = animated && !reduceMotion

  useEffect(() => {
    if (!live) {
      cancelAnimation(t)
      t.value = 0
      return
    }
    t.value = 0
    t.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [live, t])

  const frame = inverted ? "#FFFFFF" : color
  const socket = inverted ? "#FDE7DD" : "transparent"
  const feature = charcoalColor
  const smileColor = inverted ? "#FFFFFF" : charcoalColor

  /** Per-eye state: pupil, sleeping-lid and happy-lid visibility (0..1). */
  const eye = (side: "b" | "q") => {
    "worklet"
    const v = t.value
    const open = interpolate(v, OPEN_K, OPEN_V, clamp)
    const blink = interpolate(v, BLINK_K, BLINK_V, clamp)
    const wink = side === "q" ? interpolate(v, WINK_K, WINK_V, clamp) : 0
    const happy = Math.max(interpolate(v, LAUGH_K, LAUGH_V, clamp), wink) * open
    const pupil = open * (1 - blink) * (1 - happy)
    const sleep = Math.min(1, 1 - open + open * blink) * (1 - happy)
    return { pupil, sleep, happy }
  }
  const look = () => {
    "worklet"
    return {
      x: interpolate(t.value, LOOKX_K, LOOKX_V, clamp),
      y: interpolate(t.value, LOOKY_K, LOOKY_V, clamp),
    }
  }

  const pupilProps = (side: "b" | "q", ringX: number) => {
    "worklet"
    const a = eye(side).pupil
    const l = look()
    return {
      cx: ringX + l.x * LOOK_X,
      cy: BQ_EYE_Y + 1 + l.y * LOOK_Y,
      ry: PUPIL_R * Math.max(a, 0.05),
      opacity: a > 0.05 ? 1 : 0,
    }
  }
  const glintProps = (side: "b" | "q", ringX: number) => {
    "worklet"
    const a = eye(side).pupil
    const l = look()
    return {
      cx: ringX + l.x * LOOK_X + 2,
      cy: BQ_EYE_Y - 1 + l.y * LOOK_Y,
      opacity: a > 0.6 ? 1 : 0,
    }
  }

  const bPupil = useAnimatedProps(() => pupilProps("b", BQ_RING.bx))
  const qPupil = useAnimatedProps(() => pupilProps("q", BQ_RING.qx))
  const bGlint = useAnimatedProps(() => glintProps("b", BQ_RING.bx))
  const qGlint = useAnimatedProps(() => glintProps("q", BQ_RING.qx))
  const bSleep = useAnimatedProps(() => ({ opacity: eye("b").sleep }))
  const qSleep = useAnimatedProps(() => ({ opacity: eye("q").sleep }))
  const bHappy = useAnimatedProps(() => ({ opacity: eye("b").happy }))
  const qHappy = useAnimatedProps(() => ({ opacity: eye("q").happy }))
  const smile = useAnimatedProps(() => ({
    d: bqSmile(interpolate(t.value, GRIN_K, GRIN_V, clamp)),
  }))

  // Breathing while asleep; awake, the head tilts toward each glance, nods
  // with up/down looks, hops on waking and shakes while laughing.
  const body = useAnimatedStyle(() => {
    const v = t.value
    const open = interpolate(v, OPEN_K, OPEN_V, clamp)
    const breathe = Math.sin(v * Math.PI * 2 * 4) * 1 * (1 - open)
    const hop = interpolate(v, [0.12, 0.145, 0.17], [0, -3, 0], clamp)
    const giggle = interpolate(v, LAUGH_K, LAUGH_V, clamp) * Math.sin(v * Math.PI * 2 * 40) * 0.8
    const l = look()
    const tilt = l.x * 6 + interpolate(v, SHAKE_K, SHAKE_V, clamp)
    return {
      transform: [{ translateY: breathe + hop + l.y * 1.2 + giggle }, { rotate: `${tilt}deg` }],
    }
  })

  const eyeArc = (d: string, props: ReturnType<typeof useAnimatedProps>) => (
    <AnimatedPath
      d={d}
      animatedProps={props}
      stroke={feature}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
    />
  )

  return (
    <Animated.View style={[{ width: size, height: size * BQ_ASPECT }, body]}>
      <Svg
        width={size}
        height={size * BQ_ASPECT}
        viewBox={`0 0 ${BQ_VIEWBOX.width} ${BQ_VIEWBOX.height}`}
        fill="none"
        accessible={false}
      >
        <Rect {...BQ_STEM_B} fill={frame} />
        <Rect {...BQ_STEM_Q} fill={frame} />
        <Circle cx={BQ_RING.bx} cy={BQ_RING.cy} r={BQ_HOLE_R} fill={socket} />
        <Circle cx={BQ_RING.qx} cy={BQ_RING.cy} r={BQ_HOLE_R} fill={socket} />
        <Circle
          cx={BQ_RING.bx}
          cy={BQ_RING.cy}
          r={BQ_RING.r}
          stroke={frame}
          strokeWidth={BQ_RING.stroke}
        />
        <Circle
          cx={BQ_RING.qx}
          cy={BQ_RING.cy}
          r={BQ_RING.r}
          stroke={frame}
          strokeWidth={BQ_RING.stroke}
        />

        {eyeArc(bqSleepingEye(BQ_RING.bx), bSleep)}
        {eyeArc(bqSleepingEye(BQ_RING.qx), qSleep)}
        {eyeArc(bqHappyEye(BQ_RING.bx), bHappy)}
        {eyeArc(bqHappyEye(BQ_RING.qx), qHappy)}

        <AnimatedEllipse animatedProps={bPupil} rx={PUPIL_R} fill={feature} />
        <AnimatedEllipse animatedProps={qPupil} rx={PUPIL_R} fill={feature} />
        <AnimatedCircle animatedProps={bGlint} r={GLINT_R} fill="#FFFFFF" />
        <AnimatedCircle animatedProps={qGlint} r={GLINT_R} fill="#FFFFFF" />

        <AnimatedPath
          d={bqSmile()}
          animatedProps={smile}
          stroke={smileColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  )
}
