package expo.modules.setunative.persistence

import expo.modules.setunative.sharedspace.OperationType
import expo.modules.setunative.sharedspace.Tombstone
import org.json.JSONObject

/** Tombstones are shared-space operations; they are stored encrypted in SetuStore, never in SQLite. */
internal object TombstoneRecordCodec {
    private const val FORMAT_VERSION = 1
    private const val MAX_RECORD_BYTES = 8 * 1024

    data class StoredTombstone(
        val tombstone: Tombstone,
        val processed: Boolean,
        val processedAt: Long?,
    )

    fun encode(stored: StoredTombstone): ByteArray {
        val t = stored.tombstone
        val json = JSONObject()
            .put("version", FORMAT_VERSION)
            .put("tombstoneId", t.tombstoneId)
            .put("spaceId", t.spaceId)
            .put("contentId", t.contentId)
            .put("creatorId", t.creatorId)
            .put("operationType", t.operationType.name)
            .put("createdAt", t.createdAt)
            .put("tombstoneVersion", t.version)
            .put("processed", stored.processed)
            .put("processedAt", stored.processedAt ?: JSONObject.NULL)
        return json.toString().toByteArray(Charsets.UTF_8).also {
            require(it.size <= MAX_RECORD_BYTES) { "Tombstone record exceeds its size limit" }
        }
    }

    fun decode(bytes: ByteArray): StoredTombstone {
        require(bytes.size in 1..MAX_RECORD_BYTES) { "Invalid tombstone record size" }
        val json = JSONObject(bytes.toString(Charsets.UTF_8))
        require(json.getInt("version") == FORMAT_VERSION) { "Unsupported tombstone record version" }
        val operation = runCatching { OperationType.valueOf(json.getString("operationType")) }
            .getOrElse { error("Unsupported tombstone operation") }
        return StoredTombstone(
            tombstone = Tombstone(
                tombstoneId = json.getString("tombstoneId"),
                spaceId = json.getString("spaceId"),
                contentId = json.getString("contentId"),
                creatorId = json.getString("creatorId"),
                operationType = operation,
                createdAt = json.getLong("createdAt"),
                version = json.getLong("tombstoneVersion"),
            ),
            processed = json.optBoolean("processed", false),
            processedAt = if (json.isNull("processedAt")) null else json.getLong("processedAt"),
        )
    }
}
