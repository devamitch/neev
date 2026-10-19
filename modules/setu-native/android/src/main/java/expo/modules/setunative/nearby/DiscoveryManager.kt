package expo.modules.setunative.nearby

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.HandlerThread
import expo.modules.setunative.security.CryptoIdentityManager
import expo.modules.setunative.shared.SetuLog
import java.util.concurrent.CopyOnWriteArrayList

/**
 * mDNS advertising and discovery for nearby devices. All state is confined to one handler thread:
 * - one NSD registration and one discovery session at a time (idempotent start/stop),
 * - the multicast lock is held only while discovering and always released,
 * - found services are resolved one by one ([DiscoveryResolver]),
 * - registration/discovery failures retry with bounded backoff instead of dying silently,
 * - [restartForNetworkChange] re-registers everything after Wi-Fi changes.
 */
internal class DiscoveryManager(context: Context) {
    private val appContext = context.applicationContext
    private val thread = HandlerThread("Setu-Nsd").apply { start() }
    private val handler = Handler(thread.looper)
    private val callbacks = CopyOnWriteArrayList<DiscoveryCallback>()
    private val peers = LinkedHashMap<String, DiscoveredPeer>() // by serviceName

    private val nsd: NsdManager by lazy { appContext.getSystemService(Context.NSD_SERVICE) as NsdManager }

    private var deviceName: String? = null
    private var serverPort = 0
    private var wantAdvertising = false
    private var wantDiscovery = false
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var registered = false
    private var registerAttempts = 0
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var discoveryAttempts = 0
    private var resolver: DiscoveryResolver? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var ownService: String? = null
    private var ownDeviceId: String? = null
    private var ownPublicKey: String? = null
    @Volatile
    private var publishedPairCode: String? = null

    fun addCallback(callback: DiscoveryCallback) {
        callbacks.addIfAbsent(callback)
    }

    fun removeCallback(callback: DiscoveryCallback) {
        callbacks.remove(callback)
    }

    fun snapshotPeers(): List<DiscoveredPeer> = synchronized(peers) { peers.values.toList() }

    val isAdvertising: Boolean get() = registered
    val isDiscovering: Boolean get() = discoveryListener != null

    fun startAdvertising(name: String, port: Int) {
        handler.post {
            val changed = deviceName != name || serverPort != port
            deviceName = name
            serverPort = port
            wantAdvertising = true
            registerAttempts = 0
            // The name and port live in the registration itself, so a rename or a new port only
            // reaches nearby devices if the existing registration is replaced. Without this a
            // renamed device keeps advertising its old name until the network changes.
            if (changed && registrationListener != null) unregisterService(reregister = true)
            else registerService()
        }
    }

    fun stopAdvertising() {
        handler.post {
            wantAdvertising = false
            unregisterService(reregister = false)
        }
    }

    fun startDiscovery() {
        handler.post {
            wantDiscovery = true
            discoveryAttempts = 0
            beginDiscovery()
        }
    }

    /**
     * Pauses scanning. Deliberately stopping a scan is not evidence that anyone walked away, so no
     * peer-lost callback is raised and the cache is kept: the app keeps showing who it last saw.
     *
     * Raising "lost" here is what made a peer vanish the moment the user tapped it — leaving Radar
     * unfocused the screen, which stopped the scan, which deleted the very peer being opened, and
     * the connect screen could only say the device was no longer nearby.
     */
    fun stopDiscovery() {
        handler.post {
            wantDiscovery = false
            endDiscovery(clearPeers = false)
        }
    }

    /** The Wi-Fi network changed: drop everything tied to the old network and start again on the new one. */
    fun restartForNetworkChange() {
        handler.post {
            SetuLog.i(SetuLog.NEARBY, "network changed: re-registering and re-discovering")
            endDiscovery(clearPeers = true)
            unregisterService(reregister = false)
            handler.postDelayed({
                if (wantAdvertising) {
                    registerAttempts = 0
                    registerService()
                }
                if (wantDiscovery) {
                    discoveryAttempts = 0
                    beginDiscovery()
                }
            }, RESTART_DELAY_MS)
        }
    }

    /** Advertise (or stop advertising) a six-digit pairing code in the TXT record. */
    fun publishPairCode(code: String?) {
        handler.post {
            publishedPairCode = code?.takeIf { it.matches(Regex("^\\d{6}$")) }
            if (wantAdvertising) {
                registerAttempts = 0
                unregisterService(reregister = true)
            }
        }
    }

    fun findPeerByPairCode(code: String): DiscoveredPeer? =
        snapshotPeers().firstOrNull { it.pairCode != null && it.pairCode == code.trim() }

