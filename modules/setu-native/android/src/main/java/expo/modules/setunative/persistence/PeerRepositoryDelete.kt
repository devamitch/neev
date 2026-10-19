package expo.modules.setunative.persistence

import expo.modules.setunative.models.TrustState

internal class PeerRepositoryDelete(private val repository: PeerRepository) {

    fun delete(peerId: String): Boolean {
        return repository.withStoreLock {
            if (repository.readStored(peerId) == null) return@withStoreLock false
            repository.deleteStored(peerId)
            true
        }
    }

    fun clearAll(): Int {
        return repository.withStoreLock {
            val peers = repository.allStored()
            peers.forEach { repository.deleteStored(it.peer.peerId) }
            peers.size
        }
    }

    fun clearQuarantineExpired() {
        repository.withStoreLock {
            val now = System.currentTimeMillis()
            repository.allStored().filter { it.quarantineExpiresAt?.let { expiry -> expiry <= now } == true }
                .forEach { stored ->
                    repository.writeStored(stored.copy(
                        peer = stored.peer.copy(quarantineLevel = 0,
                            trustState = if (stored.peer.isBlocked) TrustState.BLOCKED else TrustState.DISCONNECTED),
                        quarantineReason = null,
                        quarantinedAt = null,
                        quarantineExpiresAt = null
                    ))
                }
        }
    }
}
