package expo.modules.setunative.swarm

import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.persistence.PeerRepository
import expo.modules.setunative.persistence.PieceRepository
import expo.modules.setunative.persistence.ProviderMapRepository
import java.util.*
import java.util.concurrent.PriorityBlockingQueue
import java.util.concurrent.atomic.AtomicInteger

/**
 * Swarm scheduler implementing rarest-first scheduling with playback priority.
 * Protects rare pieces and prioritizes based on playback needs.
 */
class SwarmScheduler(
    private val pieceRepository: PieceRepository,
    private val providerMapRepository: ProviderMapRepository,
    private val peerRepository: PeerRepository,
    private val maxConcurrentRequests: Int = 4
) {

    companion object {
        private const val TAG = "SETU_SCHEDULER"
        private const val PLAYBACK_PRIORITY = 1
        private const val RARE_PIECE_PRIORITY = 2
        private const val REPLICATION_PRIORITY = 3
        private const val NORMAL_PRIORITY = 4
    }

    data class ScheduledPiece(
        val manifestId: String,
        val pieceIndex: Int,
        val priority: Int,
        val timestamp: Long = System.currentTimeMillis()
    ) : Comparable<ScheduledPiece> {
        override fun compareTo(other: ScheduledPiece): Int {
            // Lower priority number = higher priority
            val priorityCompare = this.priority.compareTo(other.priority)
            if (priorityCompare != 0) return priorityCompare

            // For same priority, older requests first
            return this.timestamp.compareTo(other.timestamp)
        }
    }

    private val requestQueue = PriorityBlockingQueue<ScheduledPiece>()
    private val activeRequests = mutableMapOf<String, ScheduledPiece>()
    private val manifestPriorities = mutableMapOf<String, Int>()
    private val piecePriorities = mutableMapOf<String, MutableMap<Int, Int>>()

    fun setPlaybackPriority(manifestId: String, playbackWindow: IntRange? = null) {
        manifestPriorities[manifestId] = PLAYBACK_PRIORITY
        if (playbackWindow != null) {
            val priorityMap = piecePriorities.getOrPut(manifestId, { mutableMapOf() })
            for (pieceIndex in playbackWindow) priorityMap[pieceIndex] = PLAYBACK_PRIORITY
        }
        Log.d(TAG, "Playback priority set for $manifestId")
    }

    fun clearPlaybackPriority(manifestId: String) {
        manifestPriorities.remove(manifestId); piecePriorities.remove(manifestId)
        Log.d(TAG, "Playback priority cleared for $manifestId")
    }

    /**
     * The provider map is durable, so it outlives the sessions that filled it: after a restart, or
     * for a peer that vanished without a clean disconnect, it still names peers that cannot serve
     * anything. Rarity decides what gets replicated and prioritised, so it is read over providers
     * that have a live session only — otherwise a piece whose only holder is offline looks safe and
     * is never repaired.
     */
    private fun eligibleProviderMap(manifestId: String): Map<Int, Set<String>> {
        val connected = peerRepository.getConnected().map { it.peerId }.toSet()
        return providerMapRepository.getProviderMap(manifestId)
            .mapValues { (_, providers) -> providers intersect connected }
    }

    fun updateRarePiecePriorities(manifestId: String) {
        val eligible = eligibleProviderMap(manifestId)
        // A piece no reachable peer holds is the rarest case there is, so it counts as rare too.
        val rarePieces = eligible.filterValues { it.size <= 1 }.keys
        val priorityMap = piecePriorities.getOrPut(manifestId, { mutableMapOf() })
        for (pieceIndex in rarePieces) {
            if (priorityMap.getOrDefault(pieceIndex, NORMAL_PRIORITY) > RARE_PIECE_PRIORITY) {
                priorityMap[pieceIndex] = RARE_PIECE_PRIORITY
            }
        }
        Log.d(TAG, "Rare piece priorities updated for $manifestId: ${rarePieces.size} pieces")
    }

    /**
     * Schedule a piece for download
     */
    fun schedulePiece(manifestId: String, pieceIndex: Int): Boolean {
        val currentPriority = getPiecePriority(manifestId, pieceIndex)
        val scheduledPiece = ScheduledPiece(manifestId, pieceIndex, currentPriority)

        return requestQueue.offer(scheduledPiece)
    }

    /**
     * Schedule multiple pieces
     */
    fun schedulePieces(manifestId: String, pieceIndices: Set<Int>): Int {
        var scheduledCount = 0

        for (pieceIndex in pieceIndices) {
            if (schedulePiece(manifestId, pieceIndex)) {
                scheduledCount++
            }
        }

        return scheduledCount
    }

    /**
     * Get the next piece to request
     */
    fun getNextPiece(): ScheduledPiece? {
        if (activeRequests.size >= maxConcurrentRequests) {
            return null
        }

        return requestQueue.poll()
    }

    fun getNextPieces(): List<ScheduledPiece> {
        val pieces = mutableListOf<ScheduledPiece>()
        while (activeRequests.size + pieces.size < maxConcurrentRequests) {
            val piece = requestQueue.poll() ?: break
            pieces.add(piece)
        }
        return pieces
    }

    fun markRequested(scheduledPiece: ScheduledPiece) {
        activeRequests["${scheduledPiece.manifestId}_${scheduledPiece.pieceIndex}"] = scheduledPiece
    }

    fun markCompleted(manifestId: String, pieceIndex: Int) {
        activeRequests.remove("${manifestId}_$pieceIndex")
        updateRarePiecePriorities(manifestId)
        updateScheduledPieces(manifestId)
    }

    fun markFailed(manifestId: String, pieceIndex: Int) {
        activeRequests.remove("${manifestId}_$pieceIndex")
        schedulePiece(manifestId, pieceIndex)
    }

    /**
     * Get the current priority for a piece
     */
    fun getPiecePriority(manifestId: String, pieceIndex: Int): Int {
        // Check piece-specific priority first
        piecePriorities[manifestId]?.get(pieceIndex)?.let { return it }

        // Check manifest-level priority
        manifestPriorities[manifestId]?.let { return it }

        // Check if this is a rare piece
        val providerMap = eligibleProviderMap(manifestId)
        val providers = providerMap[pieceIndex] ?: emptySet()
        if (providers.size <= 1) {
            return RARE_PIECE_PRIORITY
        }

        return NORMAL_PRIORITY
    }

    /**
     * Update scheduled pieces for a manifest based on current state
     */
    private fun updateScheduledPieces(manifestId: String) {
        // This would re-evaluate priorities and potentially reorder the queue
        // For simplicity, we'll just update rare piece priorities
        updateRarePiecePriorities(manifestId)
    }

    /**
     * Get the current queue size
     */
    fun getQueueSize(): Int = requestQueue.size

    /**
     * Get the number of active requests
     */
    fun getActiveRequestCount(): Int = activeRequests.size

    /**
     * Clear all scheduled pieces for a manifest
     */
    fun clearManifest(manifestId: String) {
        val piecesToRemove = activeRequests.filterKeys { it.startsWith(manifestId) }
        activeRequests.keys.removeAll(piecesToRemove.keys)

        // Remove from queue (this is expensive, only do when necessary)
        val queueCopy = mutableListOf<ScheduledPiece>()
        requestQueue.drainTo(queueCopy)

        val filteredQueue = queueCopy.filter { it.manifestId != manifestId }
        requestQueue.addAll(filteredQueue)
    }

    /**
     * Get a prioritized list of missing pieces for a manifest
     * This implements the rarest-first strategy
     */
    fun getPrioritizedMissingPieces(
        manifestId: String,
        totalPieces: Int,
        availablePieces: Set<Int>
    ): List<Int> {
        val missingPieces = mutableSetOf<Int>()
        for (i in 0 until totalPieces) {
            if (i !in availablePieces) {
                missingPieces.add(i)
            }
        }

        // Sort by priority: playback window first, then rare pieces, then others
        val providerMap = providerMapRepository.getProviderMap(manifestId)
        val piecePriorities = piecePriorities[manifestId] ?: emptyMap()

        return missingPieces.sortedWith(Comparator { a, b ->
            val priorityA = piecePriorities.getOrDefault(a, getRarityPriority(a, providerMap))
            val priorityB = piecePriorities.getOrDefault(b, getRarityPriority(b, providerMap))

            // Lower number = higher priority
            priorityA.compareTo(priorityB)
        })
    }

    /**
     * Get priority based on rarity
     */
    private fun getRarityPriority(pieceIndex: Int, providerMap: Map<Int, Set<String>>): Int {
        val providers = providerMap[pieceIndex] ?: return NORMAL_PRIORITY
        return when {
            providers.isEmpty() -> PLAYBACK_PRIORITY // Critical: no providers
            providers.size == 1 -> RARE_PIECE_PRIORITY
            providers.size <= 2 -> REPLICATION_PRIORITY
            else -> NORMAL_PRIORITY
        }
    }

    fun rebuildQueueForManifest(manifestId: String, totalPieces: Int) {
        val availablePieces = pieceRepository.getAvailablePieces(manifestId).map { it.index }.toSet()
        val prioritizedPieces = getPrioritizedMissingPieces(manifestId, totalPieces, availablePieces)
        clearManifest(manifestId)
        for (pieceIndex in prioritizedPieces) schedulePiece(manifestId, pieceIndex)
        Log.d(TAG, "Queue rebuilt for $manifestId: ${prioritizedPieces.size} pieces")
    }
}
