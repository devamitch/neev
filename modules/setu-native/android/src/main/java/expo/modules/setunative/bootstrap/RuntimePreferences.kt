package expo.modules.setunative.bootstrap

import android.content.Context

/**
 * Non-sensitive native preferences that must survive a restart without JS: the display name that is
 * advertised nearby and whether the foreground service should keep Setu available in the background.
 */
internal object RuntimePreferences {
    private const val FILE = "setu_runtime"
    private const val DEVICE_NAME = "device_name"
    private const val RUN_IN_BACKGROUND = "run_in_background"
    private const val MAX_NAME = 40

    fun deviceName(context: Context, update: String?): String {
        val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        val cleaned = update?.trim()?.take(MAX_NAME)?.takeIf { it.isNotEmpty() }
        if (cleaned != null) prefs.edit().putString(DEVICE_NAME, cleaned).apply()
        return cleaned ?: prefs.getString(DEVICE_NAME, null) ?: "Setu device"
    }

    /** On by default: Setu is a nearby-sharing app and is only useful if it can receive in the background. */
    fun runInBackground(context: Context): Boolean =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(RUN_IN_BACKGROUND, true)

    fun setRunInBackground(context: Context, enabled: Boolean) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(RUN_IN_BACKGROUND, enabled).apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
