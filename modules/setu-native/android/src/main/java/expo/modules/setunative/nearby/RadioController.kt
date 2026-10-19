package expo.modules.setunative.nearby

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pManager
import android.nfc.NfcAdapter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.setunative.shared.SetuLog
import java.util.concurrent.CopyOnWriteArrayList

enum class RadioState { AVAILABLE, DISABLED, UNSUPPORTED, PERMISSION_MISSING }

data class RadioSnapshot(
    val nfc: RadioState,
    val wifi: RadioState,
    val wifiDirect: RadioState,
    val location: RadioState,
    val nearbyPermission: RadioState,
    val notifications: RadioState,
    /** AVAILABLE when Setu is exempt from battery optimisation, DISABLED when Android may restrict it. */
    val battery: RadioState,
) {
    fun toMap(): Map<String, Any> = mapOf(
        "nfc" to nfc.name,
        "wifi" to wifi.name,
        "wifiDirect" to wifiDirect.name,
        "location" to location.name,
        "nearbyPermission" to nearbyPermission.name,
        "notifications" to notifications.name,
        "battery" to battery.name,
    )
}

/**
 * One owner for the state of every radio and permission Setu depends on. Android cannot silently
 * switch NFC or Wi-Fi on, so this reports the truth (never "on" when off), tells JS the moment it
 * changes, and opens the exact system screen that fixes it. Receivers exist only between
 * [start] and [stop].
 */
object RadioController {
    private val listeners = CopyOnWriteArrayList<(RadioSnapshot) -> Unit>()
    private val handler = Handler(Looper.getMainLooper())
    private var appContext: Context? = null
    private var receiver: BroadcastReceiver? = null
    private var last: RadioSnapshot? = null
    @Volatile
    private var p2pEnabled: Boolean? = null

    fun snapshot(context: Context): RadioSnapshot {
        val ctx = context.applicationContext
        val pm = ctx.packageManager

        val nfc = when {
            !pm.hasSystemFeature(PackageManager.FEATURE_NFC) -> RadioState.UNSUPPORTED
            else -> when (NfcAdapter.getDefaultAdapter(ctx)?.isEnabled) {
                null -> RadioState.UNSUPPORTED
                true -> RadioState.AVAILABLE
                false -> RadioState.DISABLED
            }
        }

        val wifiManager = ctx.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val wifi = when {
            !pm.hasSystemFeature(PackageManager.FEATURE_WIFI) || wifiManager == null -> RadioState.UNSUPPORTED
            wifiManager.isWifiEnabled -> RadioState.AVAILABLE
            else -> RadioState.DISABLED
        }

        val wifiDirect = when {
            !pm.hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT) -> RadioState.UNSUPPORTED
            p2pEnabled == true -> RadioState.AVAILABLE
            p2pEnabled == false -> RadioState.DISABLED
            wifi == RadioState.AVAILABLE -> RadioState.AVAILABLE
            else -> RadioState.DISABLED
        }

        // Location services matter for Wi-Fi Direct discovery on Android 12 and older only.
        val location = if (Build.VERSION.SDK_INT >= 33) {
            RadioState.AVAILABLE
        } else {
            val manager = ctx.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            when {
                manager == null -> RadioState.UNSUPPORTED
                locationEnabled(manager) -> RadioState.AVAILABLE
                else -> RadioState.DISABLED
            }
        }

        val nearbyPermission = if (granted(ctx, if (Build.VERSION.SDK_INT >= 33) Manifest.permission.NEARBY_WIFI_DEVICES else Manifest.permission.ACCESS_FINE_LOCATION)) {
            RadioState.AVAILABLE
        } else {
            RadioState.PERMISSION_MISSING
        }

        val notifications = if (NotificationManagerCompat.from(ctx).areNotificationsEnabled()) {
            RadioState.AVAILABLE
        } else {
            RadioState.PERMISSION_MISSING
        }

        val power = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val battery = if (power?.isIgnoringBatteryOptimizations(ctx.packageName) == true) RadioState.AVAILABLE else RadioState.DISABLED

        return RadioSnapshot(nfc, wifi, wifiDirect, location, nearbyPermission, notifications, battery)
    }

    fun addListener(listener: (RadioSnapshot) -> Unit) {
        listeners.addIfAbsent(listener)
    }

    fun removeListener(listener: (RadioSnapshot) -> Unit) {
        listeners.remove(listener)
    }

    /** Registers the state receivers once. Call only after the app is READY. */
    @Synchronized
    fun start(context: Context) {
        if (receiver != null) return
        val ctx = context.applicationContext
        appContext = ctx
        val filter = IntentFilter().apply {
            addAction(NfcAdapter.ACTION_ADAPTER_STATE_CHANGED)
            addAction(WifiManager.WIFI_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(LocationManager.MODE_CHANGED_ACTION)
            addAction(LocationManager.PROVIDERS_CHANGED_ACTION)
        }
        val next = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action == WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION) {
                    p2pEnabled = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1) == WifiP2pManager.WIFI_P2P_STATE_ENABLED
                }
                scheduleRefresh()
            }
        }
        // System broadcasts reach a non-exported receiver; the flag is required on Android 13+.
        if (Build.VERSION.SDK_INT >= 33) {
            ctx.registerReceiver(next, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            ctx.registerReceiver(next, filter)
        }
        receiver = next
        last = snapshot(ctx)
        SetuLog.i(SetuLog.BOOT, "radio receivers registered")
    }

    @Synchronized
    fun stop() {
        val ctx = appContext
        val current = receiver
        if (ctx != null && current != null) {
            try {
                ctx.unregisterReceiver(current)
            } catch (_: IllegalArgumentException) {
            }
        }
        receiver = null
        handler.removeCallbacksAndMessages(null)
    }

    /** Re-reads everything (for example after the user returns from system Settings). */
    fun refresh() = scheduleRefresh()

    private fun scheduleRefresh() {
        handler.removeCallbacks(publish)
        handler.postDelayed(publish, DEBOUNCE_MS)
    }

    private val publish = Runnable {
        val ctx = appContext ?: return@Runnable
        val next = snapshot(ctx)
        if (next == last) return@Runnable
        last = next
        SetuLog.i(SetuLog.BOOT, "radio state nfc=${next.nfc} wifi=${next.wifi} p2p=${next.wifiDirect} nearby=${next.nearbyPermission}")
        listeners.forEach { it(next) }
    }

    /** Opens the exact system screen for [kind]; falls back to Android Settings, then reports failure. */
    fun openSettings(context: Context, activity: Activity?, kind: String): Boolean {
        val ctx = activity ?: context
        val intents = when (kind) {
            "nfc" -> listOf(Intent(Settings.ACTION_NFC_SETTINGS))
            "wifi" -> buildList {
                if (Build.VERSION.SDK_INT >= 29) add(Intent(Settings.Panel.ACTION_WIFI))
                add(Intent(Settings.ACTION_WIFI_SETTINGS))
            }
            "location" -> listOf(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            "app" -> listOf(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
            )
            "battery" -> listOf(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            else -> emptyList()
        } + Intent(Settings.ACTION_SETTINGS)

        for (intent in intents) {
            try {
                if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
                return true
            } catch (_: android.content.ActivityNotFoundException) {
                continue
            } catch (_: SecurityException) {
                continue
            }
        }
        return false
    }

    private fun locationEnabled(manager: LocationManager): Boolean =
        if (Build.VERSION.SDK_INT >= 28) {
            manager.isLocationEnabled
        } else {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }

    private fun granted(context: Context, permission: String): Boolean =
        context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private const val DEBOUNCE_MS = 150L
}
