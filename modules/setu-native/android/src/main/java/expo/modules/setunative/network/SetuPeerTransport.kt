package expo.modules.setunative.network

object SetuPeerTransport {
    private val applicationFrameHandlers = java.util.concurrent.ConcurrentHashMap<String, (PeerSession, Int, ByteArray) -> Unit>()

    private val frameDispatcher: (PeerSession, Int, ByteArray) -> Unit = { session, type, payload ->
        if (payload.size + PeerTransportConstants.APPLICATION_FRAME_HEADER_BYTES <=
            PeerTransportConstants.MAX_APPLICATION_FRAME_BYTES) {
            applicationFrameHandlers.values.forEach { handler ->
                try {
                    handler(session, type, payload)
                } catch (error: Exception) {
                    android.util.Log.w("SETU_TRANSPORT", "Frame handler rejected type $type", error)
                }
            }
        }
    }

    @Volatile
    private var manager: PeerTransportSession? = null

    @Volatile
    private var sessionClosedHandler: ((PeerSession) -> Unit)? = null

    /** Kept here so a manager built by [connect] before the server starts is not missing it. */
    @Volatile
    private var peerAuthenticatedHandler: ((PeerSession) -> Unit)? = null

    /**
     * One manager per process. Both entry points went through an unsynchronized `if (manager ==
     * null)`, so a connect racing a server start could build a second manager and orphan the first
     * — its sessions stayed open but no longer resolved by sessionId, so authorizing or sending on
     * them failed with SESSION_NOT_FOUND.
     */
    @Synchronized
    private fun ensureManager(): PeerTransportSession =
        manager ?: PeerTransportSession(
            onPeerAuthenticated = peerAuthenticatedHandler,
            onSessionClosed = sessionClosedHandler,
            onApplicationFrame = frameDispatcher
        ).also { manager = it }

    @Synchronized
    fun startServer(onAuthenticated: (PeerSession) -> Unit): Int {
        peerAuthenticatedHandler = onAuthenticated
        val session = ensureManager()
        session.setPeerAuthenticatedHandler(onAuthenticated)
        return session.startServer()
    }

    /**
     * The outbound half deliberately does not raise `onPeerAuthenticated`: the caller already has
     * the session as this function's result, and raising it too would prompt the initiator to
     * confirm its own connection. The event is for connections this device did not start.
     */
    fun connect(
        expectedPeerId: String?,
        expectedPublicKey: String?,
        host: String,
        port: Int,
    ): PeerSession = ensureManager().connect(expectedPeerId, expectedPublicKey, host, port)

    @Synchronized
    fun stopServer() {
        manager?.stopServer()
        manager = null
        peerAuthenticatedHandler = null
    }

    fun closeSession(sessionId: String): Boolean {
        return manager?.closeSession(sessionId) ?: false
    }

    /** Kept here as well, so a handler set before the server exists is not lost. */
    fun setSessionClosedHandler(handler: ((PeerSession) -> Unit)?) {
        sessionClosedHandler = handler
        manager?.setSessionClosedHandler(handler)
    }

    fun authorizeSession(sessionId: String): Boolean {
        return manager?.authorizeSession(sessionId) ?: false
    }

    fun isSessionAuthorized(sessionId: String): Boolean {
        return manager?.isSessionAuthorized(sessionId) ?: false
    }

    fun peerIdForSession(sessionId: String): String? {
        return manager?.peerIdForSession(sessionId)
    }

    fun sessionIdForPeer(peerId: String): String? = manager?.sessionIdForPeer(peerId)

    fun authorizedSessionIds(): List<String> = manager?.authorizedSessionIds() ?: emptyList()

    fun setApplicationFrameHandler(handler: ((PeerSession, Int, ByteArray) -> Unit)?) {
        registerApplicationFrameHandler("legacy", handler)
    }

