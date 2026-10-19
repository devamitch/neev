package expo.modules.setunative.nearby

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.setunative.security.CryptoIdentityManager
import expo.modules.setunative.shared.SetuLog
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Wi-Fi Direct discovery and group formation: the way two phones reach each other when they share
 * no network at all.
 *
 * It deliberately mirrors [DiscoveryManager] rather than competing with it. The same identity is
 * advertised in a Bonjour (DNS-SD) record over Wi-Fi Direct, peers arrive through the same
 * [DiscoveryCallback], and once a group is formed the existing TLS transport dials the group owner
 * on the port from that record. There is one transport architecture; this only supplies the link.
 *
 * Discovery alone forms no group and costs the user nothing: a peer seen here is identified, never
 * connected, and never trusted.
 */
internal class WifiDirectManager(context: Context) {
    private val appContext = context.applicationContext
    private val handler = Handler(Looper.getMainLooper())
    private val callbacks = CopyOnWriteArrayList<DiscoveryCallback>()

    /** By device id: what the DNS-SD record said, plus the p2p MAC needed to invite it. */
    private val found = ConcurrentHashMap<String, DiscoveredPeer>()

    private var manager: WifiP2pManager? = null
    private var channel: WifiP2pManager.Channel? = null
    private var receiver: BroadcastReceiver? = null
    private var serviceRequest: WifiP2pDnsSdServiceRequest? = null
    private var started = false
    private var advertising = false
    private var deviceName: String = "Setu device"
    private var serverPort = 0

    /** null until Android has told us; unknown is not the same as off. */
    @Volatile
    private var p2pEnabled: Boolean? = null

    @Volatile
    private var pendingConnect: PendingConnect? = null

    private data class PendingConnect(
        val peerId: String,
        val deviceAddress: String,
        val onResult: (WifiDirectLink?, String?) -> Unit,
    )

    fun addCallback(callback: DiscoveryCallback) {
        callbacks.addIfAbsent(callback)
    }

    fun removeCallback(callback: DiscoveryCallback) {
        callbacks.remove(callback)
    }

