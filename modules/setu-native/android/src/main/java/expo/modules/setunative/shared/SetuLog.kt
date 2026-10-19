package expo.modules.setunative.shared

import android.util.Log

/**
 * Log tags for the logcat filter `adb logcat 'SETU*:V'`. Messages never contain keys, tokens,
 * session secrets or private content; peers are referred to by the first 8 characters of their id.
 * Release builds strip Log.v/d/i through the module's consumer rules.
 */
object SetuLog {
    const val BOOT = "SETU_BOOT"
    const val NEARBY = "SETU_NEARBY"
    const val TRANSPORT = "SETU_TRANSPORT"
    const val NFC = "SETU_NFC"
    const val STORAGE = "SETU_STORAGE"
    const val MEDIA = "SETU_MEDIA"
    const val AUDIO = "SETU_AUDIO"
    const val CAMERA = "SETU_CAMERA"
    const val IDENTITY = "SETU_IDENTITY"

    fun i(tag: String, message: String) {
        Log.i(tag, message)
    }

    fun w(tag: String, message: String, error: Throwable? = null) {
        if (error == null) Log.w(tag, message) else Log.w(tag, message, error)
    }

    fun e(tag: String, message: String, error: Throwable? = null) {
        if (error == null) Log.e(tag, message) else Log.e(tag, message, error)
    }

    /** Short, non-secret handle for a peer or device id. */
    fun id(value: String?): String = value?.take(8) ?: "none"
}
