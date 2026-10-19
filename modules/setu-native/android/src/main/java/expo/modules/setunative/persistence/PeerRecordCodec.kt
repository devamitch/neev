package expo.modules.setunative.persistence

import expo.modules.setunative.models.Capability
import expo.modules.setunative.models.SetuPeer
import expo.modules.setunative.models.TrustState
import org.json.JSONArray
import org.json.JSONObject

internal data class StoredPeer(
    val peer: SetuPeer,
    val quarantineReason: String? = null,
    val quarantinedAt: Long? = null,
    val quarantineExpiresAt: Long? = null
)

/** Bounded versioned serialization for peer and trust metadata encrypted by SetuStore. */
internal object PeerRecordCodec {
    private const val FORMAT_VERSION = 1
    private const val MAX_RECORD_BYTES = 64 * 1024
    private const val MAX_COLLECTION_ITEMS = 128

    fun encode(record: StoredPeer): ByteArray {
        val peer = record.peer
        val json = JSONObject()
            .put("version", FORMAT_VERSION)
            .put("peerId", peer.peerId)
            .put("deviceId", peer.deviceId)
            .put("displayName", peer.displayName)
            .putNullable("deviceModel", peer.deviceModel)
            .put("platform", peer.platform)
            .put("capabilities", JSONArray(peer.capabilities.map { it.name }))
            .put("trustState", peer.trustState.name)
            .put("blocked", peer.isBlocked)
            .put("quarantineLevel", peer.quarantineLevel)
            .put("lastSeenAt", peer.lastSeenAt)
            .putNullable("sessionId", peer.sessionId)
            .putNullable("publicKey", peer.publicKey)
            .putNullable("verificationCode", peer.verificationCode)
            .putNullable("endpoint", peer.endpoint)
            .putNullable("port", peer.port)
            .putNullable("blockedAt", peer.blockedAt)
            .putNullable("reason", peer.reason)
            .putNullable("blockedUntil", peer.blockedUntil)
            .putNullable("quarantineReason", record.quarantineReason)
            .putNullable("quarantinedAt", record.quarantinedAt)
            .putNullable("quarantineExpiresAt", record.quarantineExpiresAt)
        val bytes = json.toString().toByteArray(Charsets.UTF_8)
        require(bytes.size <= MAX_RECORD_BYTES) { "Peer record exceeds its size limit" }
        return bytes
    }

    fun decode(bytes: ByteArray): StoredPeer {
        require(bytes.size in 1..MAX_RECORD_BYTES) { "Invalid peer record size" }
        val json = JSONObject(bytes.toString(Charsets.UTF_8))
        require(json.getInt("version") == FORMAT_VERSION) { "Unsupported peer record version" }
        val capabilitiesJson = json.getJSONArray("capabilities")
        require(capabilitiesJson.length() <= MAX_COLLECTION_ITEMS) { "Too many peer capabilities" }
        val capabilities = buildSet {
            for (index in 0 until capabilitiesJson.length()) {
                runCatching { Capability.valueOf(capabilitiesJson.getString(index)) }
                    .getOrNull()?.let { capability -> add(capability) }
            }
        }
        val trustState = runCatching { TrustState.valueOf(json.getString("trustState")) }
            .getOrElse { error("Invalid peer trust state") }
        val peer = SetuPeer(
            peerId = json.getString("peerId"),
            deviceId = json.getString("deviceId"),
            displayName = json.getString("displayName"),
            deviceModel = json.stringOrNull("deviceModel"),
            platform = json.getString("platform"),
            capabilities = capabilities,
            trustState = trustState,
            isBlocked = json.getBoolean("blocked"),
            quarantineLevel = json.getInt("quarantineLevel"),
            lastSeenAt = json.getLong("lastSeenAt"),
            sessionId = json.stringOrNull("sessionId"),
            publicKey = json.stringOrNull("publicKey"),
            verificationCode = json.stringOrNull("verificationCode"),
            endpoint = json.stringOrNull("endpoint"),
            port = if (json.isNull("port")) null else json.getInt("port"),
            blockedAt = json.longOrNull("blockedAt"),
            reason = json.stringOrNull("reason"),
            blockedUntil = json.longOrNull("blockedUntil")
        )
        return StoredPeer(
            peer = peer,
            quarantineReason = json.stringOrNull("quarantineReason"),
            quarantinedAt = json.longOrNull("quarantinedAt"),
            quarantineExpiresAt = json.longOrNull("quarantineExpiresAt")
        )
    }

    private fun JSONObject.putNullable(name: String, value: Any?): JSONObject =
        put(name, value ?: JSONObject.NULL)

    private fun JSONObject.stringOrNull(name: String): String? =
        if (!has(name) || isNull(name)) null else getString(name)

    private fun JSONObject.longOrNull(name: String): Long? =
        if (!has(name) || isNull(name)) null else getLong(name)
}
