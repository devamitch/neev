package expo.modules.setunative.swarm

import expo.modules.setunative.network.PeerSession
import expo.modules.setunative.network.PieceRequest
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.network.SetuSwarmProtocol

/**
 * Integrates the swarm engine with the existing transport layer.
 * Handles swarm-specific frame routing.
 */
object SwarmIntegration {

    private var swarmEngine: SetuSwarmEngine? = null
    private var isInitialized = false

    fun initialize(engine: SetuSwarmEngine) {
        if (isInitialized) return
        this.swarmEngine = engine
        isInitialized = true

        // Set up swarm frame handler
        SetuPeerTransport.registerApplicationFrameHandler("swarm") { session, type, payload ->
            handleSwarmFrame(session, type, payload)
        }
    }

    fun handleSwarmFrame(session: PeerSession, type: Int, payload: ByteArray) {
        val engine = swarmEngine ?: return

        when (type) {
            SetuSwarmProtocol.FRAME_HAVE -> {
                engine.handleHaveMessage(session.sessionId, session.peerId, payload)
            }
            SetuSwarmProtocol.FRAME_WANT -> {
                engine.handleWantMessage(session.sessionId, session.peerId, payload)
            }
            SetuSwarmProtocol.FRAME_PIECE_DATA -> {
                engine.handlePieceData(session.sessionId, session.peerId, payload)
            }
            SetuSwarmProtocol.FRAME_DEPARTURE_ANNOUNCE -> {
                engine.handleDepartureAnnouncement(session.sessionId, session.peerId, payload)
            }
            SetuSwarmProtocol.FRAME_PIECE_REQUEST -> {
                // Handle piece requests (cooperative serving)
                handlePieceRequest(session, payload)
            }
            SetuSwarmProtocol.FRAME_REPLICATION_REQUEST -> handlePieceRequest(session, payload)
        }
    }

    private fun handlePieceRequest(session: PeerSession, payload: ByteArray) {
        val engine = swarmEngine ?: return
        if (!engine.swarmCoordinator.canServePiece(session.sessionId, session.peerId)) return

        try {
            val request = SetuSwarmProtocol.parsePieceRequest(payload)
            val manifestId = request.manifestId
            val pieceIndex = request.pieceIndex
            val manifest = engine.manifestRepository.get(manifestId) ?: return
            if (!manifest.isPublic || pieceIndex !in 0 until manifest.pieceCount) return

            // Check if we have this piece available
            val availablePieces = engine.pieceRepository.getAvailablePieces(manifestId)
            val piece = availablePieces.find { it.index == pieceIndex }

            if (piece != null && piece.state == expo.modules.setunative.models.PieceState.AVAILABLE) {
                // Serve the piece if we have it
                servePiece(session, request, piece)
            }

        } catch (e: Exception) {
            android.util.Log.e("SETU_SWARM_INTEGRATION", "Failed to handle piece request", e)
        }
    }

    private fun servePiece(
        session: PeerSession,
        request: PieceRequest,
        piece: expo.modules.setunative.models.SetuPiece
    ) {
        val engine = swarmEngine ?: return
        try {
            val manifest = engine.manifestRepository.get(request.manifestId) ?: return
            val pieceData = engine.pieceStore.readVerified(
                manifest,
                request.pieceIndex,
                piece.hash,
                piece.storagePath
            )
            val pieceHash = manifest.pieceHashes[request.pieceIndex]

            val response = SetuSwarmProtocol.createPieceDataResponse(
                request.requestId,
                request.manifestId,
                request.pieceIndex,
                pieceData,
                pieceHash
            )

            SetuPeerTransport.sendFrame(session.sessionId, SetuSwarmProtocol.FRAME_PIECE_DATA, response)
            engine.onPieceServed(request.manifestId, request.pieceIndex, session.peerId, pieceData.size.toLong())

            android.util.Log.d("SETU_SWARM_INTEGRATION", "Served piece ${request.manifestId}_${request.pieceIndex}")

        } catch (e: Exception) {
            android.util.Log.e("SETU_SWARM_INTEGRATION", "Failed to serve piece", e)
        }
    }

    fun shutdown() {
        if (!isInitialized) return
        SetuPeerTransport.unregisterApplicationFrameHandler("swarm")
        swarmEngine = null
        isInitialized = false
    }
}
