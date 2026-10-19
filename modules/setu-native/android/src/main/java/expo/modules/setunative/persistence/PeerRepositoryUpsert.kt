package expo.modules.setunative.persistence

import expo.modules.setunative.models.*

internal class PeerRepositoryUpsert(private val repository: PeerRepository) {

    fun upsert(peer: SetuPeer): Boolean = try {
        repository.withStoreLock {
            val existing = repository.readStored(peer.peerId)
            val blocked = repository.isBlocked(peer.peerId) || existing?.peer?.isBlocked == true
            repository.writeStored(StoredPeer(
                peer = peer.copy(
                    isBlocked = blocked,
                    trustState = if (blocked) TrustState.BLOCKED else peer.trustState,
                    blockedAt = existing?.peer?.blockedAt,
                    reason = existing?.peer?.reason,
                    blockedUntil = existing?.peer?.blockedUntil,
                    quarantineLevel = maxOf(peer.quarantineLevel, existing?.peer?.quarantineLevel ?: 0)
                ),
                quarantineReason = existing?.quarantineReason,
                quarantinedAt = existing?.quarantinedAt,
                quarantineExpiresAt = existing?.quarantineExpiresAt
            ))
        }
        true
    } catch (_: Exception) {
        false
    }
}