    fun registerApplicationFrameHandler(owner: String, handler: ((PeerSession, Int, ByteArray) -> Unit)?) {
        require(owner in setOf("legacy", "file-transfer", "swarm", "messaging", "shared-space")) { "INVALID_FRAME_HANDLER" }
        if (handler == null) applicationFrameHandlers.remove(owner)
        else applicationFrameHandlers[owner] = handler
        manager?.setApplicationFrameHandler(frameDispatcher.takeIf { applicationFrameHandlers.isNotEmpty() })
    }

    fun unregisterApplicationFrameHandler(owner: String) {
        registerApplicationFrameHandler(owner, null)
    }

    fun sendFrame(sessionId: String, type: Int, payload: ByteArray) {
        manager?.sendFrame(sessionId, type, payload)
    }

    // Legacy constants for backwards compatibility
    const val MAX_APPLICATION_FRAME_BYTES = PeerTransportConstants.MAX_APPLICATION_FRAME_BYTES
    const val APPLICATION_FRAME_MAGIC = PeerTransportConstants.APPLICATION_FRAME_MAGIC
    const val APPLICATION_FRAME_VERSION = PeerTransportConstants.APPLICATION_FRAME_VERSION
    const val APPLICATION_FRAME_HEADER_BYTES = PeerTransportConstants.APPLICATION_FRAME_HEADER_BYTES
    const val FRAME_PING = PeerTransportConstants.FRAME_PING
    const val FRAME_PONG = PeerTransportConstants.FRAME_PONG
    const val FRAME_GOODBYE = PeerTransportConstants.FRAME_GOODBYE
    const val FRAME_TRANSFER_OFFER = PeerTransportConstants.FRAME_TRANSFER_OFFER
    const val FRAME_TRANSFER_ACCEPT = PeerTransportConstants.FRAME_TRANSFER_ACCEPT
    const val FRAME_TRANSFER_REJECT = PeerTransportConstants.FRAME_TRANSFER_REJECT
    const val FRAME_TRANSFER_PIECE = PeerTransportConstants.FRAME_TRANSFER_PIECE
    const val FRAME_TRANSFER_PIECE_ACK = PeerTransportConstants.FRAME_TRANSFER_PIECE_ACK
    const val FRAME_TRANSFER_COMPLETE = PeerTransportConstants.FRAME_TRANSFER_COMPLETE
    const val FRAME_TRANSFER_COMPLETE_ACK = PeerTransportConstants.FRAME_TRANSFER_COMPLETE_ACK
    const val FRAME_TRANSFER_CANCEL = PeerTransportConstants.FRAME_TRANSFER_CANCEL
    const val FRAME_HAVE = PeerTransportConstants.FRAME_HAVE
    const val FRAME_WANT = PeerTransportConstants.FRAME_WANT
    const val FRAME_PROVIDER_MAP = PeerTransportConstants.FRAME_PROVIDER_MAP
    const val FRAME_PIECE_REQUEST = PeerTransportConstants.FRAME_PIECE_REQUEST
    const val FRAME_PIECE_DATA = PeerTransportConstants.FRAME_PIECE_DATA
    const val FRAME_REPLICATION_REQUEST = PeerTransportConstants.FRAME_REPLICATION_REQUEST
    const val FRAME_DEPARTURE_ANNOUNCE = PeerTransportConstants.FRAME_DEPARTURE_ANNOUNCE
    const val FRAME_REPAIR_REQUEST = PeerTransportConstants.FRAME_REPAIR_REQUEST
    const val FRAME_SCHEDULE_UPDATE = PeerTransportConstants.FRAME_SCHEDULE_UPDATE
    const val FRAME_MESSAGE = PeerTransportConstants.FRAME_MESSAGE
    const val FRAME_ACK = PeerTransportConstants.FRAME_ACK
    const val FRAME_EMERGENCY_MESSAGE = PeerTransportConstants.FRAME_EMERGENCY_MESSAGE
    const val FRAME_SHARED_SPACE = PeerTransportConstants.FRAME_SHARED_SPACE
}