    fun shutdown() {
        handler.post {
            wantAdvertising = false
            wantDiscovery = false
            endDiscovery(clearPeers = true)
            unregisterService(reregister = false)
            thread.quitSafely()
        }
    }

    // ── Advertising ──────────────────────────────────────────────────────────────

    private fun registerService() {
        if (!wantAdvertising || registrationListener != null) return
        val name = deviceName ?: return
        val port = serverPort.takeIf { it > 0 } ?: return
        val identity = try {
            CryptoIdentityManager.getOrCreate()
        } catch (error: Exception) {
            SetuLog.e(SetuLog.NEARBY, "identity unavailable, cannot advertise", error)
            notifyFailed(NsdManager.FAILURE_INTERNAL_ERROR)
            return
        }
        ownDeviceId = identity.deviceId
        ownPublicKey = identity.publicKeyB64
        val info = NsdServiceInfo().apply {
            serviceName = "${DiscoveryConstants.SERVICE_NAME_PREFIX}${identity.deviceId}"
            serviceType = DiscoveryConstants.SERVICE_TYPE
            this.port = port
            setAttribute(DiscoveryConstants.ATTRIBUTE_DEVICE_ID, identity.deviceId)
            setAttribute(DiscoveryConstants.ATTRIBUTE_DEVICE_NAME, name.take(DiscoveryConstants.MAX_DEVICE_NAME_LENGTH))
            setAttribute(DiscoveryConstants.ATTRIBUTE_PUBLIC_KEY, identity.publicKeyB64)
            publishedPairCode?.let { setAttribute(DiscoveryConstants.ATTRIBUTE_PAIR_CODE, it) }
        }
        ownService = info.serviceName
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(registeredInfo: NsdServiceInfo) {
                handler.post {
                    if (registrationListener !== this) return@post
                    registered = true
                    registerAttempts = 0
                    ownService = registeredInfo.serviceName
                    SetuLog.i(SetuLog.NEARBY, "advertising as ${SetuLog.id(identity.deviceId)} on port $port")
                }
            }

            override fun onRegistrationFailed(failed: NsdServiceInfo, errorCode: Int) {
                handler.post {
                    if (registrationListener !== this) return@post
                    registrationListener = null
                    registered = false
                    retryRegistration(errorCode)
                }
            }

            override fun onServiceUnregistered(unregistered: NsdServiceInfo) {
                handler.post { if (registrationListener === this) onUnregistered() }
            }

            override fun onUnregistrationFailed(failed: NsdServiceInfo, errorCode: Int) {
                handler.post { if (registrationListener === this) onUnregistered() }
            }
        }
        registrationListener = listener
        try {
            nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (error: Exception) {
            registrationListener = null
            SetuLog.w(SetuLog.NEARBY, "registerService threw ${error.javaClass.simpleName}")
            retryRegistration(NsdManager.FAILURE_INTERNAL_ERROR)
        }
    }

    private var reregisterAfterUnregister = false

    private fun unregisterService(reregister: Boolean) {
        val listener = registrationListener
        if (listener == null) {
            registered = false
            if (reregister) registerService()
            return
        }
        reregisterAfterUnregister = reregister
        try {
            nsd.unregisterService(listener)
        } catch (_: IllegalArgumentException) {
            onUnregistered()
        }
    }

    private fun onUnregistered() {
        registrationListener = null
        registered = false
        val again = reregisterAfterUnregister
        reregisterAfterUnregister = false
        if (again && wantAdvertising) registerService()
    }

    private fun retryRegistration(errorCode: Int) {
        if (!wantAdvertising) return
        registerAttempts++
        if (registerAttempts > DiscoveryConstants.MAX_REGISTER_ATTEMPTS) {
            SetuLog.e(SetuLog.NEARBY, "advertising failed code=$errorCode after $registerAttempts attempts")
            notifyFailed(errorCode)
            return
        }
        val delay = (1_000L shl (registerAttempts - 1)).coerceAtMost(MAX_BACKOFF_MS)
        SetuLog.w(SetuLog.NEARBY, "advertising failed code=$errorCode, retry in ${delay}ms")
        handler.postDelayed({ registerService() }, delay)
    }

    // ── Discovery ────────────────────────────────────────────────────────────────

