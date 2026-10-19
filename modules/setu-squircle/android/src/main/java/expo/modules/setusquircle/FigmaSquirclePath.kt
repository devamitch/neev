package expo.modules.setusquircle

import android.graphics.Path
import android.graphics.RectF
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/**
 * Direct Android Path implementation of the Figma-style corner smoothing
 * construction used by figma-squircle.
 *
 * Important:
 * - No SVG.
 * - No PathParser.
 * - No strings.
 * - No external geometry dependency.
 * - Allocations happen only when geometry is rebuilt.
 *
 * Corner order:
 *   0 = top-left
 *   1 = top-right
 *   2 = bottom-right
 *   3 = bottom-left
 */
internal object FigmaSquirclePath {

    private const val QUARTER_TURN_DEGREES = 90f
    private const val SQRT_TWO = 1.4142135623730951f

    private data class CornerSpec(
        val radius: Float,
        val budget: Float,
    )

    private data class CornerPathParams(
        val radius: Float,
        val a: Float,
        val b: Float,
        val c: Float,
        val d: Float,
        val p: Float,
        val arcSectionLength: Float,
        val arcMeasure: Float,
    )

    /**
     * Builds the complete closed path.
     */
    fun build(
        path: Path,
        width: Float,
        height: Float,
        topLeftRadius: Float,
        topRightRadius: Float,
        bottomRightRadius: Float,
        bottomLeftRadius: Float,
        cornerSmoothingPercent: Float,
        preserveSmoothing: Boolean,
    ) {
        path.reset()

        if (
            !width.isFinite() ||
            !height.isFinite() ||
            width <= 0f ||
            height <= 0f
        ) {
            return
        }

        val radii = normalizeRadii(
            width = width,
            height = height,
            topLeft = topLeftRadius,
            topRight = topRightRadius,
            bottomRight = bottomRightRadius,
            bottomLeft = bottomLeftRadius,
        )

        val safeSmoothingPercent =
            if (cornerSmoothingPercent.isFinite()) {
                cornerSmoothingPercent
            } else {
                72f
            }

        val smoothing =
            (
                safeSmoothingPercent
                    .coerceIn(0f, 100f)
            ) / 100f

        val topLeftBudget =
            min(
                width - radii[1],
                height - radii[3],
            )

        val topRightBudget =
            min(
                width - radii[0],
                height - radii[2],
            )

        val bottomRightBudget =
            min(
                width - radii[3],
                height - radii[1],
            )

        val bottomLeftBudget =
            min(
                width - radii[2],
                height - radii[0],
            )

        val topLeft =
            makeCorner(
                radius = radii[0],
                budget = topLeftBudget.coerceAtLeast(0f),
                smoothing = smoothing,
                preserveSmoothing = preserveSmoothing,
            )

        val topRight =
            makeCorner(
                radius = radii[1],
                budget = topRightBudget.coerceAtLeast(0f),
                smoothing = smoothing,
                preserveSmoothing = preserveSmoothing,
            )

        val bottomRight =
            makeCorner(
                radius = radii[2],
                budget = bottomRightBudget.coerceAtLeast(0f),
                smoothing = smoothing,
                preserveSmoothing = preserveSmoothing,
            )

        val bottomLeft =
            makeCorner(
                radius = radii[3],
                budget = bottomLeftBudget.coerceAtLeast(0f),
                smoothing = smoothing,
                preserveSmoothing = preserveSmoothing,
            )

        val reusableRect =
            RectF()

        path.moveTo(
            width - topRight.p,
            0f,
        )

        appendTopRight(
            path = path,
            width = width,
            corner = topRight,
            reusableRect = reusableRect,
        )

        path.lineTo(
            width,
            height - bottomRight.p,
        )

        appendBottomRight(
            path = path,
            width = width,
            height = height,
            corner = bottomRight,
            reusableRect = reusableRect,
        )

        path.lineTo(
            bottomLeft.p,
            height,
        )

        appendBottomLeft(
            path = path,
            height = height,
            corner = bottomLeft,
            reusableRect = reusableRect,
        )

        path.lineTo(
            0f,
            topLeft.p,
        )

        appendTopLeft(
            path = path,
            corner = topLeft,
            reusableRect = reusableRect,
        )

        path.close()
    }

