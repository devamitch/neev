package expo.modules.setunative.nearby

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.shared.SetuLog
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.concurrent.CopyOnWriteArrayList

enum class NearbyState { STOPPED, WAITING_FOR_NETWORK, SEARCHING, ERROR }

data class NearbySnapshot(
    val state: NearbyState,
    val scanning: Boolean,
    val peerCount: Int,
    val reason: String?,
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "state" to state.name,
        "scanning" to scanning,
        "peerCount" to peerCount,
        "reason" to reason,
    )
}

/**
 * Orchestrates "be findable and find others". It is started once the app is READY (and by the
 * foreground service), is idempotent, waits for a usable local network instead of failing, and
 * re-registers when the network changes.
 *
 * Advertising and the transport server run for as long as Nearby is started so incoming offers
 * can be received; scanning is switched on only while the Nearby screen is focused.
 */
object NearbyController {
    private val handler = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<(NearbySnapshot) -> Unit>()
    private val peerCallbacks = CopyOnWriteArrayList<DiscoveryCallback>()

    private var appContext: Context? = null
    private var deviceName: String = "Setu device"
    private var started = false
    private var scanning = false
    private var state = NearbyState.STOPPED
    private var reason: String? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var serverStart: (() -> Int)? = null
    /** The transport port once the server is up; the other half of the typed-address fallback. */
    private var listenPort: Int? = null
    private val localNetworks = java.util.Collections.synchronizedSet(mutableSetOf<Network>())
    private var wifiDirect: WifiDirectManager? = null

    private val discoveryCallback = object : DiscoveryCallback {
        override fun onPeerDiscovered(peer: DiscoveredPeer) {
            peerCallbacks.forEach { it.onPeerDiscovered(peer) }
            publish()
        }

        override fun onPeerLost(peerId: String, serviceName: String) {
            peerCallbacks.forEach { it.onPeerLost(peerId, serviceName) }
            publish()
        }

        override fun onDiscoveryFailed(errorCode: Int) {
            handler.post { fail("NSD_FAILURE_$errorCode") }
        }
    }

    fun addListener(listener: (NearbySnapshot) -> Unit) {
        listeners.addIfAbsent(listener)
    }

    fun removeListener(listener: (NearbySnapshot) -> Unit) {
        listeners.remove(listener)
    }

    fun addPeerCallback(callback: DiscoveryCallback) {
        peerCallbacks.addIfAbsent(callback)
    }

    fun removePeerCallback(callback: DiscoveryCallback) {
        peerCallbacks.remove(callback)
    }

    @Synchronized
    fun snapshot(): NearbySnapshot {
        val peers = appContext?.let { SetuDiscoveryManager.peekOrNull()?.snapshotPeers()?.size } ?: 0
        return NearbySnapshot(state, scanning, peers, reason)
    }

    /** Everyone found right now, over the local network and over Wi-Fi Direct alike. */
    fun peers(): List<DiscoveredPeer> {
        val lan = SetuDiscoveryManager.peekOrNull()?.snapshotPeers() ?: emptyList()
        val direct = wifiDirect?.peers() ?: emptyList()
        if (direct.isEmpty()) return lan
        // A peer reachable on the local network is kept as such: it needs no group to be formed.
        val seen = lan.mapTo(mutableSetOf()) { it.id }
        return lan + direct.filterNot { it.id in seen }
    }

    /** Wi-Fi Direct for the screens that must say what is really available. */
    fun wifiDirectState(context: Context): String {
        val direct = wifiDirect ?: WifiDirectManager(context).also { wifiDirect = it }
        return when {
            !direct.isSupported() -> "UNSUPPORTED"
            !direct.isEnabled() -> "DISABLED"
            else -> "AVAILABLE"
        }
    }

