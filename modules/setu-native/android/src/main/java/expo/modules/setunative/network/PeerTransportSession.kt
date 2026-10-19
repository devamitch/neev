package expo.modules.setunative.network

import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLSocket

private data class PendingFrame(val type: Int, val payload: ByteArray)

/** Enough for an opening message and its attachment offer, not enough to be a memory attack. */
private const val MAX_PENDING_FRAMES = 32
private const val MAX_PENDING_FRAME_BYTES = 1 * 1024 * 1024

internal class PeerTransportSession(
    @Volatile private var onPeerAuthenticated: ((PeerSession) -> Unit)?,
    @Volatile private var onSessionClosed: ((PeerSession) -> Unit)?,
    @Volatile private var onApplicationFrame: ((PeerSession, Int, ByteArray) -> Unit)?
) {
    private val sessions = ConcurrentHashMap<String, ActiveSession>()
    private val authorizedSessions = ConcurrentHashMap.newKeySet<String>()

    /*
     * Application frames that arrived before this side authorized the session.
     *
     * Both ends authorize independently, so whichever user taps Connect first can start sending
     * while the other is still looking at the confirmation. Those frames used to be dropped on the
     * floor: the sender saw a healthy connection and a sent message, the receiver got nothing, and
     * the first thing anyone did after pairing silently vanished.
     *
     * They are held instead and replayed in order the moment the session is authorized. The hold is
     * bounded in both count and bytes because an unauthorized peer must never be able to make this
     * device buffer whatever it likes; past the bound the frames really are dropped, and loudly.
     */
    private val pendingFrames = ConcurrentHashMap<String, MutableList<PendingFrame>>()
    private var serverSocket: ServerSocket? = null
    private var handshakeExecutor: ThreadPoolExecutor? = null

    private val sessionExecutor = ThreadPoolExecutor(
        0,
        PeerTransportConstants.MAX_ACTIVE_SESSIONS,
        30L,
        TimeUnit.SECONDS,
        java.util.concurrent.SynchronousQueue(),
    )

    fun startServer(portHint: Int = 0): Int {
        serverSocket?.let { return it.localPort }
        val server = ServerSocket()
        server.reuseAddress = true
        server.bind(InetSocketAddress(portHint), PeerTransportConstants.MAX_PENDING_HANDSHAKES)
        val executor = ThreadPoolExecutor(
            1, 4, 30L, TimeUnit.SECONDS,
            ArrayBlockingQueue(PeerTransportConstants.MAX_PENDING_HANDSHAKES),
        )
        serverSocket = server
        handshakeExecutor = executor
        Thread({ acceptConnections(server, executor) }, "Setu-Peer-Accept").apply {
            isDaemon = true
            start()
        }
        return server.localPort
    }

    /**
     * Opens a session to a peer. [expectedPeerId] and [expectedPublicKey] are null when the user
     * typed the address themselves: the identity is still proven by TLS and by both signatures over
     * the handshake transcript, and the session stays unauthorised until the user confirms the
     * verification code matches on both phones.
     */
    fun connect(
        expectedPeerId: String?,
        expectedPublicKey: String?,
        host: String,
        port: Int,
    ): PeerSession {
        require(expectedPeerId == null || expectedPeerId.matches(Regex("[0-9a-f]{32}"))) {
            "INVALID_PEER_ID"
        }
        require(host.isNotBlank() && host.length <= 64) { "INVALID_PEER_HOST" }
        require(port in 1..65535) { "INVALID_PEER_PORT" }
        val socket = createClientSocket(host, port)
        try {
            socket.connect(InetSocketAddress(host, port), PeerTransportConstants.SOCKET_TIMEOUT_MS)
            socket.startHandshake()
            val session = PeerTransportAuth.authenticate(socket, expectedPeerId, expectedPublicKey, true)
            registerSession(session, socket)
            return session
        } catch (error: Throwable) {
            socket.close()
            throw error
        }
    }

    fun stopServer() {
        try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
        handshakeExecutor?.shutdownNow()
        handshakeExecutor = null
        sessions.values.forEach { closeSession(it.peer.sessionId) }
        authorizedSessions.clear()
        pendingFrames.clear()
        PeerTransportTls.clearCachedTlsContext()
    }

    fun closeSession(sessionId: String): Boolean {
        val session = sessions[sessionId] ?: return false
        return retire(session)
    }

    /**
     * Retires one session, exactly once, and tells the rest of the app it is gone.
     *
     * Every way a session can end comes through here, because the two ways used to differ: an
     * explicit close announced itself, and a session that simply died - heartbeat timeout, socket
     * error, the peer walking out of range, Wi-Fi dropping - did not. Nothing downstream heard
     * about the common case, so the peer kept its session id, kept appearing in `getConnected()`,
     * kept being offered pieces by the scheduler as a provider that could never answer, and the UI
     * went on showing a device that had left.
     *
     * The entry is removed by identity rather than by id, so a session that has already been
     * replaced by a reconnect cannot delete the live one on its way out, and whichever caller
     * actually removes it is the one that notifies.
     */
    private fun retire(session: ActiveSession): Boolean {
        val sessionId = session.peer.sessionId
        if (!sessions.remove(sessionId, session)) return false
        authorizedSessions.remove(sessionId)
        pendingFrames.remove(sessionId)
        try { session.socket.close() } catch (_: Exception) {}
        onSessionClosed?.invoke(session.peer)
        return true
    }

    fun authorizeSession(sessionId: String): Boolean {
        val session = sessions[sessionId] ?: return false
        authorizedSessions.add(sessionId)
        // Everything the peer said while we were deciding, in the order it said it.
        val held = pendingFrames.remove(sessionId) ?: return true
        val handler = onApplicationFrame
        if (handler != null) {
            for (frame in held) handler.invoke(session.peer, frame.type, frame.payload)
        }
        return true
    }

    /**
     * Holds one frame that arrived before authorization. Returns false when the hold is full, which
     * is the point at which an unauthorized peer stops being given the benefit of the doubt.
     */
    internal fun holdUnauthorizedFrame(sessionId: String, type: Int, payload: ByteArray): Boolean {
        if (!sessions.containsKey(sessionId)) return false
        val held = pendingFrames.getOrPut(sessionId) { mutableListOf() }
        synchronized(held) {
            val heldBytes = held.sumOf { it.payload.size }
            if (held.size >= MAX_PENDING_FRAMES ||
                heldBytes + payload.size > MAX_PENDING_FRAME_BYTES
            ) {
                return false
            }
            held.add(PendingFrame(type, payload))
        }
        return true
    }

    fun isSessionAuthorized(sessionId: String): Boolean = authorizedSessions.contains(sessionId)

    fun peerIdForSession(sessionId: String): String? = sessions[sessionId]?.peer?.peerId

    fun sessionIdForPeer(peerId: String): String? = sessions.entries
        .firstOrNull { it.value.peer.peerId == peerId && isSessionAuthorized(it.key) }
        ?.key

    fun authorizedSessionIds(): List<String> = authorizedSessions
        .filter { sessions.containsKey(it) }
        .toList()

    fun setPeerAuthenticatedHandler(handler: ((PeerSession) -> Unit)?) {
        onPeerAuthenticated = handler
    }

    fun setSessionClosedHandler(handler: ((PeerSession) -> Unit)?) {
        onSessionClosed = handler
    }

    fun setApplicationFrameHandler(handler: ((PeerSession, Int, ByteArray) -> Unit)?) {
        onApplicationFrame = handler
    }

    fun sendFrame(sessionId: String, type: Int, payload: ByteArray) {
        require(type in PeerTransportConstants.TRANSFER_FRAME_TYPES) { "INVALID_FRAME_TYPE" }
        require(payload.size + PeerTransportConstants.APPLICATION_FRAME_HEADER_BYTES <= PeerTransportConstants.MAX_APPLICATION_FRAME_BYTES) { "FRAME_TOO_LARGE" }
        if (!isSessionAuthorized(sessionId)) throw SecurityException("SESSION_NOT_AUTHORIZED")
        val session = sessions[sessionId] ?: throw IllegalStateException("SESSION_NOT_FOUND")
        // Must be the same encoder PeerTransportSessionMonitor reads: length, magic, version, type.
        // This wrote a bare [length][type][payload] instead, so every application frame — transfer,
        // swarm, messaging, shared space — failed the peer's magic check and tore the session down.
        PeerTransportFrame.writeFrame(session.output, type, payload)
    }

    private fun createClientSocket(host: String, port: Int): SSLSocket {
        val socket = PeerTransportTls.getTlsContext().socketFactory.createSocket() as SSLSocket
        socket.useClientMode = true
        socket.enabledProtocols = PeerTransportTls.supportedTlsProtocols(socket.supportedProtocols)
        socket.soTimeout = PeerTransportConstants.SOCKET_TIMEOUT_MS
        return socket
    }

    private fun acceptConnections(server: ServerSocket, executor: ThreadPoolExecutor) {
        while (!server.isClosed) {
            val socket = try {
                server.accept().apply { soTimeout = PeerTransportConstants.SOCKET_TIMEOUT_MS }
            } catch (_: Exception) {
                if (!server.isClosed) continue else return
            }
            try {
                executor.execute { handleIncomingConnection(socket) }
            } catch (_: RejectedExecutionException) {
                socket.close()
            }
        }
    }

    private fun handleIncomingConnection(socket: Socket) {
        try {
            val secureSocket = createServerSocket(socket)
            val peer = PeerTransportAuth.authenticate(secureSocket, null, null, false)
            registerSession(peer, secureSocket)
            onPeerAuthenticated?.invoke(peer)
        } catch (_: Exception) {
            try { socket.close() } catch (_: Exception) {}
        }
    }

    private fun createServerSocket(socket: Socket): SSLSocket {
        val secureSocket = PeerTransportTls.getTlsContext().socketFactory.createSocket(
            socket, socket.inetAddress.hostAddress, socket.port, true
        ) as SSLSocket
        secureSocket.useClientMode = false
        secureSocket.needClientAuth = true
        secureSocket.enabledProtocols = PeerTransportTls.supportedTlsProtocols(secureSocket.supportedProtocols)
        secureSocket.soTimeout = PeerTransportConstants.SOCKET_TIMEOUT_MS
        secureSocket.startHandshake()
        return secureSocket
    }

    internal fun registerSession(peer: PeerSession, socket: SSLSocket) {
        val active = ActiveSession(peer, socket, DataOutputStream(socket.outputStream))
        sessions.put(peer.sessionId, active)?.socket?.close()
        socket.soTimeout = PeerTransportConstants.SESSION_HEARTBEAT_MS
        try {
            sessionExecutor.execute { PeerTransportSessionMonitor(active, this).run() }
        } catch (_: RejectedExecutionException) {
            sessions.remove(peer.sessionId)
            socket.close()
            throw IllegalStateException("SESSION_LIMIT_REACHED")
        }
    }

    internal val onApplicationFrameHandler: ((PeerSession, Int, ByteArray) -> Unit)?
        get() = onApplicationFrame

    internal fun isSessionAuthorizedInternal(sessionId: String): Boolean = isSessionAuthorized(sessionId)

    /** The monitor thread winding down, for any reason. The same retirement as an explicit close. */
    internal fun removeSession(session: ActiveSession) {
        retire(session)
    }
}
