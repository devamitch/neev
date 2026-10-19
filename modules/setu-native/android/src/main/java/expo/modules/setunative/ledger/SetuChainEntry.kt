package expo.modules.setunative.ledger

import expo.modules.setunative.security.CryptoIdentityManager
import org.json.JSONObject
import java.security.MessageDigest

internal data class SetuChainEntry(
    val entryId: String,
    val deviceId: String,
    val publicKey: String,
    val lamport: Long,
    val previousHash: String,
    val operation: String,
    val payload: String,
    val createdAt: Long,
    val hash: String,
    val signature: String
) {
    fun encode(): ByteArray = JSONObject()
        .put("entryId", entryId)
        .put("deviceId", deviceId)
        .put("publicKey", publicKey)
        .put("lamport", lamport)
        .put("previousHash", previousHash)
        .put("operation", operation)
        .put("payload", payload)
        .put("createdAt", createdAt)
        .put("hash", hash)
        .put("signature", signature)
        .toString().toByteArray(Charsets.UTF_8)

    fun verify(): Boolean = try {
        val canonical = canonical(publicKey, lamport, previousHash, operation, payload, createdAt)
        val digest = sha256(canonical)
        digest == hash && CryptoIdentityManager.verify(canonical.toByteArray(), signature, publicKey)
    } catch (_: Exception) {
        false
    }

    companion object {
        fun create(operation: String, payload: String, previousHash: String, lamport: Long): SetuChainEntry {
            val identity = CryptoIdentityManager.getOrCreate()
            val createdAt = System.currentTimeMillis()
            val canonical = canonical(identity.publicKeyB64, lamport, previousHash, operation, payload, createdAt)
            val bytes = canonical.toByteArray(Charsets.UTF_8)
            return SetuChainEntry(
                entryId = sha256(canonical).take(32),
                deviceId = identity.deviceId,
                publicKey = identity.publicKeyB64,
                lamport = lamport,
                previousHash = previousHash,
                operation = operation,
                payload = payload,
                createdAt = createdAt,
                hash = sha256(canonical),
                signature = CryptoIdentityManager.sign(bytes)
            )
        }

        private fun canonical(device: String, lamport: Long, previous: String, operation: String, payload: String, createdAt: Long) =
            listOf(device, lamport, previous, operation, payload, createdAt).joinToString("\u001f")

        private fun sha256(value: String): String = sha256(value.toByteArray(Charsets.UTF_8))

        private fun sha256(value: ByteArray): String =
            MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it) }
    }
}
