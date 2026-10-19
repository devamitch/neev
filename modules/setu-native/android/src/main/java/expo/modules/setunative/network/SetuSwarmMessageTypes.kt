package expo.modules.setunative.network

import java.util.BitSet

/**
 * Data classes for Setu swarm protocol messages.
 * All message types are immutable and thread-safe.
 */

// ====================================================
// Availability Messages
// ====================================================

/**
 * HAVE message: advertises available pieces for a manifest.
 */
data class HaveMessage(
    val manifestId: String,
    val availablePieces: List<Int>
) {
    override fun toString(): String = "HAVE(manifest=$manifestId, pieces=${availablePieces.size})"

    fun toBitSet(totalPieces: Int): BitSet {
        val bitfield = BitSet(totalPieces)
        for (pieceIndex in availablePieces) {
            if (pieceIndex < totalPieces) {
                bitfield.set(pieceIndex)
            }
        }
        return bitfield
    }
}

// ====================================================
// Request Messages
// ====================================================

/**
 * WANT message: requests specific pieces for a manifest.
 * Priority: 0 = normal, 1 = high (for playback)
 */
data class WantMessage(
    val manifestId: String,
    val wantedPieces: Set<Int>,
    val priority: Int = 0
) {
    override fun toString(): String = "WANT(manifest=$manifestId, pieces=${wantedPieces.size}, priority=$priority)"

    fun isHighPriority(): Boolean = priority > 0
}

/**
 * Piece request: requests a specific piece from a specific peer.
 */
data class PieceRequest(
    val requestId: String,
    val manifestId: String,
    val pieceIndex: Int
) {
    override fun toString(): String = "PIECE_REQUEST(id=$requestId, manifest=$manifestId, piece=$pieceIndex)"
}

// ====================================================
// Response Messages
// ====================================================

/**
 * Piece data response: contains the actual piece data.
 */
data class PieceDataResponse(
    val requestId: String,
    val manifestId: String,
    val pieceIndex: Int,
    val pieceData: ByteArray,
    val pieceHash: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PieceDataResponse) return false
        if (requestId != other.requestId) return false
        if (manifestId != other.manifestId) return false
        if (pieceIndex != other.pieceIndex) return false
        if (!pieceData.contentEquals(other.pieceData)) return false
        if (!pieceHash.contentEquals(other.pieceHash)) return false
        return true
    }

    override fun hashCode(): Int {
        var result = requestId.hashCode()
        result = 31 * result + manifestId.hashCode()
        result = 31 * result + pieceIndex
        result = 31 * result + pieceData.contentHashCode()
        result = 31 * result + pieceHash.contentHashCode()
        return result
    }

    override fun toString(): String = "PIECE_DATA(id=$requestId, manifest=$manifestId, piece=$pieceIndex, size=${pieceData.size})"
}

// ====================================================
// Provider Map Messages
// ====================================================

/**
 * Provider entry: maps a piece index to a provider peer.
 */
data class ProviderEntry(
    val pieceIndex: Int,
    val providerPeerId: String
) {
    override fun toString(): String = "PROVIDER(piece=$pieceIndex, peer=$providerPeerId)"
}

/**
 * Provider map update: full update of which peers have which pieces.
 */
data class ProviderMapUpdate(
    val manifestId: String,
    val providerMap: Map<Int, Set<String>>
) {
    override fun toString(): String = "PROVIDER_MAP(manifest=$manifestId, entries=${providerMap.size})"

    /**
     * Get providers for a specific piece.
     */
    fun getProviders(pieceIndex: Int): Set<String> = providerMap[pieceIndex] ?: emptySet()

    /**
     * Get all piece indices.
     */
    fun getPieceIndices(): Set<Int> = providerMap.keys

    /**
     * Check if a peer provides any pieces.
     */
    fun hasPeer(peerId: String): Boolean {
        for ((_, providers) in providerMap) {
            if (providers.contains(peerId)) return true
        }
        return false
    }

    /**
     * Get all peer IDs.
     */
    fun getAllPeerIds(): Set<String> {
        val peerIds = mutableSetOf<String>()
        for ((_, providers) in providerMap) {
            peerIds.addAll(providers)
        }
        return peerIds
    }
}

// ====================================================
// Replication Messages
// ====================================================

/**
 * Replication request: requests replication of rare pieces.
 * Target replication: desired number of copies (default 2).
 */
data class ReplicationRequest(
    val manifestId: String,
    val rarePieces: Set<Int>,
    val targetReplication: Int = 2
) {
    override fun toString(): String = "REPLICATION(manifest=$manifestId, pieces=${rarePieces.size}, target=$targetReplication)"
}

// ====================================================
// Departure Messages
// ====================================================

/**
 * Departure announcement: sent when a peer is leaving the swarm.
 * Contains rare pieces that the departing peer has.
 */
data class DepartureAnnouncement(
    val peerId: String,
    val sessionId: String,
    val manifestId: String,
    val rarePieces: Set<Int>
) {
    override fun toString(): String = "DEPARTURE(peer=$peerId, manifest=$manifestId, pieces=${rarePieces.size})"
}

// ====================================================
// Repair Messages
// ====================================================

/**
 * Repair request: requests missing pieces to be repaired.
 * Urgency: 0 = normal, 1 = urgent (for playback)
 */
data class RepairRequest(
    val manifestId: String,
    val missingPieces: Set<Int>,
    val urgency: Int = 0
) {
    override fun toString(): String = "REPAIR(manifest=$manifestId, pieces=${missingPieces.size}, urgency=$urgency)"

    fun isUrgent(): Boolean = urgency > 0
}