    /**
     * Forms a Wi-Fi Direct group with [peerId] and hands back the address to dial. Android shows
     * its own invitation on the other phone, so this never connects behind the user's back.
     */
    fun connectOverWifiDirect(peerId: String, onResult: (WifiDirectLink?, String?) -> Unit) {
        val direct = wifiDirect
        if (direct == null) {
            onResult(null, "WIFI_DIRECT_UNAVAILABLE")
            return
        }
        direct.connect(peerId, onResult)
    }

    fun leaveWifiDirectGroup() {
        wifiDirect?.disconnect()
    }

    /**
     * Starts advertising and the transport server. [startServer] binds the TLS server and returns its
     * port; it is supplied by the runtime that owns the session handlers.
     */
    @Synchronized
    fun start(context: Context, name: String, startServer: () -> Int): NearbySnapshot {
        val ctx = context.applicationContext
        appContext = ctx
        if (name.isNotBlank()) deviceName = name.take(DiscoveryConstants.MAX_DEVICE_NAME_LENGTH)
        serverStart = startServer
        if (started) {
            handler.post { reconcile() }
            return snapshot()
        }
        started = true
        SetuDiscoveryManager.get(ctx).addCallback(discoveryCallback)
        // Wi-Fi Direct is the second way to be found; it reports through the same callback, so
        // everything downstream — cards, sessions, transfers — stays unaware of which one it was.
        val direct = wifiDirect ?: WifiDirectManager(ctx).also { wifiDirect = it }
        direct.addCallback(discoveryCallback)
        registerNetworkCallback(ctx)
        SetuLog.i(SetuLog.NEARBY, "nearby started")
        handler.post { reconcile() }
        return snapshot()
    }

    @Synchronized
    fun stop() {
        if (!started) return
        started = false
        scanning = false
        unregisterNetworkCallback()
        val ctx = appContext
        if (ctx != null) {
            val discovery = SetuDiscoveryManager.get(ctx)
            discovery.stopDiscovery()
            discovery.stopAdvertising()
            discovery.removeCallback(discoveryCallback)
        }
        wifiDirect?.let {
            it.removeCallback(discoveryCallback)
            it.stop()
        }
        SetuPeerTransport.stopServer()
        state = NearbyState.STOPPED
        reason = null
        publish()
        SetuLog.i(SetuLog.NEARBY, "nearby stopped")
    }

    @Synchronized
    fun setScanning(enabled: Boolean) {
        if (scanning == enabled) return
        scanning = enabled
        val ctx = appContext ?: return
        if (!started) return
        val discovery = SetuDiscoveryManager.get(ctx)
        if (enabled && state == NearbyState.SEARCHING) discovery.startDiscovery() else if (!enabled) discovery.stopDiscovery()
        publish()
    }

    /** Re-evaluates the network and starts or pauses everything accordingly. Runs on the main thread. */
    private fun reconcile() {
        val ctx = appContext ?: return
        synchronized(this) {
            if (!started) return

            // The transport server binds a local port and needs no network at all, so it comes up
            // first: Wi-Fi Direct carries that port in its record and is precisely the transport
            // for a phone with nothing to join.
            val port = try {
                serverStart?.invoke() ?: error("TRANSPORT_NOT_READY")
            } catch (error: Exception) {
                fail("TRANSPORT_START_FAILED")
                SetuLog.e(SetuLog.TRANSPORT, "server did not start", error)
                return
            }
            listenPort = port
            wifiDirect?.let { direct ->
                val result = direct.start(deviceName, port)
                if (result != "READY") SetuLog.i(SetuLog.NEARBY, "wifi direct not started: $result")
            }

            // mDNS is the part that needs a local network.
            if (!hasUsableNetwork(ctx)) {
                SetuDiscoveryManager.peekOrNull()?.let {
                    it.stopDiscovery()
                    it.stopAdvertising()
                }
                state = NearbyState.WAITING_FOR_NETWORK
                reason = null
                publish()
                SetuLog.i(SetuLog.NEARBY, "waiting for a usable local network")
                return
            }
            val discovery = SetuDiscoveryManager.get(ctx)
            discovery.startAdvertising(deviceName, port)
            if (scanning) discovery.startDiscovery()
            state = NearbyState.SEARCHING
            reason = null
            publish()
        }
    }

