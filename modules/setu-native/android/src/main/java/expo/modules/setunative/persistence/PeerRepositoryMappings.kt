package expo.modules.setunative.persistence

import android.database.Cursor
import expo.modules.setunative.models.*

internal object PeerRepositoryMappings {

    fun mapPeer(cursor: Cursor): SetuPeer {
        val peerId = cursor.getString(cursor.getColumnIndexOrThrow("peer_id"))
        val deviceId = cursor.getStringOrNull(cursor.getColumnIndex("device_id"))
        val displayName = cursor.getStringOrNull(cursor.getColumnIndex("display_name")) ?: "Nearby device"
        val deviceModel = cursor.getStringOrNull(cursor.getColumnIndex("device_model"))
        val platform = cursor.getStringOrNull(cursor.getColumnIndex("platform")) ?: "unknown"
        val capabilitiesStr = cursor.getStringOrNull(cursor.getColumnIndex("capabilities")) ?: ""
        val trustStateStr = cursor.getStringOrNull(cursor.getColumnIndex("trust_state")) ?: "DISCOVERED"
        val isBlocked = cursor.getIntOrNull(cursor.getColumnIndex("is_blocked")) ?: 0
        val quarantineLevel = cursor.getIntOrNull(cursor.getColumnIndex("quarantine_level")) ?: 0
        val lastSeenAt = cursor.getLongOrNull(cursor.getColumnIndex("last_seen_at")) ?: System.currentTimeMillis()
        val sessionId = cursor.getStringOrNull(cursor.getColumnIndex("session_id"))
        val publicKey = cursor.getStringOrNull(cursor.getColumnIndex("public_key"))
        val verificationCode = cursor.getStringOrNull(cursor.getColumnIndex("verification_code"))
        val endpoint = cursor.getStringOrNull(cursor.getColumnIndex("endpoint"))
        val port = cursor.getIntOrNull(cursor.getColumnIndex("port")) ?: 0

        val capabilities = if (capabilitiesStr.isNotBlank()) {
            capabilitiesStr.split(",").mapNotNull {
                try { Capability.valueOf(it) } catch (_: Exception) { null }
            }
        } else emptySet()

        val trustState = try { TrustState.valueOf(trustStateStr) } catch (_: Exception) { TrustState.DISCOVERED }

        return SetuPeer(
            peerId = peerId,
            deviceId = deviceId ?: peerId,
            displayName = displayName,
            deviceModel = deviceModel,
            platform = platform,
            capabilities = capabilities.toSet(),
            trustState = trustState,
            isBlocked = isBlocked == 1,
            quarantineLevel = quarantineLevel,
            lastSeenAt = lastSeenAt,
            sessionId = sessionId,
            publicKey = publicKey,
            verificationCode = verificationCode,
            endpoint = endpoint,
            port = port
        )
    }

    fun mapQuarantinedPeer(cursor: Cursor): QuarantinedPeerInfo {
        val peerId = cursor.getString(cursor.getColumnIndexOrThrow("peer_id"))
        val level = cursor.getIntOrNull(cursor.getColumnIndex("quarantine_level")) ?: 0
        val reason = cursor.getStringOrNull(cursor.getColumnIndex("quarantine_reason"))
        val quarantinedAt = cursor.getLongOrNull(cursor.getColumnIndex("quarantined_at"))
        val expiresAt = cursor.getLongOrNull(cursor.getColumnIndex("quarantine_expires_at"))

        return QuarantinedPeerInfo(
            peerId = peerId,
            level = level,
            reason = reason,
            quarantinedAt = quarantinedAt,
            expiresAt = expiresAt
        )
    }

    fun Cursor.getStringOrNull(columnIndex: Int): String? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getString(columnIndex) else null
    }

    fun Cursor.getIntOrNull(columnIndex: Int): Int? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getInt(columnIndex) else null
    }

    fun Cursor.getLongOrNull(columnIndex: Int): Long? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getLong(columnIndex) else null
    }

    fun toCapabilitiesString(capabilities: List<Capability>): String {
        return capabilities.joinToString(",") { it.name }
    }
}
