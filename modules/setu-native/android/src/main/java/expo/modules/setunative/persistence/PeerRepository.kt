package expo.modules.setunative.persistence

import android.content.Context
import expo.modules.setunative.models.*
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

class PeerRepository private constructor(private val store: SetuStore) {

    companion object {
        private const val TAG = "SETU_PEER_REPO"
        internal const val TRUST_DOMAIN = "trust"
        internal const val PEER_PREFIX = "peer:"
        internal const val BLOCK_PREFIX = "block:"
        private const val MAX_PEERS = 1024

        fun create(context: Context): PeerRepository {
            val store = SetuStore.getInstance(context)
            MessageStoreMigration.migrate(context, store)
            return PeerRepository(store)
        }
    }

    private val storeLock = ReentrantLock()
    private val upsertHandler = PeerRepositoryUpsert(this)
    private val queryHandler = PeerRepositoryQuery(this)
    private val deleteHandler = PeerRepositoryDelete(this)
    private val updateHandler = PeerRepositoryUpdate(this)

    // CRUD operations
    fun upsert(peer: SetuPeer): Boolean = upsertHandler.upsert(peer)
    fun get(peerId: String): SetuPeer? = queryHandler.get(peerId)
    fun getAll(): List<SetuPeer> = queryHandler.getAll()
    fun getByTrustState(trustState: TrustState): List<SetuPeer> = queryHandler.getByTrustState(trustState)
    fun getConnected(): List<SetuPeer> = queryHandler.getConnected()
    fun getByCapability(capability: Capability): List<SetuPeer> = queryHandler.getByCapability(capability)
    fun getBlocked(): List<SetuPeer> = queryHandler.getBlocked()
    fun getQuarantined(): List<SetuPeer> = queryHandler.getQuarantined()
    fun isBlocked(peerId: String): Boolean = withStoreLock {
        blockMetadata(peerId) != null || readStored(peerId)?.peer?.isBlocked == true
    }
    fun updateTrustState(peerId: String, trustState: TrustState): Boolean = updateHandler.updateTrustState(peerId, trustState)
    fun updateSession(peerId: String, sessionId: String?, verificationCode: String?): Boolean = updateHandler.updateSession(peerId, sessionId, verificationCode)
    fun updateLastSeen(peerId: String): Boolean = updateHandler.updateLastSeen(peerId)
    fun block(peerId: String, reason: String? = null): Boolean = updateHandler.block(peerId, reason)
    fun unblock(peerId: String): Boolean = updateHandler.unblock(peerId)
    fun setBlocked(peerId: String, blocked: Boolean, reason: String? = null, expiresAt: Long? = null): Boolean =
        updateHandler.setBlocked(peerId, blocked, reason, expiresAt)
    fun updateQuarantine(peerId: String, level: Int, reason: String = "Security violation"): Boolean =
        updateHandler.updateQuarantine(peerId, level, reason)
    fun getQuarantined(peerId: String): QuarantinedPeerInfo? = queryHandler.getQuarantined(peerId)
    fun delete(peerId: String): Boolean = deleteHandler.delete(peerId)
    fun clearAll(): Int = deleteHandler.clearAll()

    internal fun <T> withStoreLock(operation: () -> T): T = storeLock.withLock(operation)

    internal fun readStored(peerId: String): StoredPeer? {
        val bytes = store.read(TRUST_DOMAIN, PEER_PREFIX + peerId) ?: return null
        return try {
            PeerRecordCodec.decode(bytes)
        } finally {
            bytes.fill(0)
        }
    }

    internal fun allStored(): List<StoredPeer> = store.ids(TRUST_DOMAIN).asSequence()
        .filter { it.startsWith(PEER_PREFIX) }
        .take(MAX_PEERS)
        .mapNotNull { readStored(it.removePrefix(PEER_PREFIX)) }
        .toList()

    internal fun writeStored(record: StoredPeer) {
        val bytes = PeerRecordCodec.encode(record)
        try {
            store.write(TRUST_DOMAIN, PEER_PREFIX + record.peer.peerId, bytes)
        } finally {
            bytes.fill(0)
        }
    }

    internal fun deleteStored(peerId: String) = store.delete(TRUST_DOMAIN, PEER_PREFIX + peerId)

    internal fun storeMarker(id: String, value: ByteArray) = store.write(TRUST_DOMAIN, id, value)

    internal fun removeMarker(id: String) = store.delete(TRUST_DOMAIN, id)

    internal fun blockMetadata(peerId: String): BlockMetadata? {
        val bytes = store.read(TRUST_DOMAIN, BLOCK_PREFIX + peerId) ?: return null
        return try {
            val json = org.json.JSONObject(bytes.toString(Charsets.UTF_8))
            val blockedUntil = json.optLong("blockedUntil", 0L).takeIf { it > 0L }
            if (blockedUntil != null && blockedUntil <= System.currentTimeMillis()) {
                store.delete(TRUST_DOMAIN, BLOCK_PREFIX + peerId)
                null
            } else BlockMetadata(
                blockedAt = json.optLong("blockedAt", 0L),
                reason = json.optString("reason").takeIf { it.isNotEmpty() },
                blockedUntil = blockedUntil
            )
        } finally {
            bytes.fill(0)
        }
    }

    internal data class BlockMetadata(val blockedAt: Long, val reason: String?, val blockedUntil: Long?)

}
