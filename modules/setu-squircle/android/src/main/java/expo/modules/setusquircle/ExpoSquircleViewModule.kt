package expo.modules.setusquircle

import android.view.View
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoSquircleViewModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoSquircleView")
        View(ExpoSquircleView::class) {
            GroupView<ExpoSquircleView> {
                AddChildView<View> { parent, child, index -> parent.addView(child, index) }
                GetChildCount { parent -> parent.childCount }
                GetChildViewAt<View> { parent, index -> parent.getChildAt(index) }
                RemoveChildView<View> { parent, child -> parent.removeView(child) }
                RemoveChildViewAt { parent, index -> parent.removeViewAt(index) }
            }
            Prop("squircleBackgroundColor") { view: ExpoSquircleView, color: Int? -> view.setViewBackgroundColor(color) }
            Prop("squircleBorderColor") { view: ExpoSquircleView, color: Int? -> view.setBorderColor(color) }
            Prop("squircleHighlightColor") { view: ExpoSquircleView, color: Int? -> view.setHighlightColor(color) }
            Prop("squircleAccentColor") { view: ExpoSquircleView, color: Int? -> view.setAccentColor(color) }
            Prop("squircleBorderWidth") { view: ExpoSquircleView, width: Float? -> view.setBorderWidth(width) }
            Prop("squircleRadius") { view: ExpoSquircleView, radius: Float? -> view.setBorderRadius(radius) }
            Prop("topLeftRadius") { view: ExpoSquircleView, radius: Float? -> view.setTopLeftRadius(radius) }
            Prop("topRightRadius") { view: ExpoSquircleView, radius: Float? -> view.setTopRightRadius(radius) }
            Prop("bottomRightRadius") { view: ExpoSquircleView, radius: Float? -> view.setBottomRightRadius(radius) }
            Prop("bottomLeftRadius") { view: ExpoSquircleView, radius: Float? -> view.setBottomLeftRadius(radius) }
            Prop("cornerSmoothing") { view: ExpoSquircleView, smoothing: Float? -> view.setCornerSmoothing(smoothing) }
            Prop("preserveSmoothing") { view: ExpoSquircleView, preserve: Boolean? -> view.setPreserveSmoothing(preserve) }
            Prop("shape") { view: ExpoSquircleView, value: String? -> view.setShape(value) }
            Prop("glassEnabled") { view: ExpoSquircleView, enabled: Boolean? -> view.setGlassEnabled(enabled) }
            Prop("glassOpacity") { view: ExpoSquircleView, opacity: Float? -> view.setGlassOpacity(opacity) }
            Prop("glassEdgeIntensity") { view: ExpoSquircleView, intensity: Float? -> view.setGlassEdgeIntensity(intensity) }
            Prop("glassHighlightIntensity") { view: ExpoSquircleView, intensity: Float? -> view.setGlassHighlightIntensity(intensity) }
            Prop("glassLightX") { view: ExpoSquircleView, x: Float? -> view.setGlassLightX(x) }
            Prop("glassLightY") { view: ExpoSquircleView, y: Float? -> view.setGlassLightY(y) }
            Prop("glassInteractive") { view: ExpoSquircleView, enabled: Boolean? -> view.setGlassInteractive(enabled) }
            Prop("clipContent") { view: ExpoSquircleView, clip: Boolean? -> view.setClipContent(clip) }
        }
    }
}
