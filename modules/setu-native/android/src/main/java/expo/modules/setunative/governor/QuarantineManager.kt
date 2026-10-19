package expo.modules.setunative.governor

import android.util.Log
import expo.modules.setunative.models.SetuPeer
import expo.modules.setunative.models.TrustState
import expo.modules.setunative.persistence.PeerRepository
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Quarantine Manager for handling misbehaving peers.
 * Implements progressive quarantine based on violation severity and frequency.
 */
class QuarantineManager(
    private val peerRepository: PeerRepository,
    private val governor: ResourceGovernor
) {

    companion object {
        private const val TAG = "SETU_QUARANTINE"

        // Quarantine levels and thresholds
        private const val QUARANTINE_LEVEL_NONE = 0
        private const val QUARANTINE_LEVEL_LOW = 1
        private const val QUARANTINE_LEVEL_MEDIUM = 2
        private const val QUARANTINE_LEVEL_HIGH = 3
        private const val QUARANTINE_LEVEL_BLOCKED = 4

        // Violation weights
        private const val WEIGHT_MALFORMED_FRAME = 1
        private const val WEIGHT_PROTOCOL_VIOLATION = 2
        private const val WEIGHT_AUTHENTICATION_FAILURE = 3
        private const val WEIGHT_DATA_CORRUPTION = 5
        private const val WEIGHT_SPAM_BEHAVIOR = 3
        private const val WEIGHT_RATE_LIMIT_VIOLATION = 2

        // Thresholds for quarantine escalation
        private const val LOW_QUARANTINE_THRESHOLD = 3
        private const val MEDIUM_QUARANTINE_THRESHOLD = 6
        private const val HIGH_QUARANTINE_THRESHOLD = 10
        private const val BLOCK_THRESHOLD = 15

        // Quarantine durations
        private const val LOW_QUARANTINE_DURATION_MIN = 5L
        private const val MEDIUM_QUARANTINE_DURATION_MIN = 15L
        private const val HIGH_QUARANTINE_DURATION_MIN = 60L
        private const val MAX_VIOLATIONS_TRACKED = 50
    }

    enum class ViolationType {
        MALFORMED_FRAME,
        PROTOCOL_VIOLATION,
        AUTHENTICATION_FAILURE,
        DATA_CORRUPTION,
        SPAM_BEHAVIOR,
        RATE_LIMIT_VIOLATION,
        UNSPECIFIED
    }

    data class QuarantineEntry(
        val peerId: String,
        val violations: MutableList<ViolationRecord> = mutableListOf(),
        val quarantineLevel: Int = QUARANTINE_LEVEL_NONE,
        val quarantinedAt: Long? = null,
        val quarantineExpiresAt: Long? = null
    )

    data class ViolationRecord(
        val type: ViolationType,
        val weight: Int,
        val timestamp: Long,
        val details: String? = null
    )

    private val quarantineCache = ConcurrentHashMap<String, QuarantineEntry>()
    private var isMonitoring = false

    fun startMonitoring() {
        if (!isMonitoring) {
            isMonitoring = true
            Log.i(TAG, "Quarantine manager monitoring started")
            // Load existing quarantine states from repository
            loadFromRepository()
        }
    }

    fun stopMonitoring() {
        if (isMonitoring) {
            isMonitoring = false
            Log.i(TAG, "Quarantine manager monitoring stopped")
            saveToRepository()
        }
    }

    private fun loadFromRepository() {
        val quarantinedPeers = peerRepository.getQuarantined()
        for (peer in quarantinedPeers) {
            val entry = QuarantineEntry(
                peerId = peer.peerId,
                quarantineLevel = peer.quarantineLevel,
                quarantinedAt = peer.lastSeenAt
            )
            quarantineCache[peer.peerId] = entry
            Log.d(TAG, "Loaded quarantine state for ${peer.peerId}: level=${peer.quarantineLevel}")
        }
    }

    private fun saveToRepository() {
        for ((peerId, entry) in quarantineCache) {
            val peer = peerRepository.get(peerId) ?: continue
            if (entry.quarantineLevel > QUARANTINE_LEVEL_NONE) {
                peerRepository.updateQuarantine(peerId, entry.quarantineLevel)
            }
        }
    }

    /**
     * Record a violation for a peer
     */
    fun recordViolation(
        peerId: String,
        type: ViolationType,
        details: String? = null
    ): Boolean {
        val weight = getViolationWeight(type)
        val now = System.currentTimeMillis()

        val entry = quarantineCache.getOrPut(peerId) {
            QuarantineEntry(peerId = peerId)
        }

        // Add violation record
        entry.violations.add(ViolationRecord(type, weight, now, details))

        // Clean up old violations
        cleanupOldViolations(entry, now)

        // Recalculate quarantine level
        val oldLevel = entry.quarantineLevel
        val newLevel = calculateQuarantineLevel(entry)

        if (newLevel != oldLevel) {
            quarantineCache[peerId] = entry.copy(
                quarantineLevel = newLevel,
                quarantinedAt = now,
                quarantineExpiresAt = calculateExpirationTime(newLevel)
            )

            Log.w(TAG, "Quarantine level for $peerId changed: $oldLevel -> $newLevel")

            // Update peer trust state
            updatePeerTrustState(peerId, newLevel)

            return true
        }

        return false
    }

    /**
     * Record multiple violations
     */
    fun recordViolations(peerId: String, violations: List<ViolationType>): Int {
        var changed = false
        for (type in violations) {
            if (recordViolation(peerId, type)) {
                changed = true
            }
        }
        return if (changed) 1 else 0
    }

    private fun getViolationWeight(type: ViolationType): Int {
        return when (type) {
            ViolationType.MALFORMED_FRAME -> WEIGHT_MALFORMED_FRAME
            ViolationType.PROTOCOL_VIOLATION -> WEIGHT_PROTOCOL_VIOLATION
            ViolationType.AUTHENTICATION_FAILURE -> WEIGHT_AUTHENTICATION_FAILURE
            ViolationType.DATA_CORRUPTION -> WEIGHT_DATA_CORRUPTION
            ViolationType.SPAM_BEHAVIOR -> WEIGHT_SPAM_BEHAVIOR
            ViolationType.RATE_LIMIT_VIOLATION -> WEIGHT_RATE_LIMIT_VIOLATION
            ViolationType.UNSPECIFIED -> 1
        }
    }

    private fun cleanupOldViolations(entry: QuarantineEntry, now: Long) {
        val expiryThreshold = now - TimeUnit.HOURS.toMillis(1)
        entry.violations.removeIf { it.timestamp < expiryThreshold }

        // Keep only the most recent violations
        while (entry.violations.size > MAX_VIOLATIONS_TRACKED) {
            entry.violations.removeAt(0)
        }
    }

    private fun calculateQuarantineLevel(entry: QuarantineEntry): Int {
        val totalWeight = entry.violations.sumOf { it.weight }

        return when {
            totalWeight >= BLOCK_THRESHOLD -> QUARANTINE_LEVEL_BLOCKED
            totalWeight >= HIGH_QUARANTINE_THRESHOLD -> QUARANTINE_LEVEL_HIGH
            totalWeight >= MEDIUM_QUARANTINE_THRESHOLD -> QUARANTINE_LEVEL_MEDIUM
            totalWeight >= LOW_QUARANTINE_THRESHOLD -> QUARANTINE_LEVEL_LOW
            else -> QUARANTINE_LEVEL_NONE
        }
    }

    private fun calculateExpirationTime(level: Int): Long {
        val now = System.currentTimeMillis()
        return when (level) {
            QUARANTINE_LEVEL_LOW -> now + TimeUnit.MINUTES.toMillis(LOW_QUARANTINE_DURATION_MIN)
            QUARANTINE_LEVEL_MEDIUM -> now + TimeUnit.MINUTES.toMillis(MEDIUM_QUARANTINE_DURATION_MIN)
            QUARANTINE_LEVEL_HIGH -> now + TimeUnit.MINUTES.toMillis(HIGH_QUARANTINE_DURATION_MIN)
            else -> 0L
        }
    }

    private fun updatePeerTrustState(peerId: String, quarantineLevel: Int) {
        val trustState = when (quarantineLevel) {
            QUARANTINE_LEVEL_BLOCKED -> TrustState.BLOCKED
            QUARANTINE_LEVEL_HIGH -> TrustState.QUARANTINED
            else -> null
        }

        trustState?.let { state ->
            peerRepository.updateTrustState(peerId, state)
        }
    }

    /**
     * Check if a peer is quarantined
     */
    fun isQuarantined(peerId: String): Boolean {
        val entry = quarantineCache[peerId] ?: return false

        // Check if quarantine has expired
        entry.quarantineExpiresAt?.let { expiresAt ->
            if (System.currentTimeMillis() > expiresAt) {
                quarantineCache.remove(peerId)
                return false
            }
        }

        return entry.quarantineLevel > QUARANTINE_LEVEL_NONE
    }

    /**
     * Check if a peer is blocked
     */
    fun isBlocked(peerId: String): Boolean {
        val entry = quarantineCache[peerId] ?: return false
        return entry.quarantineLevel >= QUARANTINE_LEVEL_BLOCKED
    }

    /**
     * Get current quarantine level for a peer
     */
    fun getQuarantineLevel(peerId: String): Int {
        val entry = quarantineCache[peerId] ?: return QUARANTINE_LEVEL_NONE

        // Check if quarantine has expired
        entry.quarantineExpiresAt?.let { expiresAt ->
            if (System.currentTimeMillis() > expiresAt) {
                quarantineCache.remove(peerId)
                return QUARANTINE_LEVEL_NONE
            }
        }

        return entry.quarantineLevel
    }

    /**
     * Get remaining quarantine time for a peer
     */
    fun getRemainingQuarantineTimeMs(peerId: String): Long {
        val entry = quarantineCache[peerId] ?: return 0L

        entry.quarantineExpiresAt?.let { expiresAt ->
            val remaining = expiresAt - System.currentTimeMillis()
            return if (remaining > 0) remaining else 0L
        }

        return 0L
    }

    /**
     * Check if a specific operation is allowed for a peer
     */
    fun allowOperation(peerId: String, operation: String): Boolean {
        val level = getQuarantineLevel(peerId)

        return when (level) {
            QUARANTINE_LEVEL_BLOCKED -> false
            QUARANTINE_LEVEL_HIGH -> {
                // High quarantine blocks most operations except basic discovery
                operation in setOf("DISCOVERY", "PING")
            }
            QUARANTINE_LEVEL_MEDIUM -> {
                // Medium quarantine allows basic operations but blocks resource-intensive ones
                operation !in setOf("TRANSFER", "HASHING", "REPLICATION", "STREAMING")
            }
            QUARANTINE_LEVEL_LOW -> true
            else -> true
        }
    }

    /**
     * Clear quarantine for a peer
     */
    fun clearQuarantine(peerId: String): Boolean {
        val wasQuarantined = quarantineCache.remove(peerId) != null
        if (wasQuarantined) {
            // Reset peer trust state if it was quarantined
            peerRepository.updateQuarantine(peerId, QUARANTINE_LEVEL_NONE)
            peerRepository.updateTrustState(peerId, TrustState.AUTHENTICATED)
            Log.i(TAG, "Quarantine cleared for $peerId")
        }
        return wasQuarantined
    }

    /**
     * Clear all quarantines
     */
    fun clearAll() {
        quarantineCache.clear()
        Log.i(TAG, "All quarantines cleared")
    }

    /**
     * Get all quarantined peers
     */
    fun getQuarantinedPeers(): List<String> {
        val now = System.currentTimeMillis()
        return quarantineCache.entries
            .filter { entry ->
                entry.value.quarantineLevel > QUARANTINE_LEVEL_NONE &&
                (entry.value.quarantineExpiresAt == null ||
                 entry.value.quarantineExpiresAt!! > now)
            }
            .map { it.key }
    }

    /**
     * Get quarantine statistics
     */
    fun getStats(): Map<String, Any> {
        val totalPeers = quarantineCache.size
        val quarantined = quarantineCache.values.count { it.quarantineLevel > QUARANTINE_LEVEL_NONE }
        val blocked = quarantineCache.values.count { it.quarantineLevel >= QUARANTINE_LEVEL_BLOCKED }
        val totalViolations = quarantineCache.values.sumOf { it.violations.size }

        return mapOf(
            "total_peers" to totalPeers,
            "quarantined" to quarantined,
            "blocked" to blocked,
            "total_violations" to totalViolations
        )
    }

    /**
     * Check if the system is currently under heavy quarantine load
     */
    fun isOverloaded(): Boolean {
        return quarantineCache.values.count { it.quarantineLevel > QUARANTINE_LEVEL_NONE } >
               governor.getCurrentStatus().activePeers / 2
    }

    /**
     * Periodic cleanup of expired quarantines
     */
    fun cleanupExpired() {
        val now = System.currentTimeMillis()
        val toRemove = quarantineCache.entries
            .filter { entry ->
                entry.value.quarantineExpiresAt?.let { expiresAt ->
                    now > expiresAt
                } ?: false
            }
            .map { it.key }

        for (peerId in toRemove) {
            quarantineCache.remove(peerId)
            // Reset peer trust state
            peerRepository.updateQuarantine(peerId, QUARANTINE_LEVEL_NONE)
            peerRepository.updateTrustState(peerId, TrustState.AUTHENTICATED)
            Log.d(TAG, "Expired quarantine cleaned for $peerId")
        }

        if (toRemove.isNotEmpty()) {
            Log.d(TAG, "Cleaned up ${toRemove.size} expired quarantines")
        }
    }
}
