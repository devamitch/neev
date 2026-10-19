package expo.modules.setunative.bootstrap

import android.content.Context
import expo.modules.setunative.content.ContentEvents
import expo.modules.setunative.content.ContentService
import expo.modules.setunative.governor.ResourceGovernor
import expo.modules.setunative.messaging.MessageService
import expo.modules.setunative.messaging.MessagingEvents
import expo.modules.setunative.nearby.NearbyController
import expo.modules.setunative.nearby.NearbySnapshot
import expo.modules.setunative.nearby.RadioController
import expo.modules.setunative.nearby.RadioSnapshot
import expo.modules.setunative.nearby.SetuDiscoveryManager
import expo.modules.setunative.network.PeerSession
import expo.modules.setunative.network.PeerTransportConstants
import expo.modules.setunative.network.SetuFileTransferManager
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.network.TransferEventBridge
import expo.modules.setunative.notifications.SetuNotificationManager
import expo.modules.setunative.models.SetuPeer
import expo.modules.setunative.models.TrustState
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.persistence.PeerRepository
import expo.modules.setunative.persistence.SharedSpaceRepository
import expo.modules.setunative.security.CryptoIdentityManager
import expo.modules.setunative.shared.SetuEvents
import expo.modules.setunative.shared.SetuLog
import expo.modules.setunative.sharedspace.SharedSpaceEvents
import expo.modules.setunative.sharedspace.SharedSpaceService
import expo.modules.setunative.swarm.SetuSwarmEngine
import expo.modules.setunative.swarm.SwarmEvents
import expo.modules.setunative.swarm.SwarmIntegration

/**
 * The single owner of Setu's long-lived native services.
 *
 * Nothing here runs at module load or in Application.onCreate: the Expo modules only expose
 * functions. JS calls [start] once the app state is READY, and the foreground service calls it when
 * it has to run without JS. Every step is idempotent, so lifecycle repeats (module reload, service
 * restart, a second start call) never register a listener, receiver, handler or server twice.
 */
object SetuRuntime {
    private val lock = Any()

    @Volatile
    private var started = false
    private var appContext: Context? = null
    private var messageService: MessageService? = null
    private var spaceService: SharedSpaceService? = null
    private var contentService: ContentService? = null
    private var transferBridge: TransferEventBridge? = null

    private val radioListener: (RadioSnapshot) -> Unit = { snapshot ->
        SetuEvents.emit(SetuEvents.CORE, "onRadioStateChanged", snapshot.toMap())
    }
    private val nearbyListener: (NearbySnapshot) -> Unit = { snapshot ->
        SetuEvents.emit(SetuEvents.CORE, "onNearbyStateChanged", snapshot.toMap())
    }

    fun isStarted(): Boolean = started

    /** Lazily built, process-wide message service; also receives transport frames once built. */
    fun messages(context: Context): MessageService = synchronized(lock) {
        messageService ?: MessageService(context.applicationContext).also {
            it.addListener(MessagingEvents.listener())
            it.start()
            SetuPeerTransport.registerApplicationFrameHandler("messaging", ::handleMessagingFrame)
            messageService = it
            SetuLog.i(SetuLog.BOOT, "message service started")
        }
    }

    fun spaces(context: Context): SharedSpaceService = synchronized(lock) {
        spaceService ?: run {
            val ctx = context.applicationContext
            SharedSpaceService(ctx, SharedSpaceRepository.create(ctx), ContentRepository.create(ctx)).also {
                it.addListener(SharedSpaceEvents.listener())
                it.start()
                SetuPeerTransport.registerApplicationFrameHandler("shared-space", ::handleSharedSpaceFrame)
                spaceService = it
                SetuLog.i(SetuLog.BOOT, "shared-space service started")
            }
        }
    }

    /** Built on first use by the Library; media-change monitoring starts with it. */
    fun content(context: Context): ContentService = synchronized(lock) {
        contentService ?: run {
            val ctx = context.applicationContext
            ContentService(ctx, ContentRepository.create(ctx), ResourceGovernor(ctx)).also {
                it.addListener(ContentEvents.listener())
                it.startMonitoring()
                contentService = it
                SetuLog.i(SetuLog.MEDIA, "content service started")
            }
        }
    }

