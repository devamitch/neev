package expo.modules.setusquircle

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.SweepGradient
import android.os.Build
import android.view.MotionEvent
import android.view.View
import android.view.ViewOutlineProvider
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Setu Squircle host.
 *
 * Responsibilities:
 *
 * 1. Build the exact smooth/squircle path.
 * 2. Keep children sharp and un-rasterised.
 * 3. Provide hardware clipping.
 * 4. Draw the native dynamic optical edge.
 * 5. Draw the native touch-following light under the Skia material.
 *
 * Skia owns the advanced liquid-glass body.
 *
 * Deliberately excluded:
 *
 * - Compose
 * - PathParser
 * - SVG
 * - bitmap snapshots
 * - software rendering
 * - per-frame object construction
 *
 * Important:
 *
 * All dimension values arriving from React Native are density-independent
 * pixels. We convert using Configuration densityDpi rather than referencing
 * android.util.DisplayMetrics.
 */
class ExpoSquircleView(
    context: Context,
    appContext: AppContext,
) : ExpoView(
    context,
    appContext,
) {

    // =========================================================================
    // SHAPE
    // =========================================================================

    private enum class Shape {
        SQUIRCLE,
        ROUNDED,
        PILL,
        CIRCLE,
    }

    private var shape =
        Shape.SQUIRCLE

    private var borderRadiusDip =
        Float.NaN

    private var topLeftRadiusDip =
        Float.NaN

    private var topRightRadiusDip =
        Float.NaN

    private var bottomRightRadiusDip =
        Float.NaN

    private var bottomLeftRadiusDip =
        Float.NaN

    private var borderWidthDip =
        0f

    private var cornerSmoothing =
        100f

    private var preserveSmoothing =
        true

    // =========================================================================
    // COLOURS
    // =========================================================================

    private var fillColor =
        Color.TRANSPARENT

    private var borderColor =
        Color.TRANSPARENT

    private var highlightColor =
        Color.WHITE

    /*
     * FIX: this used to default to Color.TRANSPARENT (black with alpha 0).
     * withAlpha(accentColor, x) then painted BLACK at x alpha into the rim
     * gradients, which is the dirty gray smudge on the glass edge. It now
     * defaults to white and is set from JS (squircleAccentColor).
     */
    private var accentColor =
        Color.WHITE

    // =========================================================================
    // MATERIAL CONFIGURATION
    // =========================================================================

    private var glassEnabled =
        true

    private var glassOpacity =
        0.58f

    private var glassEdgeIntensity =
        0.80f

    private var glassHighlightIntensity =
        0.72f

    private var glassInteractive =
        false

    private var clipContent =
        true

    // =========================================================================
    // GEOMETRY STATE
    // =========================================================================

    private val shapePath =
        Path()

    private val reusableRect =
        RectF()

    private var geometryReady =
        false

    // =========================================================================
    // NATIVE TOUCH LIGHT
    // =========================================================================

    /**
     * Normalised idle/environment light.
     */
    private var idleLightX =
        0.16f

    private var idleLightY =
        0.10f

    /**
     * Pixel-space dynamic light.
     */
    private var lightX =
        0f

    private var lightY =
        0f

    private var targetLightX =
        0f

    private var targetLightY =
        0f

    private var highlightAmount =
        0.64f

    private var targetHighlightAmount =
        0.64f

    private var pressed =
        false

    private var attached =
        false

    private var lightFramePosted =
        false

    private var lastLightFrameNanos =
        0L

    /**
     * One reusable frame callback.
     *
     * No allocation occurs per frame.
     */
    private val lightFrameRunnable =
        Runnable {
            lightFramePosted = false

            updateLightFrame()
        }

    // =========================================================================
    // PAINTS
    // =========================================================================

    private val fallbackFillPaint =
        Paint(
            Paint.ANTI_ALIAS_FLAG or
                Paint.DITHER_FLAG,
        ).apply {
            style =
                Paint.Style.FILL
        }

    /**
     * Dynamic light under the Skia material.
     */
    private val touchLightPaint =
        Paint(
            Paint.ANTI_ALIAS_FLAG or
                Paint.DITHER_FLAG,
        ).apply {
            style =
                Paint.Style.FILL
        }

    /**
     * Structural border.
     */
    private val structuralBorderPaint =
        Paint(
            Paint.ANTI_ALIAS_FLAG or
                Paint.DITHER_FLAG,
        ).apply {
            style =
                Paint.Style.STROKE

            strokeJoin =
                Paint.Join.ROUND

            strokeCap =
                Paint.Cap.ROUND
        }

    /**
     * Very soft outside optical halo.
     */
    private val outerRimPaint =
        Paint(
            Paint.ANTI_ALIAS_FLAG or
                Paint.DITHER_FLAG,
        ).apply {
            style =
                Paint.Style.STROKE

            strokeJoin =
                Paint.Join.ROUND

            strokeCap =
                Paint.Cap.ROUND
        }

    /**
     * Crisp molded highlight.
     */
    private val moldedRimPaint =
        Paint(
            Paint.ANTI_ALIAS_FLAG or
                Paint.DITHER_FLAG,
        ).apply {
            style =
                Paint.Style.STROKE

            strokeJoin =
                Paint.Join.ROUND

            strokeCap =
                Paint.Cap.ROUND
        }

    /**
     * Quiet internal rim.
     */
    private val innerRimPaint =
        Paint(
            Paint.ANTI_ALIAS_FLAG or
                Paint.DITHER_FLAG,
        ).apply {
            style =
                Paint.Style.STROKE

            strokeJoin =
                Paint.Join.ROUND

            strokeCap =
                Paint.Cap.ROUND
        }

    // =========================================================================
    // SHADERS
    // =========================================================================

    private var touchLightShader:
        RadialGradient? = null

    private var outerRimShader:
        SweepGradient? = null

    private var moldedRimShader:
        SweepGradient? = null

    private var innerRimShader:
        LinearGradient? = null

    // =========================================================================
    // MATRICES
    // =========================================================================

    private val touchLightMatrix =
        Matrix()

    private val outerRimMatrix =
        Matrix()

    private val moldedRimMatrix =
        Matrix()

    private val innerRimMatrix =
        Matrix()

    // =========================================================================
    // DENSITY
    // =========================================================================

    /**
     * Deliberately does not use:
     *
     * android.util.DisplayMetrics
     *
     * and does not access:
     *
     * resources.displayMetrics
     */
    private val densityScale: Float
        get() {
            return resources.configuration.densityDpi
                .coerceAtLeast(1)
                .toFloat() / 160f
        }

    // =========================================================================
    // CONSTRUCTION
    // =========================================================================

    init {
        setWillNotDraw(false)

        outlineProvider =
            object : ViewOutlineProvider() {

                override fun getOutline(
                    view: View,
                    outline: Outline,
                ) {
                    populateOutline(
                        outline,
                    )
                }
            }

        /*
         * Children are normal Android/RN children.
         * We don't rasterise them.
         */
        clipChildren = true
        clipToPadding = false
        clipToOutline = false

        /*
         * Never force a software layer.
         */
        isFocusable = false

        /*
         * Initialise paint state.
         */
        structuralBorderPaint.color =
            borderColor

        touchLightPaint.isDither =
            true

        outerRimPaint.isDither =
            true

        moldedRimPaint.isDither =
            true

        innerRimPaint.isDither =
            true
    }

    // =========================================================================
    // DRAW
    // =========================================================================

    override fun onDraw(
        canvas: Canvas,
    ) {
        super.onDraw(
            canvas,
        )

        if (
            !geometryReady ||
            shapePath.isEmpty
        ) {
            return
        }

        /*
         * FIX (root cause of washed-out cards): the base fill used to be
         * painted ONLY when glass was disabled. Glass is on by default, so
         * every card's backgroundColor was never drawn natively and the only
         * colour left was the Skia shader at ~22-26% opacity.
         *
         * The base surface is now always painted first, exactly as the spec's
         * render order requires:
         *
         *   shape geometry -> base surface -> glass optical treatment -> children
         */
        if (Color.alpha(fillColor) > 0) {
            drawFallbackFill(
                canvas,
            )
        }

        /*
         * When glass is disabled, this view is still a valid normal
         * squircle container.
         */
        if (!glassEnabled) {
            return
        }

        /*
         * This is the dynamic native optical contribution.
         *
         * It is intentionally drawn BEFORE the Skia child material so the
         * moving light becomes visible through the translucent material.
         */
        drawDynamicTouchLight(
            canvas,
        )
    }

    override fun dispatchDraw(
        canvas: Canvas,
    ) {
        if (
            !geometryReady ||
            shapePath.isEmpty
        ) {
            super.dispatchDraw(
                canvas,
            )

            return
        }

        /*
         * Always clip the React child hierarchy to the exact native geometry.
         * This is the authoritative overflow fix; View-level rectangular
         * clipping alone is not enough for a squircle.
         */
        val save =
            if (clipContent) {
                canvas.save()
            } else {
                -1
            }

        if (clipContent) {
            canvas.clipPath(shapePath)
        }

        super.dispatchDraw(canvas)

        if (save >= 0) {
            canvas.restoreToCount(save)
        }

        /*
         * The structural/molded border remains above children so the shell
         * stays crisp without covering the child content area.
         */
        if (glassEnabled) {
            drawMoldedBorder(canvas)
        } else {
            drawStructuralBorder(canvas)
        }
    }

    private fun drawFallbackFill(
        canvas: Canvas,
    ) {
        fallbackFillPaint.shader =
            null

        fallbackFillPaint.color =
            fillColor

        fallbackFillPaint.alpha =
            Color.alpha(
                fillColor,
            )

        canvas.drawPath(
            shapePath,
            fallbackFillPaint,
        )
    }

    // =========================================================================
    // DYNAMIC LIGHT
    // =========================================================================

    private fun drawDynamicTouchLight(
        canvas: Canvas,
    ) {
        val shader =
            touchLightShader
                ?: return

        touchLightPaint.shader =
            shader

        val intensity =
            (
                glassHighlightIntensity *
                    highlightAmount *
                    0.82f
            )
                .coerceIn(
                    0f,
                    1f,
                )

        touchLightPaint.alpha =
            (
                intensity *
                    255f
            )
                .roundToInt()
                .coerceIn(
                    0,
                    255,
                )

        canvas.drawPath(
            shapePath,
            touchLightPaint,
        )

        touchLightPaint.shader =
            null
    }

    private fun scheduleLightFrame(
        x: Float,
        y: Float,
    ) {
        if (
            !attached ||
            !glassEnabled ||
            width <= 0 ||
            height <= 0
        ) {
            return
        }

        targetLightX =
            x.coerceIn(
                0f,
                width.toFloat(),
            )

        targetLightY =
            y.coerceIn(
                0f,
                height.toFloat(),
            )

        if (lightFramePosted) {
            return
        }

        lightFramePosted =
            true

        postOnAnimation(
            lightFrameRunnable,
        )
    }

    private fun updateLightFrame() {
        if (!attached) {
            return
        }

        val now =
            System.nanoTime()

        val deltaSeconds =
            if (
                lastLightFrameNanos <= 0L
            ) {
                1f / 60f
            } else {
                (
                    (
                        now -
                            lastLightFrameNanos
                    )
                        .toDouble() /
                        1_000_000_000.0
                )
                    .coerceIn(
                        0.001,
                        0.05,
                    )
                    .toFloat()
            }

        lastLightFrameNanos =
            now

        /*
         * Frame-rate independent exponential smoothing.
         *
         * Fast while interacting.
         * Slower when returning to the idle environmental source.
         */
        val timeConstant =
            if (pressed) {
                0.038f
            } else {
                0.075f
            }

        val movementAlpha =
            (
                1f -
                    exp(
                        -deltaSeconds /
                            timeConstant,
                    )
            )
                .coerceIn(
                    0f,
                    1f,
                )

        lightX +=
            (
                targetLightX -
                    lightX
            ) *
                movementAlpha

        lightY +=
            (
                targetLightY -
                    lightY
            ) *
                movementAlpha

        val highlightConstant =
            if (pressed) {
                0.045f
            } else {
                0.095f
            }

        val highlightAlpha =
            (
                1f -
                    exp(
                        -deltaSeconds /
                            highlightConstant,
                    )
            )
                .coerceIn(
                    0f,
                    1f,
                )

        highlightAmount +=
            (
                targetHighlightAmount -
                    highlightAmount
            ) *
                highlightAlpha

        updateShaderMatrices()

        invalidate()

        val positionDistance =
            max(
                abs(
                    targetLightX -
                        lightX,
                ),
                abs(
                    targetLightY -
                        lightY,
                ),
            )

        val highlightDistance =
            abs(
                targetHighlightAmount -
                    highlightAmount,
            )

        if (
            positionDistance >
                dp(0.18f) ||
            highlightDistance >
                0.0025f
        ) {
            if (!lightFramePosted) {
                lightFramePosted =
                    true

                postOnAnimation(
                    lightFrameRunnable,
                )
            }
        }
    }

    override fun dispatchTouchEvent(
        event: MotionEvent,
    ): Boolean {
        if (glassEnabled && glassInteractive) {
            when (
                event.actionMasked
            ) {
                MotionEvent.ACTION_DOWN -> {
                    pressed =
                        true

                    targetHighlightAmount =
                        1f

                    scheduleLightFrame(
                        event.x,
                        event.y,
                    )
                }

                MotionEvent.ACTION_MOVE -> {
                    if (pressed) {
                        scheduleLightFrame(
                            event.x,
                            event.y,
                        )
                    }
                }

                MotionEvent.ACTION_UP,
                MotionEvent.ACTION_CANCEL -> {
                    pressed =
                        false

                    targetHighlightAmount =
                        0.64f

                    scheduleLightFrame(
                        width *
                            idleLightX,

                        height *
                            idleLightY,
                    )
                }
            }
        }

        /*
         * Most importantly:
         *
         * children still receive the original touch event.
         */
        return super.dispatchTouchEvent(
            event,
        )
    }

    // =========================================================================
    // LAYOUT
    // =========================================================================

    /*
     * ExpoView extends LinearLayout, which is a real Android layout: left to
     * itself it measures and positions our children horizontally using their
     * Android LayoutParams, overwriting the positions React Native's Yoga pass
     * already assigned them.
     *
     * That is what emptied these surfaces out. Every child was re-laid-out to
     * the host's own bounds, so a row's icon and its text ended up stacked on
     * top of each other at full size, the text clipped to nothing and the card
     * grown to the height of the tallest stretched child.
     *
     * React Native owns child layout here, exactly as it does for a plain
     * View. These two overrides are what ReactViewGroup does: take the size the
     * parent gives us, and never touch the children. The painted geometry is
     * rebuilt from onSizeChanged, which still fires normally.
     */
    override fun onMeasure(
        widthMeasureSpec: Int,
        heightMeasureSpec: Int,
    ) {
        setMeasuredDimension(
            MeasureSpec.getSize(
                widthMeasureSpec,
            ),
            MeasureSpec.getSize(
                heightMeasureSpec,
            ),
        )
    }

    override fun onLayout(
        changed: Boolean,
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
    ) {
        /*
         * Intentionally empty: React Native has already positioned every child.
         */
    }

    // =========================================================================
    // GEOMETRY
    // =========================================================================

    override fun onSizeChanged(
        w: Int,
        h: Int,
        oldw: Int,
        oldh: Int,
    ) {
        super.onSizeChanged(
            w,
            h,
            oldw,
            oldh,
        )

        if (
            w <= 0 ||
            h <= 0
        ) {
            geometryReady =
                false

            touchLightShader =
                null

            outerRimShader =
                null

            moldedRimShader =
                null

            innerRimShader =
                null

            return
        }

        rebuildGeometry()

        lightX =
            w *
                idleLightX.coerceIn(
                    0f,
                    1f,
                )

        lightY =
            h *
                idleLightY.coerceIn(
                    0f,
                    1f,
                )

        targetLightX =
            lightX

        targetLightY =
            lightY

        rebuildShaders()

        updateShaderMatrices()
    }

    private fun rebuildGeometry() {
        shapePath.reset()

        if (
            width <= 0 ||
            height <= 0
        ) {
            geometryReady =
                false

            return
        }

        val borderPx =
            dp(
                borderWidthDip,
            )

        /*
         * Keep structural geometry inside the view bounds.
         */
        val inset =
            (
                borderPx *
                    0.5f
            )
                .coerceAtLeast(
                    0f,
                )

        val left =
            inset

        val top =
            inset

        val right =
            max(
                left,
                width.toFloat() -
                    inset,
            )

        val bottom =
            max(
                top,
                height.toFloat() -
                    inset,
            )

        val shapeWidth =
            max(
                0f,
                right - left,
            )

        val shapeHeight =
            max(
                0f,
                bottom - top,
            )

        if (
            shapeWidth <= 0f ||
            shapeHeight <= 0f
        ) {
            geometryReady =
                false

            return
        }

        when (
            shape
        ) {
            Shape.CIRCLE -> {
                /*
                 * True centered circle rather than an oval.
                 */
                val diameter =
                    min(
                        shapeWidth,
                        shapeHeight,
                    )

                val offsetX =
                    (
                        shapeWidth -
                            diameter
                    ) * 0.5f

                val offsetY =
                    (
                        shapeHeight -
                            diameter
                    ) * 0.5f

                shapePath.addOval(
                    RectF(
                        left + offsetX,
                        top + offsetY,
                        left +
                            offsetX +
                            diameter,
                        top +
                            offsetY +
                            diameter,
                    ),
                    Path.Direction.CW,
                )
            }

            Shape.PILL -> {
                val radius =
                    min(
                        shapeWidth,
                        shapeHeight,
                    ) *
                        0.5f

                reusableRect.set(
                    left,
                    top,
                    right,
                    bottom,
                )

                shapePath.addRoundRect(
                    reusableRect,
                    radius,
                    radius,
                    Path.Direction.CW,
                )
            }

            Shape.ROUNDED -> {
                FigmaSquirclePath.build(
                    path = shapePath,
                    width = shapeWidth,
                    height = shapeHeight,
                    topLeftRadius = effectiveTopLeftRadius(shapeWidth, shapeHeight),
                    topRightRadius = effectiveTopRightRadius(shapeWidth, shapeHeight),
                    bottomRightRadius = effectiveBottomRightRadius(shapeWidth, shapeHeight),
                    bottomLeftRadius = effectiveBottomLeftRadius(shapeWidth, shapeHeight),
                    cornerSmoothingPercent = 0f,
                    preserveSmoothing = true,
                )
            }

            Shape.SQUIRCLE -> {
                /*
                 * Build in local 0..width/height coordinates first.
                 */
                val localPath =
                    shapePath

                FigmaSquirclePath.build(
                    path = localPath,
                    width = shapeWidth,
                    height = shapeHeight,
                    topLeftRadius =
                        effectiveTopLeftRadius(
                            shapeWidth,
                            shapeHeight,
                        ),
                    topRightRadius =
                        effectiveTopRightRadius(
                            shapeWidth,
                            shapeHeight,
                        ),
                    bottomRightRadius =
                        effectiveBottomRightRadius(
                            shapeWidth,
                            shapeHeight,
                        ),
                    bottomLeftRadius =
                        effectiveBottomLeftRadius(
                            shapeWidth,
                            shapeHeight,
                        ),
                    cornerSmoothingPercent =
                        cornerSmoothing,
                    preserveSmoothing =
                        preserveSmoothing,
                )

            }

            else -> {
                // Defensive fallback for future Shape enum values.
                shapePath.reset()
            }
        }

        if (
            (shape == Shape.SQUIRCLE || shape == Shape.ROUNDED) &&
            (left != 0f || top != 0f)
        ) {
            val translation = Matrix()
            translation.setTranslate(left, top)
            shapePath.transform(translation)
        }

        geometryReady =
            !shapePath.isEmpty

        /*
         * Android outlines are convex for all shapes produced here.
         */
        invalidateOutline()
    }

    private fun effectiveBaseRadius(
        shapeWidth: Float,
        shapeHeight: Float,
    ): Float {
        val maximum =
            min(
                shapeWidth,
                shapeHeight,
            ) *
                0.5f

        return if (
            !borderRadiusDip.isNaN()
        ) {
            dp(
                borderRadiusDip,
            ).coerceIn(
                0f,
                maximum,
            )
        } else {
            maximum *
                0.14f
        }
    }

    private fun effectiveTopLeftRadius(
        shapeWidth: Float,
        shapeHeight: Float,
    ): Float {
        return if (
            topLeftRadiusDip.isNaN()
        ) {
            effectiveBaseRadius(
                shapeWidth,
                shapeHeight,
            )
        } else {
            dp(
                topLeftRadiusDip.coerceAtLeast(0f),
            )
        }
    }

    private fun effectiveTopRightRadius(
        shapeWidth: Float,
        shapeHeight: Float,
    ): Float {
        return if (
            topRightRadiusDip.isNaN()
        ) {
            effectiveBaseRadius(
                shapeWidth,
                shapeHeight,
            )
        } else {
            dp(
                topRightRadiusDip.coerceAtLeast(0f),
            )
        }
    }

    private fun effectiveBottomRightRadius(
        shapeWidth: Float,
        shapeHeight: Float,
    ): Float {
        return if (
            bottomRightRadiusDip.isNaN()
        ) {
            effectiveBaseRadius(
                shapeWidth,
                shapeHeight,
            )
        } else {
            dp(
                bottomRightRadiusDip.coerceAtLeast(0f),
            )
        }
    }

    private fun effectiveBottomLeftRadius(
        shapeWidth: Float,
        shapeHeight: Float,
    ): Float {
        return if (
            bottomLeftRadiusDip.isNaN()
        ) {
            effectiveBaseRadius(
                shapeWidth,
                shapeHeight,
            )
        } else {
            dp(
                bottomLeftRadiusDip.coerceAtLeast(0f),
            )
        }
    }

    // =========================================================================
    // OUTLINE / CLIPPING
    // =========================================================================

    private fun populateOutline(
        outline: Outline,
    ) {
        if (
            !geometryReady ||
            shapePath.isEmpty
        ) {
            outline.setRect(
                0,
                0,
                width,
                height,
            )

            return
        }

        if (
            Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.R
        ) {
            outline.setPath(
                shapePath,
            )

            return
        }

        /*
         * API 26-29.
         *
         * All Setu geometry is convex.
         */
        @Suppress(
            "DEPRECATION",
        )
        outline.setConvexPath(
            shapePath,
        )
    }

    // =========================================================================
    // BORDER SHADERS
    // =========================================================================

    private fun rebuildShaders() {
        if (
            width <= 0 ||
            height <= 0
        ) {
            touchLightShader =
                null

            outerRimShader =
                null

            moldedRimShader =
                null

            innerRimShader =
                null

            return
        }

        val widthPx =
            width.toFloat()

        val heightPx =
            height.toFloat()

        val diagonal =
            hypot(
                widthPx.toDouble(),
                heightPx.toDouble(),
            )
                .toFloat()

        val lightRadius =
            max(
                diagonal *
                    0.72f,

                dp(
                    64f,
                ),
            )

        /*
         * FIX: every fully-transparent gradient stop below is now the
         * highlight colour at alpha 0 instead of Color.TRANSPARENT.
         * Android interpolates gradient stops un-premultiplied, so blending
         * white -> transparent-BLACK passed through gray. Same hue at alpha 0
         * fades cleanly.
         */
        val clearHighlight =
            withAlpha(
                highlightColor,
                0f,
            )

        touchLightShader =
            RadialGradient(
                0f,
                0f,
                lightRadius,
                intArrayOf(
                    withAlpha(
                        highlightColor,
                        0.30f,
                    ),
                    withAlpha(
                        highlightColor,
                        0.13f,
                    ),
                    withAlpha(
                        highlightColor,
                        0.035f,
                    ),
                    clearHighlight,
                ),
                floatArrayOf(
                    0f,
                    0.18f,
                    0.48f,
                    1f,
                ),
                Shader.TileMode.CLAMP,
            )

        /*
         * Broad perimeter bloom.
         */
        outerRimShader =
            SweepGradient(
                widthPx * 0.5f,
                heightPx * 0.5f,
                intArrayOf(
                    clearHighlight,

                    withAlpha(
                        highlightColor,
                        0.10f,
                    ),

                    withAlpha(
                        highlightColor,
                        0.32f,
                    ),

                    withAlpha(
                        accentColor,
                        0.08f,
                    ),

                    clearHighlight,
                ),
                floatArrayOf(
                    0f,
                    0.12f,
                    0.20f,
                    0.50f,
                    1f,
                ),
            )

        /*
         * Crisp molded line.
         */
        moldedRimShader =
            SweepGradient(
                widthPx * 0.5f,
                heightPx * 0.5f,
                intArrayOf(
                    withAlpha(
                        highlightColor,
                        0.04f,
                    ),

                    withAlpha(
                        highlightColor,
                        0.20f,
                    ),

                    withAlpha(
                        highlightColor,
                        0.78f,
                    ),

                    withAlpha(
                        accentColor,
                        0.20f,
                    ),

                    withAlpha(
                        highlightColor,
                        0.02f,
                    ),

                    withAlpha(
                        highlightColor,
                        0.04f,
                    ),
                ),
                floatArrayOf(
                    0f,
                    0.08f,
                    0.18f,
                    0.38f,
                    0.70f,
                    1f,
                ),
            )

        /*
         * Subtle inner directional edge.
         */
        innerRimShader =
            LinearGradient(
                0f,
                0f,
                widthPx,
                heightPx,
                intArrayOf(
                    withAlpha(
                        highlightColor,
                        0.16f,
                    ),
                    clearHighlight,
                    withAlpha(
                        Color.BLACK,
                        0.055f,
                    ),
                ),
                floatArrayOf(
                    0f,
                    0.54f,
                    1f,
                ),
                Shader.TileMode.CLAMP,
            )
    }

    private fun updateShaderMatrices() {
        if (
            width <= 0 ||
            height <= 0
        ) {
            return
        }

        touchLightMatrix.reset()

        touchLightMatrix.setTranslate(
            lightX,
            lightY,
        )

        touchLightShader?.setLocalMatrix(
            touchLightMatrix,
        )

        val centerX =
            width *
                0.5f

        val centerY =
            height *
                0.5f

        val lightDX =
            lightX -
                centerX

        val lightDY =
            lightY -
                centerY

        val lightAngle =
            (
                atan2(
                    lightDY,
                    lightDX,
                ) *
                    180f /
                    Math.PI.toFloat()
            )

        outerRimMatrix.reset()

        outerRimMatrix.setRotate(
            lightAngle,
            centerX,
            centerY,
        )

        outerRimShader?.setLocalMatrix(
            outerRimMatrix,
        )

        moldedRimMatrix.reset()

        moldedRimMatrix.setRotate(
            lightAngle,
            centerX,
            centerY,
        )

        moldedRimShader?.setLocalMatrix(
            moldedRimMatrix,
        )

        innerRimMatrix.reset()

        innerRimMatrix.setRotate(
            lightAngle,
            centerX,
            centerY,
        )

        innerRimShader?.setLocalMatrix(
            innerRimMatrix,
        )
    }

    // =========================================================================
    // BORDER DRAWING
    // =========================================================================

    private fun drawStructuralBorder(
        canvas: Canvas,
    ) {
        if (
            borderWidthDip <= 0f ||
            borderColor == Color.TRANSPARENT
        ) {
            return
        }

        structuralBorderPaint.shader =
            null

        structuralBorderPaint.color =
            borderColor

        structuralBorderPaint.alpha =
            Color.alpha(
                borderColor,
            )

        structuralBorderPaint.strokeWidth =
            dp(
                borderWidthDip,
            )

        canvas.drawPath(
            shapePath,
            structuralBorderPaint,
        )
    }

    private fun drawMoldedBorder(
        canvas: Canvas,
    ) {
        /*
         * 1. Structural glass boundary.
         */
        if (
            borderWidthDip > 0f &&
            borderColor != Color.TRANSPARENT
        ) {
            structuralBorderPaint.shader =
                null

            structuralBorderPaint.color =
                borderColor

            structuralBorderPaint.alpha =
                Color.alpha(
                    borderColor,
                )

            structuralBorderPaint.strokeWidth =
                dp(
                    borderWidthDip,
                )

            canvas.drawPath(
                shapePath,
                structuralBorderPaint,
            )
        }

        /*
         * 2. Very soft outer bloom.
         */
        outerRimShader?.let { shader ->
            outerRimPaint.shader =
                shader

            outerRimPaint.strokeWidth =
                dp(
                    3.0f,
                )

            outerRimPaint.alpha =
                (
                    255f *
                        glassEdgeIntensity *
                        highlightAmount *
                        0.34f
                )
                    .roundToInt()
                    .coerceIn(
                        0,
                        255,
                    )

            canvas.drawPath(
                shapePath,
                outerRimPaint,
            )

            outerRimPaint.shader =
                null
        }

        /*
         * 3. Fine molded highlight.
         *
         * This is the primary "liquid shell" line.
         */
        moldedRimShader?.let { shader ->
            moldedRimPaint.shader =
                shader

            moldedRimPaint.strokeWidth =
                dp(
                    0.95f,
                )

            moldedRimPaint.alpha =
                (
                    255f *
                        glassEdgeIntensity *
                        (
                            0.72f +
                                highlightAmount *
                                0.28f
                        )
                )
                    .roundToInt()
                    .coerceIn(
                        0,
                        255,
                    )

            canvas.drawPath(
                shapePath,
                moldedRimPaint,
            )

            moldedRimPaint.shader =
                null
        }

        /*
         * 4. Fine inner rim gives depth.
         */
        innerRimShader?.let { shader ->
            innerRimPaint.shader =
                shader

            innerRimPaint.strokeWidth =
                dp(
                    0.70f,
                )

            innerRimPaint.alpha =
                (
                    255f *
                        glassEdgeIntensity *
                        highlightAmount *
                        0.28f
                )
                    .roundToInt()
                    .coerceIn(
                        0,
                        255,
                    )

            canvas.drawPath(
                shapePath,
                innerRimPaint,
            )

            innerRimPaint.shader =
                null
        }
    }

    // =========================================================================
    // PROPS
    // =========================================================================

    fun setViewBackgroundColor(
        color: Int?,
    ) {
        fillColor =
            color ?: Color.TRANSPARENT

        invalidate()
    }

    fun setBorderColor(
        color: Int?,
    ) {
        borderColor =
            color ?: Color.TRANSPARENT

        invalidate()
    }

    fun setHighlightColor(
        color: Int?,
    ) {
        highlightColor =
            color ?: Color.WHITE

        rebuildShaders()
        updateShaderMatrices()

        invalidate()
    }

    /*
     * New: the accent colour (Setu coral) used by the rim gradients. Sent
     * from SquircleSurface as squircleAccentColor.
     */
    fun setAccentColor(
        color: Int?,
    ) {
        accentColor =
            color ?: Color.WHITE

        rebuildShaders()
        updateShaderMatrices()

        invalidate()
    }

    fun setBorderWidth(
        width: Float?,
    ) {
        borderWidthDip =
            (
                width
                    ?.takeIf { it.isFinite() }
                    ?: 0f
            )
                .coerceAtLeast(
                    0f,
                )

        rebuildGeometry()

        invalidate()
    }

    fun setBorderRadius(
        radius: Float?,
    ) {
        borderRadiusDip =
            radius
                ?.takeIf { it.isFinite() }
                ?.coerceAtLeast(0f)
                ?: Float.NaN

        rebuildGeometry()
        invalidate()
    }

    fun setTopLeftRadius(
        radius: Float?,
    ) {
        topLeftRadiusDip =
            radius
                ?.takeIf { it.isFinite() }
                ?.coerceAtLeast(0f)
                ?: Float.NaN

        rebuildGeometry()

        invalidate()
    }

    fun setTopRightRadius(
        radius: Float?,
    ) {
        topRightRadiusDip =
            radius
                ?.takeIf { it.isFinite() }
                ?.coerceAtLeast(0f)
                ?: Float.NaN

        rebuildGeometry()

        invalidate()
    }

    fun setBottomRightRadius(
        radius: Float?,
    ) {
        bottomRightRadiusDip =
            radius
                ?.takeIf { it.isFinite() }
                ?.coerceAtLeast(0f)
                ?: Float.NaN

        rebuildGeometry()

        invalidate()
    }

    fun setBottomLeftRadius(
        radius: Float?,
    ) {
        bottomLeftRadiusDip =
            radius
                ?.takeIf { it.isFinite() }
                ?.coerceAtLeast(0f)
                ?: Float.NaN

        rebuildGeometry()

        invalidate()
    }

    fun setCornerSmoothing(
        smoothing: Float?,
    ) {
        cornerSmoothing =
            (
                smoothing
                    ?.takeIf { it.isFinite() }
                    ?: 100f
            )
                .coerceIn(
                    0f,
                    100f,
                )

        rebuildGeometry()

        invalidate()
    }

    fun setPreserveSmoothing(
        preserve: Boolean?,
    ) {
        preserveSmoothing =
            preserve ?: true

        rebuildGeometry()

        invalidate()
    }

    fun setShape(
        value: String?,
    ) {
        shape =
            when (
                value
                    ?.trim()
                    ?.lowercase()
            ) {
                "rounded" ->
                    Shape.ROUNDED

                "pill" ->
                    Shape.PILL

                "circle" ->
                    Shape.CIRCLE

                else ->
                    Shape.SQUIRCLE
            }

        rebuildGeometry()

        invalidate()
    }

    fun setGlassEnabled(
        enabled: Boolean?,
    ) {
        glassEnabled =
            enabled ?: true

        invalidate()
    }

    /*
     * Stored for API compatibility and future native material tuning.
     * The advanced material itself is rendered by Skia.
     */
    fun setGlassOpacity(
        opacity: Float?,
    ) {
        glassOpacity =
            (
                opacity
                    ?.takeIf { it.isFinite() }
                    ?: 0.58f
            )
                .coerceIn(
                    0f,
                    1f,
                )

        invalidate()
    }

    fun setGlassEdgeIntensity(
        intensity: Float?,
    ) {
        glassEdgeIntensity =
            (
                intensity
                    ?.takeIf { it.isFinite() }
                    ?: 0.80f
            )
                .coerceIn(
                    0f,
                    2f,
                )

        invalidate()
    }

    fun setGlassHighlightIntensity(
        intensity: Float?,
    ) {
        glassHighlightIntensity =
            (
                intensity
                    ?.takeIf { it.isFinite() }
                    ?: 0.72f
            )
                .coerceIn(
                    0f,
                    2f,
                )

        invalidate()
    }

    fun setGlassInteractive(
        enabled: Boolean?,
    ) {
        val nextValue = enabled ?: false
        if (glassInteractive == nextValue) {
            return
        }

        val wasPressed = pressed
        glassInteractive = nextValue

        if (!glassInteractive && wasPressed) {
            pressed = false
            targetHighlightAmount = 0.64f
            scheduleLightFrame(width * idleLightX, height * idleLightY)
        }

        invalidate()
    }

    fun setClipContent(
        clip: Boolean?,
    ) {
        clipContent = clip ?: true

        /*
         * Keep Android's rectangular child clipping and outline clipping in
         * sync with the public React Native overflow contract.
         */
        clipChildren = clipContent
        clipToOutline = false

        invalidate()
    }

    fun setGlassLightX(
        value: Float?,
    ) {
        idleLightX =
            (
                value
                    ?.takeIf { it.isFinite() }
                    ?: 0.16f
            )
                .coerceIn(
                    0f,
                    1f,
                )

        if (!pressed) {
            scheduleLightFrame(
                width *
                    idleLightX,

                height *
                    idleLightY,
            )
        }
    }

    fun setGlassLightY(
        value: Float?,
    ) {
        idleLightY =
            (
                value
                    ?.takeIf { it.isFinite() }
                    ?: 0.10f
            )
                .coerceIn(
                    0f,
                    1f,
                )

        if (!pressed) {
            scheduleLightFrame(
                width *
                    idleLightX,

                height *
                    idleLightY,
            )
        }
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()

        attached =
            true

        lastLightFrameNanos =
            System.nanoTime()

        if (
            width > 0 &&
            height > 0
        ) {
            lightX =
                width *
                    idleLightX.coerceIn(
                        0f,
                        1f,
                    )

            lightY =
                height *
                    idleLightY.coerceIn(
                        0f,
                        1f,
                    )

            targetLightX =
                lightX

            targetLightY =
                lightY

            updateShaderMatrices()
        }
    }

    override fun onDetachedFromWindow() {
        attached =
            false

        pressed =
            false

        targetHighlightAmount =
            0.64f

        removeCallbacks(
            lightFrameRunnable,
        )

        lightFramePosted =
            false

        lastLightFrameNanos =
            0L

        super.onDetachedFromWindow()
    }

    override fun onWindowVisibilityChanged(
        visibility: Int,
    ) {
        super.onWindowVisibilityChanged(
            visibility,
        )

        if (
            visibility !=
                View.VISIBLE
        ) {
            removeCallbacks(
                lightFrameRunnable,
            )

            lightFramePosted =
                false
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private fun dp(
        value: Float,
    ): Float {
        return value *
            densityScale
    }

    private fun withAlpha(
        color: Int,
        alpha: Float,
    ): Int {
        val clamped =
            alpha.coerceIn(
                0f,
                1f,
            )

        val finalAlpha =
            (
                clamped *
                    255f
            )
                .roundToInt()
                .coerceIn(
                    0,
                    255,
                )

        return (
            color and
                0x00FFFFFF
            ) or
            (
                finalAlpha shl
                    24
                )
    }
}
