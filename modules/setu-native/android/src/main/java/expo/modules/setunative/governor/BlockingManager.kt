package expo.modules.setunative.governor

import android.util.Log
import expo.modules.setunative.models.SetuPeer
import expo.modules.setunative.models.TrustState
import expo.modules.setunative.persistence.PeerRepository
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Blocking Manager for handling explicitly blocked peers.
 * Provides native-enforced blocking that survives app restarts.
 */
class BlockingManager(
    private val peerRepository: PeerRepository
) {

    companion object {
        private const val TAG = "SETU_BLOCKING"
        private const val MAX_BLOCKED_PEERS = 1000
    }

    private val blockCache = ConcurrentHashMap<String, BlockEntry>()
    private var isMonitoring = false

    data class BlockEntry(
        val peerId: String,
        val blockedAt: Long,
        val reason: String? = null,
        val isPermanent: Boolean = false,
        val expiresAt: Long? = null
    )

    enum class BlockReason {
        USER_BLOCKED,
        AUTO_BLOCKED,
        QUARANTINE_ESCALATION,
        SECURITY_VIOLATION,
        PROTOCOL_ABUSE,
        SPAM,
        HARASSMENT
    }

    fun startMonitoring() {
        if (!isMonitoring) {
            isMonitoring = true
            Log.i(TAG, "Blocking manager monitoring started")
            loadFromRepository()
        }
    }

    fun stopMonitoring() {
        if (isMonitoring) {
            isMonitoring = false
            Log.i(TAG, "Blocking manager monitoring stopped")
            saveToRepository()
        }
    }

    private fun loadFromRepository() {
        val blockedPeers = peerRepository.getBlocked()
        for (peer in blockedPeers) {
            val entry = BlockEntry(
                peerId = peer.peerId,
                blockedAt = peer.blockedAt ?: peer.lastSeenAt,
                reason = peer.reason,
                isPermanent = peer.blockedUntil == null,
                expiresAt = peer.blockedUntil
            )
            blockCache[peer.peerId] = entry
            Log.d(TAG, "Loaded block for ${peer.peerId}: ${peer.reason ?: "no reason"}")
        }
    }

    private fun saveToRepository() {
        for ((peerId, entry) in blockCache) {
            if (!entry.isPermanent && entry.expiresAt?.let { System.currentTimeMillis() > it } == true) {
                continue // Skip expired blocks
            }
            peerRepository.setBlocked(peerId, true, entry.reason ?: "Blocked by user", entry.expiresAt)
        }
    }

    /**
     * Block a peer permanently
     */
    fun blockPermanent(peerId: String, reason: String? = null): Boolean {
        return blockPeer(peerId, reason, isPermanent = true)
    }

    /**
     * Block a peer temporarily
     */
    fun blockTemporary(peerId: String, reason: String? = null, durationMs: Long = TimeUnit.DAYS.toMillis(30)): Boolean {
        return blockPeer(peerId, reason, isPermanent = false, durationMs = durationMs)
    }

    private fun blockPeer(
        peerId: String,
        reason: String?,
        isPermanent: Boolean,
        durationMs: Long = 0
    ): Boolean {
        if (blockCache.size >= MAX_BLOCKED_PEERS) {
            Log.w(TAG, "Maximum blocked peers limit reached, cannot block $peerId")
            return false
        }

        val now = System.currentTimeMillis()
        val expiresAt = if (isPermanent) null else now + durationMs

        val entry = BlockEntry(
            peerId = peerId,
            blockedAt = now,
            reason = reason,
            isPermanent = isPermanent,
            expiresAt = expiresAt
        )

        blockCache[peerId] = entry

        // Update peer in repository
        peerRepository.setBlocked(peerId, true, reason ?: "Blocked by user", expiresAt)
        peerRepository.updateTrustState(peerId, TrustState.BLOCKED)

        Log.i(TAG, "Blocked peer $peerId: ${reason ?: "no reason"}")

        // Immediately terminate any existing sessions with this peer
        // This would be handled by the transport layer

        return true
    }

    /**
     * Unblock a peer
     */
    fun unblock(peerId: String): Boolean {
        val wasBlocked = blockCache.remove(peerId) != null
        if (wasBlocked) {
            // Update peer in repository
            peerRepository.setBlocked(peerId, false, null)
            peerRepository.updateTrustState(peerId, TrustState.DISCOVERED)
            Log.i(TAG, "Unblocked peer $peerId")
        }
        return wasBlocked
    }

    /**
     * Check if a peer is blocked
     */
    fun isBlocked(peerId: String): Boolean {
        val entry = blockCache[peerId] ?: return peerRepository.isBlocked(peerId)

        // Check if block has expired
        entry.expiresAt?.let { expiresAt ->
            if (System.currentTimeMillis() > expiresAt) {
                blockCache.remove(peerId)
                peerRepository.setBlocked(peerId, false, null)
                return false
            }
        }

        return true
    }

    /**
     * Get all blocked peers
     */
    fun getBlockedPeers(): List<String> {
        val now = System.currentTimeMillis()
        return blockCache.entries
            .filter { entry ->
                entry.value.isPermanent ||
                (entry.value.expiresAt != null && entry.value.expiresAt!! > now)
            }
            .map { it.key }
    }

    /**
     * Check if an operation is allowed for a peer
     */
    fun allowOperation(peerId: String, operation: String): Boolean {
        if (!isBlocked(peerId)) {
            return true
        }

        // Even blocked peers might be allowed some operations
        // (like seeing that they are blocked in the UI)
        val allowedOperations = setOf("DISCOVERY", "BLOCK_LISTING")
        return operation in allowedOperations
    }

    /**
     * Block all operations from a peer
     */
    fun blockAllOperations(peerId: String, reason: String?): Boolean {
        return blockPermanent(peerId, reason ?: "All operations blocked")
    }

    /**
     * Block a peer specifically for messaging
     */
    fun blockMessaging(peerId: String, reason: String?): Boolean {
        // This would be handled at the messaging layer
        // For now, just block the peer completely
        return blockPermanent(peerId, reason ?: "Messaging blocked")
    }

    /**
     * Block a peer specifically for file transfers
     */
    fun blockFileTransfers(peerId: String, reason: String?): Boolean {
        // This would be handled at the transfer layer
        // For now, just block the peer completely
        return blockPermanent(peerId, reason ?: "File transfers blocked")
    }

    /**
     * Check if a peer can send messages
     */
    fun canSendMessages(peerId: String): Boolean {
        return !isBlocked(peerId)
    }

    /**
     * Check if a peer can receive messages
     */
    fun canReceiveMessages(peerId: String): Boolean {
        return !isBlocked(peerId)
    }

    /**
     * Check if a peer can initiate transfers
     */
    fun canInitiateTransfers(peerId: String): Boolean {
        return !isBlocked(peerId)
    }

    /**
     * Check if a peer can join shared spaces
     */
    fun canJoinSharedSpaces(peerId: String): Boolean {
        return !isBlocked(peerId)
    }

    /**
     * Clear all blocks
     */
    fun clearAll() {
        blockCache.clear()
        // Update all peers in repository
        peerRepository.getAll().forEach { peer ->
            peerRepository.setBlocked(peer.peerId, false, null)
            peerRepository.updateTrustState(peer.peerId, TrustState.DISCOVERED)
        }
        Log.i(TAG, "All blocks cleared")
    }

    /**
     * Get block statistics
     */
    fun getStats(): Map<String, Any> {
        val permanentBlocks = blockCache.values.count { it.isPermanent }
        val temporaryBlocks = blockCache.values.count { !it.isPermanent }

        return mapOf(
            "total_blocked" to blockCache.size,
            "permanent_blocks" to permanentBlocks,
            "temporary_blocks" to temporaryBlocks,
            "max_blocked" to MAX_BLOCKED_PEERS
        )
    }

    /**
     * Check if the system has reached the block limit
     */
    fun isLimitReached(): Boolean {
        return blockCache.size >= MAX_BLOCKED_PEERS
    }

    /**
     * Periodic cleanup of expired blocks
     */
    fun cleanupExpired() {
        val now = System.currentTimeMillis()
        val toRemove = blockCache.entries
            .filter { entry ->
                !entry.value.isPermanent &&
                entry.value.expiresAt?.let { expiresAt -> now > expiresAt } == true
            }
            .map { it.key }

        for (peerId in toRemove) {
            blockCache.remove(peerId)
            peerRepository.setBlocked(peerId, false, null)
            peerRepository.updateTrustState(peerId, TrustState.DISCOVERED)
            Log.d(TAG, "Expired block cleaned for $peerId")
        }

        if (toRemove.isNotEmpty()) {
            Log.d(TAG, "Cleaned up ${toRemove.size} expired blocks")
        }
    }

    /**
     * Restore a peer that was blocked due to device reset or similar
     */
    fun restorePeer(peerId: String): Boolean {
        return unblock(peerId)
    }
}
