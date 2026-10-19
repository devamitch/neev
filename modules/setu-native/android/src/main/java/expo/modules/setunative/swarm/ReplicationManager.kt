package expo.modules.setunative.swarm

import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.network.SetuSwarmProtocol
import java.util.concurrent.ConcurrentHashMap

/**
 * Manages piece replication for last-copy protection and swarm resilience.
 * Automatically replicates rare pieces to ensure minimum replication factor.
 */
class ReplicationManager(private val engine: SetuSwarmEngine) {

    companion object {
        private const val TAG = "SETU_REPLICA_MGR"
        private const val TARGET_REPLICATION_FACTOR = 2
        private const val REPLICATION_TIMEOUT_MS = 30000L
    }

    private val activeReplicationRequests = ConcurrentHashMap<String, Long>()

    /**
     * Replicate a specific piece to ensure it has enough providers
     */
    fun replicatePiece(manifestId: String, pieceIndex: Int): Boolean {
        val manifest = engine.manifestRepository.get(manifestId) ?: return false
        val piece = engine.pieceRepository.getByManifest(manifestId)
            .find { it.index == pieceIndex && it.state == PieceState.AVAILABLE } ?: return false

        // Check current replication factor
        val currentProviders = engine.providerMapRepository.getProviders(manifestId, pieceIndex)
            .map { it.providerPeerId }.toSet()

        if (currentProviders.size >= TARGET_REPLICATION_FACTOR) {
            Log.d(TAG, "Piece $manifestId:$pieceIndex already has ${currentProviders.size} providers")
            return true
        }

        // Find eligible peers to replicate to
        val connectedPeers = engine.peerRepository.getConnected()
            .filter { !currentProviders.contains(it.peerId) && it.sessionId != null }

        if (connectedPeers.isEmpty()) {
            Log.w(TAG, "No eligible peers for replication of $manifestId:$pieceIndex")
            return false
        }

        // Request replication from existing providers
        for (provider in currentProviders) {
            val providerPeer = connectedPeers.find { it.peerId == provider } ?: continue
            val requestId = "${manifestId}_${pieceIndex}_replica_${System.currentTimeMillis()}"

            try {
                val payload = SetuSwarmProtocol.createPieceRequest(manifestId, pieceIndex, requestId)
                SetuPeerTransport.sendFrame(
                    providerPeer.sessionId!!,
                    SetuSwarmProtocol.FRAME_REPLICATION_REQUEST,
                    payload
                )
                activeReplicationRequests[requestId] = System.currentTimeMillis()
                Log.d(TAG, "Requested replication for $manifestId:$pieceIndex from $provider")
                return true
            } catch (e: Exception) {
                Log.e(TAG, "Failed to request replication for $manifestId:$pieceIndex", e)
            }
        }

        return false
    }

    /**
     * Replicate multiple rare pieces
     */
    fun replicateRarePieces(manifestId: String, rarePieces: Set<Int>) {
        for (pieceIndex in rarePieces) {
            replicatePiece(manifestId, pieceIndex)
        }
    }

    /**
     * Check and replicate at-risk pieces (pieces with only 1 provider)
     */
    fun replicateAtRiskPieces(manifestId: String) {
        val manifest = engine.manifestRepository.get(manifestId) ?: return
        val providerMap = engine.providerMapRepository.getProviderMap(manifestId)

        val atRiskPieces = mutableSetOf<Int>()
        for (pieceIndex in 0 until manifest.pieceCount) {
            val providers = providerMap[pieceIndex] ?: continue
            if (providers.size <= TARGET_REPLICATION_FACTOR) {
                atRiskPieces.add(pieceIndex)
            }
        }

        replicateRarePieces(manifestId, atRiskPieces)
    }

