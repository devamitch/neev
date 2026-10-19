package expo.modules.setunative.persistence

import android.content.Context
import expo.modules.setunative.shared.SetuLog
import expo.modules.setunative.sharedspace.SharedSpace
import expo.modules.setunative.sharedspace.SharedSpaceOperation
import expo.modules.setunative.sharedspace.SharedSpaceOperationCodec
import expo.modules.setunative.sharedspace.Tombstone

/**
 * Shared spaces and their tombstones, stored in the encrypted append-only SetuStore.
 *
 * Space membership and delete operations are trust-bearing records, so they never go into SQLite
 * (which is limited to piece/transfer bookkeeping and the non-sensitive content index). Rows written
 * by older builds are moved across once by MessageStoreMigration, which then drops those tables —
 * reading them from SQLite afterwards was the "no such table: setu_shared_spaces" failure.
 */
class SharedSpaceRepository private constructor(private val store: SetuStore) {

    companion object {
        private const val DOMAIN = "spaces"
        private const val SPACE_PREFIX = "space:"
        private const val TOMBSTONE_PREFIX = "tombstone:"
        private const val OPERATION_PREFIX = "operation:"
        private const val MAX_SPACES = 512

        fun create(context: Context): SharedSpaceRepository {
            val store = SetuStore.getInstance(context)
            // Shared by every store-backed repository: runs once, then drops the legacy tables.
            MessageStoreMigration.migrate(context, store)
            return SharedSpaceRepository(store)
        }
    }

    // ── Spaces ──────────────────────────────────────────────────────────────────

    fun upsert(space: SharedSpace): Boolean = runCatching {
        if (get(space.spaceId) == null && countSpaces() >= MAX_SPACES) {
            error("Shared space limit reached")
        }
        val encoded = SharedSpaceRecordCodec.encode(space)
        try {
            store.write(DOMAIN, SPACE_PREFIX + space.spaceId, encoded)
        } finally {
            encoded.fill(0)
        }
        true
    }.getOrElse {
        SetuLog.e(SetuLog.STORAGE, "shared space could not be saved", it)
        false
    }

    fun get(spaceId: String): SharedSpace? = readSpace(SPACE_PREFIX + spaceId)

    fun getAll(): List<SharedSpace> = store.ids(DOMAIN)
        .filter { it.startsWith(SPACE_PREFIX) }
        .mapNotNull(::readSpace)
        .sortedByDescending { it.updatedAt }

    fun getByOwner(ownerId: String): List<SharedSpace> = getAll().filter { it.ownerId == ownerId }

    fun getByMember(memberId: String): List<SharedSpace> =
        getAll().filter { it.members.contains(memberId) || it.invitedMembers.contains(memberId) }

    fun delete(spaceId: String): Boolean = runCatching {
        if (get(spaceId) == null) return false
        store.delete(DOMAIN, SPACE_PREFIX + spaceId)
        true
    }.getOrDefault(false)

    fun updateActivity(spaceId: String, isActive: Boolean): Boolean =
        update(spaceId) { it.copy(isActive = isActive, updatedAt = System.currentTimeMillis()) }

    fun updateVersion(spaceId: String, newVersion: Long): Boolean =
        update(spaceId) { it.copy(version = newVersion, updatedAt = System.currentTimeMillis()) }

