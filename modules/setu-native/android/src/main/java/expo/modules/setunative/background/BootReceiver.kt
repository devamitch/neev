package expo.modules.setunative.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import expo.modules.setunative.bootstrap.RuntimePreferences
import expo.modules.setunative.shared.SetuLog

/**
 * Restores background availability after a reboot, but only when the user asked for it and Setu has
 * an identity to run with. Best effort: Android may refuse the start, which is logged, not crashed.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!RuntimePreferences.runInBackground(context)) return
        if (!expo.modules.setunative.security.IdentityVault.vaultExists(context)) return
        val started = SetuService.startIfEnabled(context, fromBoot = true)
        SetuLog.i(SetuLog.BOOT, "boot restore requested, started=$started")
    }
}
