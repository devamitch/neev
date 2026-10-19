package expo.modules.setunative.background

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import expo.modules.setunative.bootstrap.RuntimePreferences
import expo.modules.setunative.bootstrap.SetuRuntime
import expo.modules.setunative.shared.SetuLog

/**
 * Keeps Setu reachable while it is not in the foreground, so messages and files that a nearby
 * device is already sending can finish arriving. Best effort only: Android may stop this service,
 * and the app never promises background delivery.
 *
 * startForeground() is called first thing in onStartCommand, before any other work, so the
 * Android 12+ "did not call startForeground in time" crash cannot happen. The service owns no
 * state: it starts the same idempotent SetuRuntime the UI uses.
 */
class SetuService : Service() {

    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForegroundCompat()
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val fromBoot = intent?.getBooleanExtra(EXTRA_FROM_BOOT, false) == true
        // On a BOOT_COMPLETED start Android grants no dataSync-while-in-use exemption, so only the
        // connectedDevice type is claimed there.
        val serviceTypes = if (fromBoot) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        } else {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, createNotification(), serviceTypes)
            } else {
                startForeground(NOTIFICATION_ID, createNotification())
            }
        } catch (error: Exception) {
            // Android 14+ rejects a start that is not allowed from the background; do not crash.
            SetuLog.w(SetuLog.BOOT, "foreground service not permitted: ${error.javaClass.simpleName}")
            stopSelf(startId)
            return START_NOT_STICKY
        }

        running = true
        try {
            SetuRuntime.start(applicationContext, null)
            SetuLog.i(SetuLog.BOOT, "background service running (fromBoot=$fromBoot)")
        } catch (error: Exception) {
            SetuLog.e(SetuLog.BOOT, "runtime could not start in the service", error)
            stopForegroundCompat()
            stopSelf(startId)
            running = false
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    /** Android 14 timeout for a dataSync service: stop cleanly instead of being killed. */
    override fun onTimeout(startId: Int) {
        SetuLog.i(SetuLog.BOOT, "background service timed out")
        stopForegroundCompat()
        stopSelf(startId)
    }

    override fun onTimeout(startId: Int, foregroundServiceType: Int) = onTimeout(startId)

    override fun onDestroy() {
        running = false
        // The runtime keeps running when the UI is in the foreground; only a full stop tears it down.
        SetuLog.i(SetuLog.BOOT, "background service stopped")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Setu is available", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Shown while Setu can receive from nearby devices."
                setShowBadge(false)
            },
        )
    }

    private fun createNotification(): Notification {
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Setu is available")
            .setContentText("Ready to receive from nearby devices")
            .setOngoing(true)
            .setShowWhen(false)
            .apply { launch?.let { setContentIntent(it) } }
            .build()
    }

    companion object {
        const val ACTION_START = "expo.modules.setunative.background.START"
        const val ACTION_STOP = "expo.modules.setunative.background.STOP"
        const val EXTRA_FROM_BOOT = "from_boot"
        private const val CHANNEL_ID = "setu_service"
        private const val NOTIFICATION_ID = 4101

        @Volatile
        private var running = false

        fun isRunning(): Boolean = running

        /** Starts the service only when the user has left background running enabled. */
        fun startIfEnabled(context: android.content.Context, fromBoot: Boolean): Boolean {
            if (!RuntimePreferences.runInBackground(context)) return false
            val intent = Intent(context, SetuService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_FROM_BOOT, fromBoot)
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                true
            } catch (error: Exception) {
                SetuLog.w(SetuLog.BOOT, "could not start background service: ${error.javaClass.simpleName}")
                false
            }
        }

        fun stop(context: android.content.Context): Boolean =
            context.stopService(Intent(context, SetuService::class.java))
    }
}
