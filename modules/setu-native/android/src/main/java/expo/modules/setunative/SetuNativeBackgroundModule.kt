package expo.modules.setunative

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.background.SetuService
import expo.modules.setunative.bootstrap.RuntimePreferences
import expo.modules.setunative.nearby.RadioController

/**
 * Background availability controls. Everything here is best effort: Android decides whether a
 * foreground service may run, and the UI never promises background delivery.
 */
class SetuNativeBackgroundModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("SetuNativeBackground")

        AsyncFunction("startSetuService") { SetuService.startIfEnabled(context(), fromBoot = false) }

        AsyncFunction("stopSetuService") { SetuService.stop(context()) }

        Function("isSetuServiceRunning") { SetuService.isRunning() }

        Function("getStartOnBoot") { RuntimePreferences.runInBackground(context()) }

        AsyncFunction("setStartOnBoot") { enabled: Boolean ->
            RuntimePreferences.setRunInBackground(context(), enabled)
            if (!enabled) SetuService.stop(context())
            RuntimePreferences.runInBackground(context())
        }

        Function("isIgnoringBatteryOptimizations") {
            RadioController.snapshot(context()).battery == expo.modules.setunative.nearby.RadioState.AVAILABLE
        }

        /** Opens the system battery-optimisation screen; Setu never requests the restricted permission. */
        AsyncFunction("openBatteryOptimizationSettings") {
            RadioController.openSettings(context(), appContext.currentActivity, "battery")
        }
    }

    private fun context(): Context =
        appContext.reactContext?.applicationContext ?: throw IllegalStateException("REACT_CONTEXT_UNAVAILABLE")
}
