package expo.modules.setunative.persistence

import expo.modules.setunative.models.*

internal class PeerRepositoryQuery(private val repository: PeerRepository) {

    fun get(peerId: String): SetuPeer? = repository.withStoreLock { repository.readStored(peerId)?.peer }

    fun getAll(): List<SetuPeer> = repository.withStoreLock { repository.allStored().map { it.peer } }

    fun getByTrustState(trustState: TrustState): List<SetuPeer> {
        return repository.withStoreLock { repository.allStored().map { it.peer }.filter { it.trustState == trustState } }
    }

    fun getConnected(): List<SetuPeer> {
        return repository.withStoreLock { repository.allStored().map { it.peer }.filter { !it.sessionId.isNullOrBlank() } }
    }

    fun getByCapability(capability: Capability): List<SetuPeer> {
        return repository.withStoreLock { repository.allStored().map { it.peer }.filter { capability in it.capabilities } }
    }

    fun getBlocked(): List<SetuPeer> = repository.withStoreLock {
        repository.allStored().mapNotNull { stored ->
            val metadata = repository.blockMetadata(stored.peer.peerId)
            if (!stored.peer.isBlocked && metadata == null) null else stored.peer.copy(
                isBlocked = true,
                blockedAt = metadata?.blockedAt ?: stored.peer.blockedAt,
                reason = metadata?.reason ?: stored.peer.reason,
                blockedUntil = metadata?.blockedUntil ?: stored.peer.blockedUntil
            )
        }
    }

    fun getQuarantined(): List<SetuPeer> = repository.withStoreLock {
        repository.allStored().map { it.peer }.filter { it.quarantineLevel > 0 }
    }

    fun getQuarantined(peerId: String): QuarantinedPeerInfo? {
        val stored = repository.withStoreLock { repository.readStored(peerId) } ?: return null
        val peer = stored.peer
        if (peer.quarantineLevel <= 0) return null
        return QuarantinedPeerInfo(peerId, peer.quarantineLevel, stored.quarantineReason ?: peer.reason,
            stored.quarantinedAt, stored.quarantineExpiresAt)
    }
}
