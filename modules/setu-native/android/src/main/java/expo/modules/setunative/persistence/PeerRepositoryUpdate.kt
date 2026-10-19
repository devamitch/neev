package expo.modules.setunative.persistence

import expo.modules.setunative.models.*

internal class PeerRepositoryUpdate(private val repository: PeerRepository) {

    fun updateTrustState(peerId: String, trustState: TrustState): Boolean {
        return update(peerId) { it.copy(peer = it.peer.copy(trustState = trustState)) }
    }

    fun updateSession(peerId: String, sessionId: String?, verificationCode: String?): Boolean {
        return update(peerId) { stored -> stored.copy(peer = stored.peer.copy(
            sessionId = sessionId, verificationCode = verificationCode, lastSeenAt = System.currentTimeMillis()
        )) }
    }

    fun updateLastSeen(peerId: String): Boolean {
        return update(peerId) { it.copy(peer = it.peer.copy(lastSeenAt = System.currentTimeMillis())) }
    }

    fun block(peerId: String, reason: String? = null): Boolean {
        return setBlocked(peerId, true, reason)
    }

    fun unblock(peerId: String): Boolean {
        return setBlocked(peerId, false, null)
    }

    fun setBlocked(peerId: String, blocked: Boolean, reason: String?, expiresAt: Long? = null): Boolean = try {
        repository.withStoreLock {
            val current = repository.readStored(peerId)
            if (blocked) {
                val now = System.currentTimeMillis()
                val marker = org.json.JSONObject()
                    .put("blockedAt", now)
                    .put("reason", reason ?: "Blocked by user")
                    .put("blockedUntil", expiresAt ?: 0L)
                    .toString().toByteArray(Charsets.UTF_8)
                try {
                    repository.storeMarker(PeerRepository.BLOCK_PREFIX + peerId, marker)
                } finally {
                    marker.fill(0)
                }
                if (current != null) repository.writeStored(current.copy(peer = current.peer.copy(
                    isBlocked = true, trustState = TrustState.BLOCKED, blockedAt = now,
                    reason = reason ?: "Blocked by user", blockedUntil = expiresAt
                )))
                true
            } else {
                val wasBlocked = repository.blockMetadata(peerId) != null
                repository.removeMarker(PeerRepository.BLOCK_PREFIX + peerId)
                if (current != null) repository.writeStored(current.copy(peer = current.peer.copy(
                    isBlocked = false,
                    trustState = if (current.peer.trustState == TrustState.BLOCKED) TrustState.DISCOVERED else current.peer.trustState,
                    blockedAt = null, reason = null, blockedUntil = null
                )))
                current != null || wasBlocked
            }
        }
    } catch (_: Exception) {
        false
    }

    fun updateQuarantine(peerId: String, level: Int, reason: String = "Security violation"): Boolean {
        val now = System.currentTimeMillis()
        return update(peerId) { it.copy(
            peer = it.peer.copy(quarantineLevel = level, reason = if (level > 0) reason else null),
            quarantineReason = if (level > 0) reason else null,
            quarantinedAt = if (level > 0) now else null,
            quarantineExpiresAt = if (level > 0) now + QUARANTINE_TTL_MS else null
        ) }
    }

    private fun update(peerId: String, transform: (StoredPeer) -> StoredPeer): Boolean = try {
        repository.withStoreLock {
            val current = repository.readStored(peerId) ?: return@withStoreLock false
            repository.writeStored(transform(current))
            true
        }
    } catch (_: Exception) {
        false
    }

    private companion object {
        const val QUARANTINE_TTL_MS = 24 * 60 * 60 * 1000L
    }
}
