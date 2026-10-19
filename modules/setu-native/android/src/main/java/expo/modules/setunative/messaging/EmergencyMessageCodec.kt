package expo.modules.setunative.messaging

import org.json.JSONObject

object EmergencyMessageCodec {
    private const val MAX_PAYLOAD_BYTES = 16 * 1024
    private const val MAX_CONTENT_CHARS = 8 * 1024
    private const val MAX_CONTENT_BYTES = 8 * 1024
    private const val MIN_TTL_MS = 60 * 1000L
    private const val MAX_TTL_MS = 24 * 60 * 60 * 1000L
    private const val MAX_HOP_LIMIT = 5
    private const val KIND = "setu.emergency.v1"
    private val categories = setOf("SAFETY", "MEDICAL", "FIRE", "FLOOD", "GENERAL")

    fun encode(message: EmergencyMessage): ByteArray {
        validate(message)
        val payload = JSONObject()
            .put("kind", KIND)
            .put("broadcastId", message.broadcastId)
            .put("originId", message.originId)
            .put("content", message.content)
            .put("category", message.category)
            .put("createdAt", message.createdAt)
            .put("expiresAt", message.expiresAt)
            .put("hopLimit", message.hopLimit)
            .put("hopCount", message.hopCount)
            .toString()
            .toByteArray(Charsets.UTF_8)
        require(payload.size <= MAX_PAYLOAD_BYTES) { "EMERGENCY_PAYLOAD_TOO_LARGE" }
        return payload
    }

    fun decode(payload: ByteArray): EmergencyMessage? {
        if (payload.isEmpty() || payload.size > MAX_PAYLOAD_BYTES) return null
        return try {
            val json = JSONObject(payload.toString(Charsets.UTF_8))
            if (json.getString("kind") != KIND) return null
            EmergencyMessage(
                broadcastId = json.getString("broadcastId"),
                originId = json.getString("originId"),
                content = json.getString("content"),
                category = json.getString("category"),
                createdAt = json.getLong("createdAt"),
                expiresAt = json.getLong("expiresAt"),
                hopLimit = json.getInt("hopLimit"),
                hopCount = json.getInt("hopCount")
            ).also(::validate)
        } catch (_: Exception) {
            null
        }
    }

    private fun validate(message: EmergencyMessage) {
        require(message.broadcastId.length in 1..128) { "EMERGENCY_ID_INVALID" }
        require(message.originId.matches(Regex("[0-9a-f]{32}"))) { "EMERGENCY_ORIGIN_INVALID" }
        require(message.content.length in 1..MAX_CONTENT_CHARS) { "EMERGENCY_CONTENT_INVALID" }
        require(message.content.toByteArray(Charsets.UTF_8).size <= MAX_CONTENT_BYTES) { "EMERGENCY_CONTENT_TOO_LARGE" }
        require(message.category in categories) { "EMERGENCY_CATEGORY_INVALID" }
        require(message.createdAt > 0 && message.expiresAt > message.createdAt) { "EMERGENCY_TIME_INVALID" }
        require(message.expiresAt - message.createdAt in MIN_TTL_MS..MAX_TTL_MS) { "EMERGENCY_TTL_INVALID" }
        require(message.hopLimit in 1..MAX_HOP_LIMIT && message.hopCount in 0..message.hopLimit) { "EMERGENCY_HOPS_INVALID" }
    }
}
