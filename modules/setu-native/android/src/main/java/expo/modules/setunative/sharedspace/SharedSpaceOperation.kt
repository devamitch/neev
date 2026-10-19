package expo.modules.setunative.sharedspace

import org.json.JSONArray
import org.json.JSONObject

internal enum class SharedSpaceOperationType {
    ADD_CONTENT,
    REMOVE_CONTENT,
}

internal data class SharedSpaceOperation(
    val operationId: String,
    val spaceId: String,
    val contentId: String,
    val actorId: String,
    val type: SharedSpaceOperationType,
    val version: Long,
    val createdAt: Long,
    val epochId: String?,
    val contentType: String,
    val name: String,
    val mimeType: String,
    val size: Long,
    val contentCreatedAt: Long,
    val contentModifiedAt: Long,
    val contentOwnerId: String,
    val manifestId: String?,
    val acknowledgedBy: Set<String> = emptySet(),
    val applied: Boolean = false,
)

internal object SharedSpaceOperationCodec {
    private const val FORMAT_VERSION = 1
    private const val MAX_RECORD_BYTES = 16 * 1024
    private const val MAX_MEMBERS = 1024

    fun encode(operation: SharedSpaceOperation): ByteArray {
        val json = JSONObject()
            .put("formatVersion", FORMAT_VERSION)
            .put("operationId", operation.operationId)
            .put("spaceId", operation.spaceId)
            .put("contentId", operation.contentId)
            .put("actorId", operation.actorId)
            .put("type", operation.type.name)
            .put("version", operation.version)
            .put("createdAt", operation.createdAt)
            .putNullable("epochId", operation.epochId)
            .put("contentType", operation.contentType)
            .put("name", operation.name)
            .put("mimeType", operation.mimeType)
            .put("size", operation.size)
            .put("contentCreatedAt", operation.contentCreatedAt)
            .put("contentModifiedAt", operation.contentModifiedAt)
            .put("contentOwnerId", operation.contentOwnerId)
            .putNullable("manifestId", operation.manifestId)
            .put("acknowledgedBy", JSONArray(operation.acknowledgedBy.toList()))
            .put("applied", operation.applied)
        return json.toString().toByteArray(Charsets.UTF_8).also {
            require(it.size <= MAX_RECORD_BYTES) { "Shared-space operation exceeds its size limit" }
        }
    }

    fun decode(bytes: ByteArray): SharedSpaceOperation {
        require(bytes.size in 1..MAX_RECORD_BYTES) { "Invalid shared-space operation size" }
        val json = JSONObject(bytes.toString(Charsets.UTF_8))
        require(json.getInt("formatVersion") == FORMAT_VERSION) { "Unsupported shared-space operation version" }
        val acknowledgements = json.getJSONArray("acknowledgedBy")
        require(acknowledgements.length() <= MAX_MEMBERS) { "Too many operation acknowledgements" }
        return SharedSpaceOperation(
            operationId = json.getString("operationId"),
            spaceId = json.getString("spaceId"),
            contentId = json.getString("contentId"),
            actorId = json.getString("actorId"),
            type = SharedSpaceOperationType.valueOf(json.getString("type")),
            version = json.getLong("version"),
            createdAt = json.getLong("createdAt"),
            epochId = json.stringOrNull("epochId"),
            contentType = json.getString("contentType"),
            name = json.getString("name"),
            mimeType = json.getString("mimeType"),
            size = json.getLong("size"),
            contentCreatedAt = json.getLong("contentCreatedAt"),
            contentModifiedAt = json.getLong("contentModifiedAt"),
            contentOwnerId = json.getString("contentOwnerId"),
            manifestId = json.stringOrNull("manifestId"),
            acknowledgedBy = buildSet {
                for (index in 0 until acknowledgements.length()) add(acknowledgements.getString(index))
            },
            applied = json.optBoolean("applied", false),
        )
    }

    private fun JSONObject.putNullable(name: String, value: String?): JSONObject =
        put(name, value ?: JSONObject.NULL)

    private fun JSONObject.stringOrNull(name: String): String? =
        if (!has(name) || isNull(name)) null else getString(name)
}