    fun addMember(spaceId: String, memberId: String): Boolean = update(spaceId) { space ->
        space.copy(
            members = space.members + memberId,
            invitedMembers = space.invitedMembers - memberId,
            version = space.version + 1,
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun removeMember(spaceId: String, memberId: String): Boolean = update(spaceId) { space ->
        space.copy(
            members = space.members - memberId,
            version = space.version + 1,
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun addInvitedMember(spaceId: String, memberId: String): Boolean = update(spaceId) { space ->
        if (space.members.contains(memberId)) return@update space
        space.copy(
            invitedMembers = space.invitedMembers + memberId,
            version = space.version + 1,
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun removeInvitedMember(spaceId: String, memberId: String): Boolean = update(spaceId) { space ->
        space.copy(
            invitedMembers = space.invitedMembers - memberId,
            version = space.version + 1,
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun updateContentInfo(spaceId: String, contentCount: Int, totalSize: Long): Boolean =
        update(spaceId) { space ->
            space.copy(
                contentCount = contentCount.coerceAtLeast(0),
                totalSize = totalSize.coerceAtLeast(0L),
                version = space.version + 1,
                updatedAt = System.currentTimeMillis(),
            )
        }

    fun searchByName(query: String, userId: String): List<SharedSpace> {
        val needle = query.trim().lowercase()
        if (needle.isEmpty()) return emptyList()
        return getByMember(userId).filter { it.name.lowercase().contains(needle) }
    }

    // ── Tombstones ──────────────────────────────────────────────────────────────

    fun saveTombstone(tombstone: Tombstone): Boolean = runCatching {
        writeTombstone(TombstoneRecordCodec.StoredTombstone(tombstone, processed = false, processedAt = null))
        true
    }.getOrElse {
        SetuLog.e(SetuLog.STORAGE, "tombstone could not be saved", it)
        false
    }

    fun getTombstone(tombstoneId: String): Tombstone? = readTombstone(TOMBSTONE_PREFIX + tombstoneId)?.tombstone

    fun getUnprocessedTombstones(spaceId: String): List<Tombstone> = store.ids(DOMAIN)
        .filter { it.startsWith(TOMBSTONE_PREFIX) }
        .mapNotNull(::readTombstone)
        .filter { !it.processed && it.tombstone.spaceId == spaceId }
        .map { it.tombstone }
        .sortedBy { it.createdAt }

    fun markTombstoneProcessed(tombstoneId: String): Boolean = runCatching {
        val stored = readTombstone(TOMBSTONE_PREFIX + tombstoneId) ?: return false
        writeTombstone(stored.copy(processed = true, processedAt = System.currentTimeMillis()))
        true
    }.getOrDefault(false)

    internal fun saveOperation(operation: SharedSpaceOperation): Boolean = runCatching {
        val key = operationKey(operation.spaceId, operation.operationId)
        if (store.read(DOMAIN, key) != null) return true
        val encoded = SharedSpaceOperationCodec.encode(operation)
        try {
            store.write(DOMAIN, key, encoded)
        } finally {
            encoded.fill(0)
        }
        true
    }.getOrElse {
        SetuLog.e(SetuLog.STORAGE, "shared-space operation could not be saved", it)
        false
    }

    internal fun getOperations(spaceId: String): List<SharedSpaceOperation> = store.ids(DOMAIN)
        .filter { it.startsWith(operationPrefix(spaceId)) }
        .mapNotNull { id ->
            runCatching { store.read(DOMAIN, id)?.let(SharedSpaceOperationCodec::decode) }
                .getOrElse {
                    SetuLog.w(SetuLog.STORAGE, "unreadable shared-space operation skipped")
                    null
                }
        }
        .sortedWith(compareBy<SharedSpaceOperation> { it.version }.thenBy { it.actorId }.thenBy { it.operationId })

    internal fun getUnacknowledgedOperations(spaceId: String, memberId: String): List<SharedSpaceOperation> =
        getOperations(spaceId).filter { it.applied && memberId !in it.acknowledgedBy }

    internal fun acknowledgeOperation(spaceId: String, operationId: String, memberId: String): Boolean = runCatching {
        val key = operationKey(spaceId, operationId)
        val stored = store.read(DOMAIN, key)?.let(SharedSpaceOperationCodec::decode) ?: return false
        if (memberId in stored.acknowledgedBy) return true
        val encoded = SharedSpaceOperationCodec.encode(stored.copy(acknowledgedBy = stored.acknowledgedBy + memberId))
        try {
            store.write(DOMAIN, key, encoded)
        } finally {
            encoded.fill(0)
        }
        true
    }.getOrElse {
        SetuLog.e(SetuLog.STORAGE, "shared-space acknowledgement could not be saved", it)
        false
    }

    internal fun markOperationApplied(spaceId: String, operationId: String): Boolean = runCatching {
        val key = operationKey(spaceId, operationId)
        val stored = store.read(DOMAIN, key)?.let(SharedSpaceOperationCodec::decode) ?: return false
        if (stored.applied) return true
        val encoded = SharedSpaceOperationCodec.encode(stored.copy(applied = true))
        try {
            store.write(DOMAIN, key, encoded)
        } finally {
            encoded.fill(0)
        }
        true
    }.getOrElse {
        SetuLog.e(SetuLog.STORAGE, "shared-space operation state could not be saved", it)
        false
    }

    fun getStats(): Map<String, Any> {
        val spaces = getAll()
        return mapOf(
            "totalSpaces" to spaces.size,
            "activeSpaces" to spaces.count { it.isActive },
            "totalContent" to spaces.sumOf { it.contentCount },
            "totalSize" to spaces.sumOf { it.totalSize },
        )
    }

    // ── Internals ───────────────────────────────────────────────────────────────

    private fun update(spaceId: String, transform: (SharedSpace) -> SharedSpace): Boolean {
        val current = get(spaceId) ?: return false
        return upsert(transform(current))
    }

    private fun countSpaces(): Int = store.ids(DOMAIN).count { it.startsWith(SPACE_PREFIX) }

    private fun operationPrefix(spaceId: String) = OPERATION_PREFIX + spaceId + ":"

    private fun operationKey(spaceId: String, operationId: String) = operationPrefix(spaceId) + operationId

    private fun readSpace(id: String): SharedSpace? = runCatching {
        store.read(DOMAIN, id)?.let(SharedSpaceRecordCodec::decode)
    }.getOrElse {
        SetuLog.w(SetuLog.STORAGE, "unreadable shared-space record skipped")
        null
    }

    private fun readTombstone(id: String): TombstoneRecordCodec.StoredTombstone? = runCatching {
        store.read(DOMAIN, id)?.let(TombstoneRecordCodec::decode)
    }.getOrElse {
        SetuLog.w(SetuLog.STORAGE, "unreadable tombstone record skipped")
        null
    }

    private fun writeTombstone(stored: TombstoneRecordCodec.StoredTombstone) {
        val encoded = TombstoneRecordCodec.encode(stored)
        try {
            store.write(DOMAIN, TOMBSTONE_PREFIX + stored.tombstone.tombstoneId, encoded)
        } finally {
            encoded.fill(0)
        }
    }
}
