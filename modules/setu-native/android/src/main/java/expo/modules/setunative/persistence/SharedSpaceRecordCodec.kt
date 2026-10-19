package expo.modules.setunative.persistence

import expo.modules.setunative.sharedspace.SharedSpace
import org.json.JSONArray
import org.json.JSONObject

internal object SharedSpaceRecordCodec {
    private const val FORMAT_VERSION = 1
    private const val MAX_RECORD_BYTES = 64 * 1024
    private const val MAX_MEMBERS = 1024

    fun encode(space: SharedSpace): ByteArray {
        val json = JSONObject()
            .put("version", FORMAT_VERSION)
            .put("spaceId", space.spaceId)
            .put("name", space.name)
            .put("ownerId", space.ownerId)
            .put("createdAt", space.createdAt)
            .put("updatedAt", space.updatedAt)
            .put("members", JSONArray(space.members.toList()))
            .put("invitedMembers", JSONArray(space.invitedMembers.toList()))
            .put("isEncrypted", space.isEncrypted)
            .put("sizeLimit", space.sizeLimit)
            .put("contentLimit", space.contentLimit)
            .put("contentCount", space.contentCount)
            .put("totalSize", space.totalSize)
            .put("spaceVersion", space.version)
            .putNullable("encryptionKeyId", space.encryptionKeyId)
            .put("isActive", space.isActive)
        return json.toString().toByteArray(Charsets.UTF_8).also {
            require(it.size <= MAX_RECORD_BYTES) { "Shared space record exceeds its size limit" }
        }
    }

    fun decode(bytes: ByteArray): SharedSpace {
        require(bytes.size in 1..MAX_RECORD_BYTES) { "Invalid shared space record size" }
        val json = JSONObject(bytes.toString(Charsets.UTF_8))
        require(json.getInt("version") == FORMAT_VERSION) { "Unsupported shared space record version" }
        return SharedSpace(
            spaceId = json.getString("spaceId"),
            name = json.getString("name"),
            ownerId = json.getString("ownerId"),
            createdAt = json.getLong("createdAt"),
            updatedAt = json.getLong("updatedAt"),
            members = json.readMembers("members"),
            invitedMembers = json.readMembers("invitedMembers"),
            isEncrypted = json.getBoolean("isEncrypted"),
            sizeLimit = json.getLong("sizeLimit"),
            contentLimit = json.getInt("contentLimit"),
            contentCount = json.getInt("contentCount"),
            totalSize = json.getLong("totalSize"),
            version = json.getLong("spaceVersion"),
            encryptionKeyId = json.stringOrNull("encryptionKeyId"),
            isActive = json.getBoolean("isActive")
        )
    }

    private fun JSONObject.readMembers(name: String): Set<String> {
        val values = getJSONArray(name)
        require(values.length() <= MAX_MEMBERS) { "Too many shared space members" }
        return buildSet { for (index in 0 until values.length()) add(values.getString(index)) }
    }

    private fun JSONObject.putNullable(name: String, value: Any?): JSONObject = put(name, value ?: JSONObject.NULL)

    private fun JSONObject.stringOrNull(name: String): String? =
        if (!has(name) || isNull(name)) null else getString(name)
}