    fun isSupported(): Boolean =
        appContext.packageManager.hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT)

    fun isEnabled(): Boolean = p2pEnabled == true

    fun peers(): List<DiscoveredPeer> = found.values.toList()

    /**
     * Starts advertising this phone and looking for others over Wi-Fi Direct. [port] is the port the
     * TLS transport is already listening on, carried in the record so a peer can dial it the moment
     * a group exists.
     */
    @Synchronized
    fun start(name: String, port: Int): String {
        if (!isSupported()) return "UNSUPPORTED"
        if (!hasNearbyPermission()) return "PERMISSION_MISSING"
        if (name.isNotBlank()) deviceName = name.take(DiscoveryConstants.MAX_DEVICE_NAME_LENGTH)
        serverPort = port

        val p2p = manager ?: (appContext.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager)
        if (p2p == null) return "UNSUPPORTED"
        manager = p2p
        if (channel == null) {
            channel = p2p.initialize(appContext, Looper.getMainLooper()) {
                SetuLog.w(SetuLog.NEARBY, "wifi direct channel disconnected")
                synchronized(this) {
                    channel = null
                    advertising = false
                }
            } ?: return "UNAVAILABLE"
        }
        if (!started) {
            started = true
            registerReceiver()
        }
        handler.post { reconcile() }
        SetuLog.i(SetuLog.NEARBY, "wifi direct starting on port $serverPort")
        return "READY"
    }

    @Synchronized
    fun stop() {
        if (!started) return
        started = false
        val p2p = manager
        val ch = channel
        if (p2p != null && ch != null) {
            serviceRequest?.let { request ->
                runCatching { p2p.removeServiceRequest(ch, request, null) }
            }
            runCatching { p2p.stopPeerDiscovery(ch, null) }
            if (advertising) runCatching { p2p.clearLocalServices(ch, null) }
        }
        serviceRequest = null
        advertising = false
        unregisterReceiver()
        val gone = found.values.toList()
        found.clear()
        gone.forEach { peer -> callbacks.forEach { it.onPeerLost(peer.id, peer.serviceName) } }
        SetuLog.i(SetuLog.NEARBY, "wifi direct stopped")
    }

    /**
     * Invites [peerId] to form a group. Android shows its own invitation on the other phone; this
     * never connects silently. [onResult] receives the link to dial once the group is formed, or a
     * reason it did not form.
     */
    @SuppressLint("MissingPermission")
    @Synchronized
    fun connect(peerId: String, onResult: (WifiDirectLink?, String?) -> Unit) {
        val p2p = manager
        val ch = channel
        if (p2p == null || ch == null) {
            onResult(null, "WIFI_DIRECT_UNAVAILABLE")
            return
        }
        if (!hasNearbyPermission()) {
            onResult(null, "PERMISSION_MISSING")
            return
        }
        val peer = found[peerId]
        val address = peer?.p2pAddress
        if (peer == null || address.isNullOrBlank()) {
            onResult(null, "PEER_NOT_FOUND")
            return
        }
        pendingConnect = PendingConnect(peerId, address, onResult)
        val config = WifiP2pConfig().apply {
            deviceAddress = address
            // Let Android pick the group owner: forcing it breaks invitations on several OEMs.
            groupOwnerIntent = 0
        }
        runCatching {
            p2p.connect(ch, config, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    SetuLog.i(SetuLog.NEARBY, "wifi direct invitation sent to ${SetuLog.id(peerId)}")
                }

                override fun onFailure(reason: Int) {
                    finishConnect(null, "WIFI_DIRECT_INVITE_FAILED_$reason")
                }
            })
        }.onFailure { finishConnect(null, "WIFI_DIRECT_INVITE_REFUSED") }

        handler.postDelayed({
            if (pendingConnect?.peerId == peerId) finishConnect(null, "WIFI_DIRECT_TIMEOUT")
        }, CONNECT_TIMEOUT_MS)
    }

    /** Leaves the current group. The user asked to disconnect, or the session ended. */
    @Synchronized
    fun disconnect() {
        val p2p = manager ?: return
        val ch = channel ?: return
        runCatching { p2p.removeGroup(ch, null) }
    }

    // ── Advertising and discovery ────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private fun reconcile() {
        val p2p = manager ?: return
        val ch = channel ?: return
        // Unknown state is worth attempting: the framework reports the real reason, which is
        // better than silently doing nothing because no broadcast has arrived yet.
        if (!started || p2pEnabled == false || !hasNearbyPermission()) return

        if (!advertising && serverPort > 0) {
            val identity = runCatching { CryptoIdentityManager.getOrCreate() }.getOrNull()
            if (identity == null) {
                SetuLog.e(SetuLog.NEARBY, "identity unavailable, cannot advertise over wifi direct")
                return
            }
            val record = mapOf(
                DiscoveryConstants.ATTRIBUTE_DEVICE_ID to identity.deviceId,
                DiscoveryConstants.ATTRIBUTE_DEVICE_NAME to deviceName,
                DiscoveryConstants.ATTRIBUTE_PUBLIC_KEY to identity.publicKeyB64,
                ATTRIBUTE_PORT to serverPort.toString(),
            )
            val info = WifiP2pDnsSdServiceInfo.newInstance(
                "${DiscoveryConstants.SERVICE_NAME_PREFIX}${identity.deviceId}",
                "${DiscoveryConstants.SERVICE_TYPE}.local.",
                record,
            )
            runCatching {
                p2p.addLocalService(ch, info, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() {
                        advertising = true
                        SetuLog.i(SetuLog.NEARBY, "wifi direct advertising on port $serverPort")
                    }

                    override fun onFailure(reason: Int) {
                        SetuLog.w(SetuLog.NEARBY, "wifi direct advertise failed reason=$reason")
                    }
                })
            }
        }

        if (serviceRequest == null) {
            p2p.setDnsSdResponseListeners(ch, servicePresent, txtRecordAvailable)
            val request = WifiP2pDnsSdServiceRequest.newInstance(DiscoveryConstants.SERVICE_TYPE)
            serviceRequest = request
            runCatching {
                p2p.addServiceRequest(ch, request, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() = discoverServices()

                    override fun onFailure(reason: Int) {
                        serviceRequest = null
                        SetuLog.w(SetuLog.NEARBY, "wifi direct service request failed reason=$reason")
                    }
                })
            }
        } else {
            discoverServices()
        }
    }

    @SuppressLint("MissingPermission")
    private fun discoverServices() {
        val p2p = manager ?: return
        val ch = channel ?: return
        runCatching {
            p2p.discoverServices(ch, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    SetuLog.i(SetuLog.NEARBY, "wifi direct discovery running")
                }

                override fun onFailure(reason: Int) {
                    SetuLog.w(SetuLog.NEARBY, "wifi direct discovery failed reason=$reason")
                }
            })
        }
    }

    /** The instance name tells us which device answered; the TXT record carries who it is. */
    private val servicePresent = WifiP2pManager.DnsSdServiceResponseListener { instanceName, registrationType, _ ->
        SetuLog.i(SetuLog.NEARBY, "wifi direct service $instanceName ($registrationType)")
    }

    private val txtRecordAvailable =
        WifiP2pManager.DnsSdTxtRecordListener { _, record, device -> onRecord(record, device) }

    private fun onRecord(record: Map<String, String>, device: WifiP2pDevice) {
        val deviceId = record[DiscoveryConstants.ATTRIBUTE_DEVICE_ID]?.takeIf { it.isNotBlank() } ?: return
        val publicKey = record[DiscoveryConstants.ATTRIBUTE_PUBLIC_KEY]?.takeIf { it.isNotBlank() } ?: return
        val port = record[ATTRIBUTE_PORT]?.toIntOrNull()?.takeIf { it in 1..65535 } ?: return
        if (deviceId == runCatching { CryptoIdentityManager.getOrCreate().deviceId }.getOrNull()) return
        // The advertised id must be the hash of the advertised key, exactly as on the LAN path:
        // discovery is identification, and an inconsistent record is not identified at all.
        if (!identityMatches(deviceId, publicKey)) {
            SetuLog.w(SetuLog.NEARBY, "wifi direct record rejected: id does not match key")
            return
        }
        if (found.size >= DiscoveryConstants.MAX_TRACKED_PEERS && !found.containsKey(deviceId)) return

        val peer = DiscoveredPeer(
            id = deviceId,
            name = record[DiscoveryConstants.ATTRIBUTE_DEVICE_NAME]?.takeIf { it.isNotBlank() }
                ?: "Nearby device",
            // No address until a group exists; the connect step supplies it.
            host = "",
            port = port,
            serviceName = "${DiscoveryConstants.SERVICE_NAME_PREFIX}$deviceId",
            publicKey = publicKey,
            transport = PeerTransportKind.WIFI_DIRECT,
            p2pAddress = device.deviceAddress,
        )
        val previous = found.put(deviceId, peer)
        if (previous != peer) {
            SetuLog.i(SetuLog.NEARBY, "wifi direct peer ${SetuLog.id(deviceId)}")
            callbacks.forEach { it.onPeerDiscovered(peer) }
        }
    }

    private fun identityMatches(deviceId: String, publicKeyB64: String): Boolean = runCatching {
        val key = android.util.Base64.decode(publicKeyB64, android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP)
        val digest = java.security.MessageDigest.getInstance("SHA-256").digest(key).copyOfRange(0, 16)
        digest.joinToString("") { "%02x".format(it) } == deviceId
    }.getOrDefault(false)

    // ── Group lifecycle ──────────────────────────────────────────────────────────

    private fun onConnectionInfo(info: WifiP2pInfo) {
        if (!info.groupFormed) {
            finishConnect(null, "WIFI_DIRECT_GROUP_LOST")
            return
        }
        val pending = pendingConnect ?: return
        val peer = found[pending.peerId]
        val ownerAddress = info.groupOwnerAddress?.hostAddress
        if (peer == null) {
            finishConnect(null, "PEER_NOT_FOUND")
            return
        }
        if (info.isGroupOwner) {
            // This phone owns the group, so it has no address to dial: the other side connects to
            // the TLS server that is already listening. The session arrives as onPeerAuthenticated.
            finishConnect(WifiDirectLink(peer.id, null, peer.port, true), null)
            return
        }
        if (ownerAddress.isNullOrBlank()) {
            finishConnect(null, "WIFI_DIRECT_NO_ADDRESS")
            return
        }
        finishConnect(WifiDirectLink(peer.id, ownerAddress, peer.port, false), null)
    }

    private fun finishConnect(link: WifiDirectLink?, error: String?) {
        val pending = synchronized(this) {
            pendingConnect.also { pendingConnect = null }
        } ?: return
        if (error != null) SetuLog.w(SetuLog.NEARBY, "wifi direct connect failed: $error")
        pending.onResult(link, error)
    }

    // ── System state ─────────────────────────────────────────────────────────────

    private fun registerReceiver() {
        if (receiver != null) return
        val filter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
        }
        val next = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                        p2pEnabled = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1) ==
                            WifiP2pManager.WIFI_P2P_STATE_ENABLED
                        if (p2pEnabled == true) handler.post { reconcile() }
                    }

                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        val info = if (Build.VERSION.SDK_INT >= 33) {
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_INFO, WifiP2pInfo::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_INFO)
                        }
                        if (info != null) onConnectionInfo(info)
                    }
                }
            }
        }
        // WIFI_P2P_STATE_CHANGED is sticky, so registering returns the current state. Waiting for
        // a fresh broadcast that may never come is what kept Wi-Fi Direct silently switched off.
        val sticky = if (Build.VERSION.SDK_INT >= 33) {
            appContext.registerReceiver(next, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            appContext.registerReceiver(next, filter)
        }
        receiver = next
        val state = sticky?.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1) ?: -1
        if (state != -1) p2pEnabled = state == WifiP2pManager.WIFI_P2P_STATE_ENABLED
        SetuLog.i(SetuLog.NEARBY, "wifi direct state=${p2pEnabled ?: "unknown"}")
    }

    private fun unregisterReceiver() {
        val current = receiver ?: return
        receiver = null
        runCatching { appContext.unregisterReceiver(current) }
    }

    private fun hasNearbyPermission(): Boolean {
        val permission = if (Build.VERSION.SDK_INT >= 33) {
            android.Manifest.permission.NEARBY_WIFI_DEVICES
        } else {
            android.Manifest.permission.ACCESS_FINE_LOCATION
        }
        return appContext.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    }

    private companion object {
        const val ATTRIBUTE_PORT = "port"
        const val CONNECT_TIMEOUT_MS = 30_000L
    }
}

/** Where a peer was found. The session, the trust and the transfer are identical either way. */
enum class PeerTransportKind { LAN, WIFI_DIRECT }

/**
 * A formed Wi-Fi Direct group, from this phone's point of view. [host] is null when this phone is
 * the group owner: there is nothing to dial, the other side connects instead.
 */
data class WifiDirectLink(
    val peerId: String,
    val host: String?,
    val port: Int,
    val isGroupOwner: Boolean,
)