    /**
     * Proportionally scales radii when their combined values cannot fit
     * along the available width/height.
     *
     * This is deterministic and prevents self-intersecting geometry.
     */
    private fun normalizeRadii(
        width: Float,
        height: Float,
        topLeft: Float,
        topRight: Float,
        bottomRight: Float,
        bottomLeft: Float,
    ): FloatArray {

        var tl =
            max(
                0f,
                if (topLeft.isFinite()) topLeft else 0f,
            )

        var tr =
            max(
                0f,
                if (topRight.isFinite()) topRight else 0f,
            )

        var br =
            max(
                0f,
                if (bottomRight.isFinite()) bottomRight else 0f,
            )

        var bl =
            max(
                0f,
                if (bottomLeft.isFinite()) bottomLeft else 0f,
            )

        val horizontalTop =
            tl + tr

        val horizontalBottom =
            bl + br

        val verticalLeft =
            tl + bl

        val verticalRight =
            tr + br

        var scale = 1f

        if (horizontalTop > width) {
            scale =
                min(
                    scale,
                    width / horizontalTop,
                )
        }

        if (horizontalBottom > width) {
            scale =
                min(
                    scale,
                    width / horizontalBottom,
                )
        }

        if (verticalLeft > height) {
            scale =
                min(
                    scale,
                    height / verticalLeft,
                )
        }

        if (verticalRight > height) {
            scale =
                min(
                    scale,
                    height / verticalRight,
                )
        }

        if (scale < 1f) {
            tl *= scale
            tr *= scale
            br *= scale
            bl *= scale
        }

        val maximum =
            min(
                width,
                height,
            ) * 0.5f

        tl =
            min(
                tl,
                maximum,
            )

        tr =
            min(
                tr,
                maximum,
            )

        br =
            min(
                br,
                maximum,
            )

        bl =
            min(
                bl,
                maximum,
            )

        return floatArrayOf(
            tl,
            tr,
            br,
            bl,
        )
    }

    /**
     * Figma-style corner parameter construction.
     */
    private fun makeCorner(
        radius: Float,
        budget: Float,
        smoothing: Float,
        preserveSmoothing: Boolean,
    ): CornerPathParams {

        if (
            radius <= 0f ||
            budget <= 0f
        ) {
            return CornerPathParams(
                radius = 0f,
                a = 0f,
                b = 0f,
                c = 0f,
                d = 0f,
                p = 0f,
                arcSectionLength = 0f,
                arcMeasure = QUARTER_TURN_DEGREES,
            )
        }

        var safeSmoothing =
            smoothing.coerceIn(
                0f,
                1f,
            )

        var p =
            (
                1f +
                    safeSmoothing
            ) * radius

        if (!preserveSmoothing) {
            val maximumSmoothing =
                (
                    budget /
                        radius
                ) - 1f

            safeSmoothing =
                min(
                    safeSmoothing,
                    maximumSmoothing.coerceAtLeast(0f),
                )

            p =
                min(
                    p,
                    budget,
                )
        }

        val arcMeasure =
            QUARTER_TURN_DEGREES *
                (
                    1f -
                        safeSmoothing
                )

        val arcSectionLength =
            sin(
                radians(
                    arcMeasure / 2f,
                ),
            ) *
                radius *
                SQRT_TWO

        val angleAlpha =
            (
                QUARTER_TURN_DEGREES -
                    arcMeasure
            ) / 2f

        val p3ToP4Distance =
            radius *
                tan(
                    radians(
                        angleAlpha / 2f,
                    ),
                )

        val angleBeta =
            45f *
                safeSmoothing

        val c =
            p3ToP4Distance *
                cos(
                    radians(
                        angleBeta,
                    ),
                )

        val d =
            c *
                tan(
                    radians(
                        angleBeta,
                    ),
                )

        var b =
            (
                p -
                    arcSectionLength -
                    c -
                    d
            ) / 3f

        var a =
            2f *
                b

        if (
            preserveSmoothing &&
            p > budget
        ) {
            val p1ToP3MaxDistance =
                budget -
                    d -
                    arcSectionLength -
                    c

            val minA =
                p1ToP3MaxDistance /
                    6f

            val maxB =
                p1ToP3MaxDistance -
                    minA

            b =
                min(
                    b,
                    maxB,
                )

            a =
                p1ToP3MaxDistance -
                    b

            p =
                min(
                    p,
                    budget,
                )
        }

        return CornerPathParams(
            radius = radius,
            a = a.coerceAtLeast(0f),
            b = b.coerceAtLeast(0f),
            c = c.coerceAtLeast(0f),
            d = d.coerceAtLeast(0f),
            p = p.coerceAtLeast(0f),
            arcSectionLength = arcSectionLength.coerceAtLeast(0f),
            arcMeasure = arcMeasure.coerceIn(
                0f,
                QUARTER_TURN_DEGREES,
            ),
        )
    }

