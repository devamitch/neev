package expo.modules.setunative.ui

import android.app.Activity
import android.view.WindowManager

internal object SecureScreenHelper {
    fun setSecure(activity: Activity?, secure: Boolean) {
        activity?.window?.let { window ->
            if (secure) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }
}
