import { memo } from "react"
import Svg, { Circle, G, Path, Rect, SvgProps } from "react-native-svg"

import {
  BQ_ASPECT,
  BQ_FEATURE_STROKE,
  BQ_RING,
  BQ_STEM_B,
  BQ_STEM_Q,
  BQ_VIEWBOX,
  bqSleepingEye,
  bqSmile,
} from "./bqGeometry"

export interface BlinkQuestLogoIconProps extends SvgProps {
  /** Width of the mark in dp (height follows the logo's aspect). Defaults to 26. */
  size?: number
  /** Ring and stem color (defaults to terracotta #DA7756). */
  color?: string
  /** Eyes and smile (defaults to charcoal #262624). */
  charcoalColor?: string
  /** All-white mark for terracotta or dark surfaces. */
  inverted?: boolean
}

/** Static BlinkQuest "bq" brand mark, drawn from the shared logo geometry. */
export const BlinkQuestLogoIcon = memo(function BlinkQuestLogoIcon({
  size = 26,
  color = "#DA7756",
  charcoalColor = "#262624",
  inverted = false,
  style,
  ...rest
}: BlinkQuestLogoIconProps) {
  const frame = inverted ? "#FFFFFF" : color
  const feature = inverted ? "#FFFFFF" : charcoalColor

  return (
    <Svg
      width={size}
      height={size * BQ_ASPECT}
      viewBox={`0 0 ${BQ_VIEWBOX.width} ${BQ_VIEWBOX.height}`}
      fill="none"
      style={style}
      accessible={false}
      {...rest}
    >
      <Rect {...BQ_STEM_B} fill={frame} />
      <Rect {...BQ_STEM_Q} fill={frame} />
      <Circle cx={BQ_RING.bx} cy={BQ_RING.cy} r={BQ_RING.r} stroke={frame} strokeWidth={BQ_RING.stroke} />
      <Circle cx={BQ_RING.qx} cy={BQ_RING.cy} r={BQ_RING.r} stroke={frame} strokeWidth={BQ_RING.stroke} />
      <G stroke={feature} strokeWidth={BQ_FEATURE_STROKE} strokeLinecap="round" fill="none">
        <Path d={bqSleepingEye(BQ_RING.bx)} />
        <Path d={bqSleepingEye(BQ_RING.qx)} />
        <Path d={bqSmile()} />
      </G>
    </Svg>
  )
})

export default BlinkQuestLogoIcon