    private fun beginDiscovery() {
        if (!wantDiscovery || discoveryListener != null) return
        acquireMulticastLock()
        val ownId = try {
            CryptoIdentityManager.getOrCreate().also {
                ownDeviceId = it.deviceId
                ownPublicKey = it.publicKeyB64
            }.deviceId
        } catch (error: Exception) {
            SetuLog.e(SetuLog.NEARBY, "identity unavailable, cannot discover", error)
            releaseMulticastLock()
            notifyFailed(NsdManager.FAILURE_INTERNAL_ERROR)
            return
        }
        val newResolver = DiscoveryResolver(nsd, handler, { ownDeviceId }) { peer -> onPeerResolved(peer) }
        resolver = newResolver
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {
                SetuLog.i(SetuLog.NEARBY, "discovery started, self id=${SetuLog.id(ownId)}")
            }

            override fun onServiceFound(info: NsdServiceInfo) {
                handler.post {
                    if (discoveryListener !== this) return@post
                    if (info.serviceName.startsWith(DiscoveryConstants.SERVICE_NAME_PREFIX) && info.serviceName != ownService) {
                        newResolver.enqueue(info)
                    }
                }
            }

            override fun onServiceLost(info: NsdServiceInfo) {
                handler.post { if (discoveryListener === this) onServiceGone(info.serviceName) }
            }

            override fun onDiscoveryStopped(serviceType: String) {
                SetuLog.i(SetuLog.NEARBY, "discovery stopped")
            }

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                handler.post {
                    if (discoveryListener !== this) return@post
                    discoveryListener = null
                    releaseMulticastLock()
                    retryDiscovery(errorCode)
                }
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                SetuLog.w(SetuLog.NEARBY, "stop discovery failed code=$errorCode")
            }
        }
        discoveryListener = listener
        try {
            nsd.discoverServices(DiscoveryConstants.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (error: Exception) {
            discoveryListener = null
            releaseMulticastLock()
            SetuLog.w(SetuLog.NEARBY, "discoverServices threw ${error.javaClass.simpleName}")
            retryDiscovery(NsdManager.FAILURE_INTERNAL_ERROR)
        }
    }

    private fun endDiscovery(clearPeers: Boolean) {
        resolver?.close()
        resolver = null
        val listener = discoveryListener
        discoveryListener = null
        if (listener != null) {
            try {
                nsd.stopServiceDiscovery(listener)
            } catch (_: IllegalArgumentException) {
            }
        }
        releaseMulticastLock()
        if (clearPeers) {
            val gone = synchronized(peers) { peers.values.toList().also { peers.clear() } }
            gone.forEach { peer -> callbacks.forEach { it.onPeerLost(peer.id, peer.serviceName) } }
        }
    }

    private fun retryDiscovery(errorCode: Int) {
        if (!wantDiscovery) return
        discoveryAttempts++
        if (discoveryAttempts > DiscoveryConstants.MAX_REGISTER_ATTEMPTS) {
            SetuLog.e(SetuLog.NEARBY, "discovery failed code=$errorCode after $discoveryAttempts attempts")
            notifyFailed(errorCode)
            return
        }
        val delay = (1_000L shl (discoveryAttempts - 1)).coerceAtMost(MAX_BACKOFF_MS)
        SetuLog.w(SetuLog.NEARBY, "discovery failed code=$errorCode, retry in ${delay}ms")
        handler.postDelayed({ beginDiscovery() }, delay)
    }

    private fun onPeerResolved(peer: DiscoveredPeer) {
        val previous = synchronized(peers) {
            if (peers.size >= DiscoveryConstants.MAX_TRACKED_PEERS && !peers.containsKey(peer.serviceName)) return
            peers.put(peer.serviceName, peer)
        }
        if (previous == peer) return
        SetuLog.i(SetuLog.NEARBY, "found id=${SetuLog.id(peer.id)} name=${peer.name}")
        callbacks.forEach { it.onPeerDiscovered(peer) }
    }

    private fun onServiceGone(serviceName: String) {
        val peer = synchronized(peers) { peers.remove(serviceName) } ?: return
        SetuLog.i(SetuLog.NEARBY, "lost id=${SetuLog.id(peer.id)}")
        callbacks.forEach { it.onPeerLost(peer.id, serviceName) }
    }

    private fun notifyFailed(errorCode: Int) {
        callbacks.forEach { it.onDiscoveryFailed(errorCode) }
    }

    // ── Multicast lock ───────────────────────────────────────────────────────────

    private fun acquireMulticastLock() {
        if (multicastLock?.isHeld == true) return
        val wifi = appContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
        multicastLock = wifi.createMulticastLock("Setu-Nsd").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseMulticastLock() {
        multicastLock?.let { if (it.isHeld) it.release() }
        multicastLock = null
    }

    private companion object {
        const val RESTART_DELAY_MS = 500L
        const val MAX_BACKOFF_MS = 30_000L
    }
}