    /**
     * The address another phone can type when discovery cannot see this one: the site-local IPv4
     * of the interface Setu is listening on, with the transport port. Null before the server is up.
     */
    fun localEndpoint(): Map<String, Any?>? {
        val port = listenPort ?: return null
        val host = localAddress() ?: return null
        return mapOf("host" to host, "port" to port)
    }

    private fun localAddress(): String? = try {
        NetworkInterface.getNetworkInterfaces().asSequence()
            .filter { it.isUp && !it.isLoopback && AP_INTERFACE.matches(it.name) }
            .flatMap { it.inetAddresses.asSequence() }
            .filterIsInstance<Inet4Address>()
            .firstOrNull { !it.isLoopbackAddress }
            ?.hostAddress
    } catch (_: Exception) {
        null
    }

    private fun fail(why: String) {
        synchronized(this) {
            if (!started) return
            state = NearbyState.ERROR
            reason = why
            publish()
        }
    }

    private fun publish() {
        val snapshot = snapshot()
        handler.post { listeners.forEach { it(snapshot) } }
    }

    // ── Network watching ─────────────────────────────────────────────────────────

    private val networkChanged = Runnable {
        val ctx = appContext ?: return@Runnable
        synchronized(this) {
            if (!started) return@Runnable
            if (hasUsableNetwork(ctx)) {
                SetuDiscoveryManager.get(ctx).restartForNetworkChange()
            }
        }
        reconcile()
    }

    private fun registerNetworkCallback(ctx: Context) {
        if (networkCallback != null) return
        val manager = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET)
            .build()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                localNetworks.add(network)
                debounceNetworkChange()
            }

            override fun onLost(network: Network) {
                localNetworks.remove(network)
                debounceNetworkChange()
            }

            override fun onLinkPropertiesChanged(network: Network, linkProperties: android.net.LinkProperties) {
                localNetworks.add(network)
                debounceNetworkChange()
            }
        }
        manager.registerNetworkCallback(request, callback)
        networkCallback = callback
    }

    private fun unregisterNetworkCallback() {
        val ctx = appContext ?: return
        val callback = networkCallback ?: return
        networkCallback = null
        localNetworks.clear()
        try {
            (ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(callback)
        } catch (_: IllegalArgumentException) {
        }
        handler.removeCallbacks(networkChanged)
    }

    private fun debounceNetworkChange() {
        handler.removeCallbacks(networkChanged)
        handler.postDelayed(networkChanged, NETWORK_DEBOUNCE_MS)
    }

    /**
     * A local network exists when Wi-Fi or Ethernet is connected, or when this phone is itself the
     * access point (hotspot or USB tethering), which Android does not expose as a connected Network.
     */
    private fun hasUsableNetwork(context: Context): Boolean {
        // Wi-Fi/Ethernet networks come from the registered callback above. Being the access point
        // (hotspot or USB tethering) is not reported as a Network at all, so the interfaces are
        // inspected as well: two phones on a hotspot must still find each other.
        if (localNetworks.isNotEmpty()) return true
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val active = manager.activeNetwork?.let(manager::getNetworkCapabilities)
        if (active != null &&
            (active.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || active.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))
        ) {
            return true
        }
        return hasLocalAccessPointInterface()
    }

    private fun hasLocalAccessPointInterface(): Boolean = try {
        NetworkInterface.getNetworkInterfaces().asSequence().any { iface ->
            iface.isUp && !iface.isLoopback && iface.supportsMulticast() &&
                AP_INTERFACE.matches(iface.name) &&
                iface.inetAddresses.asSequence().any { it is Inet4Address && it.isSiteLocalAddress }
        }
    } catch (_: Exception) {
        false
    }

    private const val NETWORK_DEBOUNCE_MS = 600L
    private val AP_INTERFACE = Regex("^(ap|swlan|wlan|eth|rndis|usb)\\d*$")
}
