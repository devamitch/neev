package expo.modules.setunative.persistence

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.Capability
import expo.modules.setunative.models.SetuPeer
import expo.modules.setunative.models.TrustState
import org.json.JSONObject

internal object PeerStoreMigration {
    private const val PEER_PREFIX = "peer:"

    fun migrate(database: SQLiteDatabase, store: SetuStore) {
        migratePeers(database, store, "peers")
        migratePeers(database, store, "setu_peers")
        migrateBlocks(database, store)
        migrateQuarantines(database, store)
        migrateContentAccess(database, store)
    }

    private fun migratePeers(database: SQLiteDatabase, store: SetuStore, table: String) {
        if (!tableExists(database, table)) return
        database.query(table, null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val peerId = cursor.string("peer_id") ?: continue
                val blocked = cursor.int("is_blocked") == 1
                val peer = SetuPeer(
                    peerId = peerId,
                    deviceId = cursor.string("device_id") ?: peerId,
                    displayName = cursor.string("display_name") ?: "Nearby device",
                    deviceModel = cursor.string("device_model"),
                    platform = cursor.string("platform") ?: "unknown",
                    capabilities = cursor.string("capabilities")?.split(",")
                        ?.mapNotNull { runCatching { Capability.valueOf(it) }.getOrNull() }?.toSet().orEmpty(),
                    trustState = cursor.string("trust_state")?.let {
                        runCatching { TrustState.valueOf(it) }.getOrNull()
                    } ?: if (blocked) TrustState.BLOCKED else TrustState.DISCOVERED,
                    isBlocked = blocked,
                    quarantineLevel = cursor.int("quarantine_level") ?: 0,
                    lastSeenAt = cursor.long("last_seen_at") ?: 0L,
                    sessionId = cursor.string("session_id"),
                    publicKey = cursor.string("public_key"),
                    verificationCode = cursor.string("verification_code"),
                    endpoint = cursor.string("endpoint"),
                    port = cursor.int("port")
                )
                val encoded = PeerRecordCodec.encode(StoredPeer(
                    peer = peer,
                    quarantineReason = cursor.string("quarantine_reason"),
                    quarantinedAt = cursor.long("quarantined_at"),
                    quarantineExpiresAt = cursor.long("quarantine_expires_at")
                ))
                try {
                    store.write("trust", PEER_PREFIX + peerId, encoded)
                } finally {
                    encoded.fill(0)
                }
            }
        }
    }

    private fun migrateBlocks(database: SQLiteDatabase, store: SetuStore) {
        if (!tableExists(database, "setu_blocked_peers")) return
        database.query("setu_blocked_peers", null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val peerId = cursor.string("peer_id") ?: continue
                val encoded = JSONObject()
                    .put("blockedAt", cursor.long("blocked_at") ?: 0L)
                    .put("reason", cursor.string("reason") ?: JSONObject.NULL)
                    .toString().toByteArray(Charsets.UTF_8)
                try {
                    store.write("trust", "block:$peerId", encoded)
                } finally {
                    encoded.fill(0)
                }
            }
        }
    }

    private fun migrateQuarantines(database: SQLiteDatabase, store: SetuStore) {
        if (!tableExists(database, "setu_quarantined_peers")) return
        database.query("setu_quarantined_peers", null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val peerId = cursor.string("peer_id") ?: continue
                val currentBytes = store.read("trust", PEER_PREFIX + peerId)
                val current = try {
                    currentBytes?.let(PeerRecordCodec::decode)
                } finally {
                    currentBytes?.fill(0)
                }
                val level = cursor.int("quarantine_level") ?: 1
                val violatedAt = cursor.long("last_violation_at") ?: 0L
                val reason = cursor.string("violations")
                val peer = current?.peer ?: SetuPeer(
                    peerId = peerId,
                    deviceId = peerId,
                    displayName = "Nearby device",
                    deviceModel = null,
                    platform = "unknown"
                )
                val quarantined = (current ?: StoredPeer(peer)).copy(
                    peer = peer.copy(
                        quarantineLevel = level,
                        trustState = if (peer.isBlocked) TrustState.BLOCKED else TrustState.QUARANTINED,
                        lastSeenAt = maxOf(peer.lastSeenAt, violatedAt),
                        reason = reason
                    ),
                    quarantineReason = reason,
                    quarantinedAt = violatedAt,
                    quarantineExpiresAt = cursor.long("expires_at")
                )
                val encoded = PeerRecordCodec.encode(quarantined)
                try {
                    store.write("trust", PEER_PREFIX + peerId, encoded)
                } finally {
                    encoded.fill(0)
                }
            }
        }
    }

    private fun migrateContentAccess(database: SQLiteDatabase, store: SetuStore) {
        if (!tableExists(database, "setu_content_access")) return
        database.query("setu_content_access", null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val accessId = cursor.string("access_id") ?: continue
                val record = JSONObject()
                for (index in 0 until cursor.columnCount) {
                    record.put(cursor.getColumnName(index), if (cursor.isNull(index)) JSONObject.NULL else cursor.getString(index))
                }
                val encoded = record.toString().toByteArray(Charsets.UTF_8)
                try {
                    store.write("trust", "content-access:$accessId", encoded)
                } finally {
                    encoded.fill(0)
                }
            }
        }
    }

    private fun tableExists(database: SQLiteDatabase, table: String): Boolean =
        database.rawQuery("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", arrayOf(table))
            .use { it.moveToFirst() }

    private fun Cursor.string(column: String): String? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getString(index)
    }

    private fun Cursor.int(column: String): Int? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getInt(index)
    }

    private fun Cursor.long(column: String): Long? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getLong(index)
    }
}