    private fun appendTopRight(
        path: Path,
        width: Float,
        corner: CornerPathParams,
        reusableRect: RectF,
    ) {
        if (corner.radius <= 0f) {
            path.lineTo(
                width,
                0f,
            )
            return
        }

        val startX =
            width -
                corner.p

        val controlEndX =
            startX +
                corner.a +
                corner.b +
                corner.c

        val controlEndY =
            corner.d

        path.cubicTo(
            startX +
                corner.a,
            0f,

            startX +
                corner.a +
                corner.b,
            0f,

            controlEndX,
            controlEndY,
        )

        val centerX =
            width -
                corner.radius

        val centerY =
            corner.radius

        reusableRect.set(
            centerX -
                corner.radius,
            centerY -
                corner.radius,
            centerX +
                corner.radius,
            centerY +
                corner.radius,
        )

        val startAngle =
            angleDegrees(
                controlEndX -
                    centerX,
                controlEndY -
                    centerY,
            )

        path.arcTo(
            reusableRect,
            startAngle,
            corner.arcMeasure,
            false,
        )

        val endAngle =
            radians(
                startAngle +
                    corner.arcMeasure,
            )

        val endX =
            centerX +
                corner.radius *
                cos(endAngle)

        val endY =
            centerY +
                corner.radius *
                sin(endAngle)

        path.cubicTo(
            endX +
                corner.d,
            endY +
                corner.c,

            endX +
                corner.d,
            endY +
                corner.b +
                corner.c,

            endX +
                corner.d,
            endY +
                corner.a +
                corner.b +
                corner.c,
        )
    }

    private fun appendBottomRight(
        path: Path,
        width: Float,
        height: Float,
        corner: CornerPathParams,
        reusableRect: RectF,
    ) {
        if (corner.radius <= 0f) {
            path.lineTo(
                width,
                height,
            )
            return
        }

        val startY =
            height -
                corner.p

        val controlEndX =
            width -
                corner.d

        val controlEndY =
            startY +
                corner.a +
                corner.b +
                corner.c

        path.cubicTo(
            width,
            startY +
                corner.a,

            width,
            startY +
                corner.a +
                corner.b,

            controlEndX,
            controlEndY,
        )

        val centerX =
            width -
                corner.radius

        val centerY =
            height -
                corner.radius

        reusableRect.set(
            centerX -
                corner.radius,
            centerY -
                corner.radius,
            centerX +
                corner.radius,
            centerY +
                corner.radius,
        )

        val startAngle =
            angleDegrees(
                controlEndX -
                    centerX,
                controlEndY -
                    centerY,
            )

        path.arcTo(
            reusableRect,
            startAngle,
            corner.arcMeasure,
            false,
        )

        val endAngle =
            radians(
                startAngle +
                    corner.arcMeasure,
            )

        val endX =
            centerX +
                corner.radius *
                cos(endAngle)

        val endY =
            centerY +
                corner.radius *
                sin(endAngle)

        path.cubicTo(
            endX -
                corner.c,
            endY +
                corner.d,

            endX -
                corner.b -
                corner.c,
            endY +
                corner.d,

            endX -
                corner.a -
                corner.b -
                corner.c,
            endY +
                corner.d,
        )
    }