    fun swarm(context: Context): SetuSwarmEngine = synchronized(lock) {
        val engine = SetuSwarmEngine.getInstance(context.applicationContext)
        engine.initialize(SwarmEvents.listener { engine })
        SwarmIntegration.initialize(engine)
        engine
    }

    /**
     * Writes the peer behind a session into the peer store.
     *
     * Nothing used to do this: `PeerRepository.upsert` had no caller, so the table stayed empty and
     * every part of the engine that asks "is this peer connected?" answered no. HAVE was advertised
     * to an empty list, `canServePiece` refused every peer because the record did not exist, and
     * the swarm could never see a provider. Both halves of a connection land here — the device that
     * dialled and the device that answered.
     *
     * This records identity and reachability only. It is not authorization: the trust state stays
     * AUTHENTICATED until the user confirms the code (see [onPeerAuthorized]).
     */
    fun recordAuthenticatedSession(context: Context, peer: PeerSession) {
        val repository = PeerRepository.create(context.applicationContext)
        val existing = repository.get(peer.peerId)
        val advertised = SetuDiscoveryManager.peekOrNull()?.snapshotPeers()
            ?.firstOrNull { it.id == peer.peerId }
        val base = existing ?: SetuPeer(
            peerId = peer.peerId,
            deviceId = peer.peerId,
            displayName = advertised?.name ?: existing?.displayName ?: "Nearby device",
            deviceModel = null,
            platform = "android",
        )
        repository.upsert(
            base.copy(
                displayName = advertised?.name ?: base.displayName,
                trustState = TrustState.AUTHENTICATED,
                sessionId = peer.sessionId,
                publicKey = peer.publicKey,
                verificationCode = peer.verificationCode,
                endpoint = advertised?.host ?: base.endpoint,
                port = advertised?.port ?: base.port,
                lastSeenAt = System.currentTimeMillis(),
            )
        )
    }

    /** The user confirmed the code. Only now may this peer be served. */
    fun onPeerAuthorized(peerId: String) {
        appContext?.let { ctx ->
            val repository = PeerRepository.create(ctx)
            repository.get(peerId)?.let { peer ->
                if (!peer.isBlocked && peer.trustState != TrustState.BLOCKED) {
                    repository.upsert(peer.copy(trustState = TrustState.CONNECTED))
                }
            }
        }
        // The peer may serve us and we may serve it: both sides need to know what the other holds.
        appContext?.let { ctx ->
            SetuPeerTransport.sessionIdForPeer(peerId)?.let { sessionId ->
                SetuSwarmEngine.getInstance(ctx).advertiseInventoryTo(sessionId)
            }
        }
        val service = spaceService ?: return
        val localId = CryptoIdentityManager.getOrCreate().deviceId
        service.getSpacesByMember(localId)
            .filter { it.isActive && peerId in it.members }
            .forEach { service.syncSpace(it.spaceId, peerId) }
    }

    /**
     * Brings the native side up. [deviceName] is the display name advertised to nearby devices; null
     * keeps the last one (used when the foreground service restarts without JS).
     */
    fun start(context: Context, deviceName: String?): Map<String, Any?> {
        val ctx = context.applicationContext
        synchronized(lock) {
            appContext = ctx
            val name = RuntimePreferences.deviceName(ctx, deviceName)
            if (!started) {
                started = true
                val identity = CryptoIdentityManager.getOrCreate()
                SetuLog.i(SetuLog.BOOT, "runtime starting, identity ${SetuLog.id(identity.deviceId)}")
                SetuNotificationManager.ensureChannels(ctx)
                SetuPeerTransport.setSessionClosedHandler(::onSessionClosed)
                SetuFileTransferManager.initialize(ctx, transferBridge ?: TransferEventBridge(ctx).also { transferBridge = it })
                swarm(ctx)
                messages(ctx)
                spaces(ctx)
                RadioController.addListener(radioListener)
                RadioController.start(ctx)
                NearbyController.addListener(nearbyListener)
                SetuLog.i(SetuLog.BOOT, "runtime ready")
            }
            NearbyController.start(ctx, name) { SetuPeerTransport.startServer(::onPeerAuthenticated) }
        }
        return mapOf(
            "started" to true,
            "deviceId" to CryptoIdentityManager.getOrCreate().deviceId,
            "nearby" to NearbyController.snapshot().toMap(),
            "radio" to RadioController.snapshot(ctx).toMap(),
        )
    }

