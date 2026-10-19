package expo.modules.setunative.notifications

import android.content.Context

internal object SetuNotificationPreferences {
    private const val PREFS = "setu_notification_settings"
    private const val PREVIEWS_ENABLED = "previews_enabled"

    fun arePreviewsEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREVIEWS_ENABLED, false)

    fun setPreviewsEnabled(context: Context, enabled: Boolean): Boolean {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(PREVIEWS_ENABLED, enabled)
            .apply()
        return arePreviewsEnabled(context) == enabled
    }
}