    private fun appendBottomLeft(
        path: Path,
        height: Float,
        corner: CornerPathParams,
        reusableRect: RectF,
    ) {
        if (corner.radius <= 0f) {
            path.lineTo(
                0f,
                height,
            )
            return
        }

        val startX =
            corner.p

        val controlEndX =
            startX -
                corner.a -
                corner.b -
                corner.c

        val controlEndY =
            height -
                corner.d

        path.cubicTo(
            startX -
                corner.a,
            height,

            startX -
                corner.a -
                corner.b,
            height,

            controlEndX,
            controlEndY,
        )

        val centerX =
            corner.radius

        val centerY =
            height -
                corner.radius

        reusableRect.set(
            centerX -
                corner.radius,
            centerY -
                corner.radius,
            centerX +
                corner.radius,
            centerY +
                corner.radius,
        )

        val startAngle =
            angleDegrees(
                controlEndX -
                    centerX,
                controlEndY -
                    centerY,
            )

        path.arcTo(
            reusableRect,
            startAngle,
            corner.arcMeasure,
            false,
        )

        val endAngle =
            radians(
                startAngle +
                    corner.arcMeasure,
            )

        val endX =
            centerX +
                corner.radius *
                cos(endAngle)

        val endY =
            centerY +
                corner.radius *
                sin(endAngle)

        path.cubicTo(
            endX -
                corner.d,
            endY -
                corner.c,

            endX -
                corner.d,
            endY -
                corner.b -
                corner.c,

            endX -
                corner.d,
            endY -
                corner.a -
                corner.b -
                corner.c,
        )
    }

    private fun appendTopLeft(
        path: Path,
        corner: CornerPathParams,
        reusableRect: RectF,
    ) {
        if (corner.radius <= 0f) {
            path.lineTo(
                0f,
                0f,
            )
            return
        }

        val startY =
            corner.p

        val controlEndX =
            corner.d

        val controlEndY =
            startY -
                corner.a -
                corner.b -
                corner.c

        path.cubicTo(
            0f,
            startY -
                corner.a,

            0f,
            startY -
                corner.a -
                corner.b,

            controlEndX,
            controlEndY,
        )

        val centerX =
            corner.radius

        val centerY =
            corner.radius

        reusableRect.set(
            centerX -
                corner.radius,
            centerY -
                corner.radius,
            centerX +
                corner.radius,
            centerY +
                corner.radius,
        )

        val startAngle =
            angleDegrees(
                controlEndX -
                    centerX,
                controlEndY -
                    centerY,
            )

        path.arcTo(
            reusableRect,
            startAngle,
            corner.arcMeasure,
            false,
        )

        val endAngle =
            radians(
                startAngle +
                    corner.arcMeasure,
            )

        val endX =
            centerX +
                corner.radius *
                cos(endAngle)

        val endY =
            centerY +
                corner.radius *
                sin(endAngle)

        path.cubicTo(
            endX +
                corner.c,
            endY -
                corner.d,

            endX +
                corner.b +
                corner.c,
            endY -
                corner.d,

            endX +
                corner.a +
                corner.b +
                corner.c,
            endY -
                corner.d,
        )
    }

    private fun angleDegrees(
        x: Float,
        y: Float,
    ): Float {
        return (
            atan2(
                y,
                x,
            ) * 180f /
                Math.PI.toFloat()
        )
    }

    private fun radians(
        degrees: Float,
    ): Float {
        return (
            degrees *
                Math.PI.toFloat()
        ) / 180f
    }
}