    /** Stops discovery, listeners and receivers. Used when the identity is reset. */
    fun stop() {
        synchronized(lock) {
            if (!started) return
            started = false
            val ctx = appContext
            NearbyController.stop()
            NearbyController.removeListener(nearbyListener)
            RadioController.removeListener(radioListener)
            RadioController.stop()
            messageService?.stop()
            messageService = null
            spaceService?.stop()
            spaceService = null
            contentService?.stopMonitoring()
            contentService = null
            SwarmIntegration.shutdown()
            if (ctx != null) SetuSwarmEngine.getInstance(ctx).shutdown()
            SetuPeerTransport.unregisterApplicationFrameHandler("messaging")
            SetuPeerTransport.unregisterApplicationFrameHandler("shared-space")
            SetuLog.i(SetuLog.BOOT, "runtime stopped")
        }
    }

    private fun onPeerAuthenticated(peer: PeerSession) {
        SetuLog.i(SetuLog.TRANSPORT, "session authenticated peer=${SetuLog.id(peer.peerId)}")
        appContext?.let { recordAuthenticatedSession(it, peer) }
        SetuEvents.emit(
            SetuEvents.CORE,
            "onPeerAuthenticated",
            mapOf(
                "sessionId" to peer.sessionId,
                "peerId" to peer.peerId,
                "publicKey" to peer.publicKey,
                "verificationCode" to peer.verificationCode,
            ),
        )
    }

    private fun onSessionClosed(peer: PeerSession) {
        SetuLog.i(SetuLog.TRANSPORT, "session closed peer=${SetuLog.id(peer.peerId)}")
        // The peer stays known, but it is no longer reachable: leaving the session id behind would
        // keep it in `getConnected()` and the swarm would keep offering it pieces.
        appContext?.let { ctx ->
            val repository = PeerRepository.create(ctx)
            repository.get(peer.peerId)?.let { stored ->
                if (stored.sessionId == peer.sessionId) {
                    repository.upsert(
                        stored.copy(
                            sessionId = null,
                            verificationCode = null,
                            trustState = if (stored.isBlocked || stored.trustState == TrustState.BLOCKED) {
                                stored.trustState
                            } else {
                                TrustState.DISCONNECTED
                            },
                        )
                    )
                }
            }
        }
        SetuFileTransferManager.onSessionClosed(peer)
        appContext?.let { SetuSwarmEngine.getInstance(it).handlePeerDisconnected(peer.peerId, peer.sessionId) }
        SetuEvents.emit(
            SetuEvents.CORE,
            "onPeerDisconnected",
            mapOf("sessionId" to peer.sessionId, "peerId" to peer.peerId),
        )
    }

    private fun handleMessagingFrame(session: PeerSession, type: Int, payload: ByteArray) {
        if (!SetuPeerTransport.isSessionAuthorized(session.sessionId)) return
        val service = messageService ?: return
        when (type) {
            PeerTransportConstants.FRAME_MESSAGE,
            PeerTransportConstants.FRAME_EMERGENCY_MESSAGE ->
                service.handleIncomingMessage(session.sessionId, session.peerId, payload)
            PeerTransportConstants.FRAME_ACK ->
                service.handleDeliveryAcknowledgment(session.sessionId, session.peerId, payload)
        }
    }

    private fun handleSharedSpaceFrame(session: PeerSession, type: Int, payload: ByteArray) {
        if (type != PeerTransportConstants.FRAME_SHARED_SPACE ||
            !SetuPeerTransport.isSessionAuthorized(session.sessionId)
        ) return
        spaceService?.handleFrame(session.sessionId, session.peerId, payload)
    }
}