    /**
     * Handle replication request from another peer
     */
    fun handleReplicationRequest(
        sessionId: String,
        peerId: String,
        requestId: String,
        manifestId: String,
        pieceIndex: Int
    ) {
        val piece = engine.pieceRepository.getByManifest(manifestId)
            .find { it.index == pieceIndex && it.state == PieceState.AVAILABLE } ?: run {
            Log.w(TAG, "Cannot replicate $manifestId:$pieceIndex - not available locally")
            return
        }

        try {
            if (!SetuPeerTransport.isSessionAuthorized(sessionId) ||
                SetuPeerTransport.peerIdForSession(sessionId) != peerId) return
            val manifest = engine.manifestRepository.get(manifestId) ?: return
            val pieceData = engine.pieceStore.readVerified(manifest, pieceIndex, piece.hash, piece.storagePath)

            val response = SetuSwarmProtocol.createPieceDataResponse(
                requestId,
                manifestId,
                pieceIndex,
                pieceData,
                piece.hash
            )

            SetuPeerTransport.sendFrame(
                sessionId,
                SetuSwarmProtocol.FRAME_PIECE_DATA,
                response
            )

            // Update provider map to include the new peer
            Log.d(TAG, "Serving replication for $manifestId:$pieceIndex to $peerId")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to serve replication for $manifestId:$pieceIndex", e)
        }
    }

    /**
     * Check if a piece is the last copy in the swarm
     */
    fun isLastCopy(manifestId: String, pieceIndex: Int, peerId: String): Boolean {
        val providers = engine.providerMapRepository.getProviders(manifestId, pieceIndex)
            .map { it.providerPeerId }.toSet()

        return providers.size == 1 && providers.contains(peerId)
    }

    /**
     * Get pieces that need protection (last copies)
     */
    fun getLastCopyPieces(peerId: String): Map<String, Set<Int>> {
        val lastCopyPieces = mutableMapOf<String, MutableSet<Int>>()
        val manifests = engine.manifestRepository.getAll()

        for (manifest in manifests) {
            val providerMap = engine.providerMapRepository.getProviderMap(manifest.manifestId)
            val lastCopyForManifest = mutableSetOf<Int>()

            for (pieceIndex in 0 until manifest.pieceCount) {
                val providers = providerMap[pieceIndex] ?: continue
                if (providers.size == 1 && providers.contains(peerId)) {
                    lastCopyForManifest.add(pieceIndex)
                }
            }

            if (lastCopyForManifest.isNotEmpty()) {
                lastCopyPieces[manifest.manifestId] = lastCopyForManifest
            }
        }

        return lastCopyPieces
    }

    /**
     * Handle peer departure - ensure last-copy pieces are protected
     */
    fun handlePeerDeparture(peerId: String) {
        val lastCopyPieces = getLastCopyPieces(peerId)

        for ((manifestId, pieceIndices) in lastCopyPieces) {
            for (pieceIndex in pieceIndices) {
                Log.w(TAG, "Last copy protection: $manifestId:$pieceIndex was last copy from $peerId")
                // Trigger immediate replication
                replicatePiece(manifestId, pieceIndex)
            }
        }
    }

    /**
     * Handle returning peer - update replication state
     */
    fun handlePeerReturn(peerId: String) {
        val connectedPeer = engine.peerRepository.get(peerId) ?: return

        // Re-broadcast HAVE messages for all manifests this peer has
        val manifests = engine.manifestRepository.getAll()
        for (manifest in manifests) {
            val availablePieces = engine.pieceRepository.getByManifest(manifest.manifestId)
                .filter { it.state == PieceState.AVAILABLE }
                .map { it.index }.toSet()

            if (availablePieces.isNotEmpty()) {
                val bitfield = java.util.BitSet()
                for (index in availablePieces) {
                    bitfield.set(index)
                }

                val payload = SetuSwarmProtocol.createHaveMessage(manifest.manifestId, bitfield)
                connectedPeer.sessionId?.let { sessionId ->
                    SetuPeerTransport.sendFrame(sessionId, SetuSwarmProtocol.FRAME_HAVE, payload)
                }
            }
        }

        // Recalculate swarm state
        for (manifest in manifests) {
            engine.swarmCoordinator.recomputeSwarmState(manifest.manifestId)
        }

        Log.d(TAG, "Peer $peerId returned - updated swarm state")
    }

    /**
     * Clean up expired replication requests
     */
    fun cleanupExpiredRequests() {
        val now = System.currentTimeMillis()
        val expired = activeReplicationRequests.entries
            .filter { now - it.value > REPLICATION_TIMEOUT_MS }
            .map { it.key }

        for (requestId in expired) {
            activeReplicationRequests.remove(requestId)
        }

        if (expired.isNotEmpty()) {
            Log.d(TAG, "Cleaned up ${expired.size} expired replication requests")
        }
    }
}
