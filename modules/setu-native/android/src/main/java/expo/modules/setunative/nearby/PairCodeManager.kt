package expo.modules.setunative.nearby

import android.util.Base64
import expo.modules.setunative.security.CryptoIdentityManager
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * Short-lived pairing codes for nearby introduction (same trust path as NFC).
 */
object PairCodeManager {
    private const val CODE_TTL_MS = 120_000L
    private const val MAX_ATTEMPTS_PER_MINUTE = 8
    private val random = SecureRandom()
    private val activeCodes = ConcurrentHashMap<String, ActiveCode>()
    private val redeemAttempts = ConcurrentHashMap<String, MutableList<Long>>()

    data class ActiveCode(
        val code: String,
        val publicKey: String,
        val peerId: String,
        val expiresAt: Long,
    )

    data class RedeemResult(
        val peerId: String,
        val publicKey: String,
        val host: String,
        val port: Int,
        val name: String,
    )

    @Synchronized
    fun createCode(): Map<String, Any> {
        val identity = CryptoIdentityManager.getOrCreate()
        val code = (100_000 + random.nextInt(900_000)).toString()
        val expiresAt = System.currentTimeMillis() + CODE_TTL_MS
        activeCodes[code] = ActiveCode(code, identity.publicKeyB64, identity.deviceId, expiresAt)
        purgeExpired()
        return mapOf("code" to code, "expiresAt" to expiresAt, "peerId" to identity.deviceId)
    }

    fun stopCode(code: String) {
        activeCodes.remove(code)
    }

    fun activeCodeValue(): String? {
        purgeExpired()
        return activeCodes.values.firstOrNull()?.code
    }

    internal fun redeem(code: String, discovery: DiscoveryManager): Map<String, Any> {
        if (!rateLimit(code)) {
            return mapOf("error" to "RATE_LIMITED")
        }
        purgeExpired()
        val normalized = code.trim()
        if (!normalized.matches(Regex("^\\d{6}$"))) {
            return mapOf("error" to "INVALID_CODE")
        }
        val peer = discovery.findPeerByPairCode(normalized)
            ?: return mapOf("error" to "PEER_NOT_FOUND")
        val localId = CryptoIdentityManager.getOrCreate().deviceId
        if (peer.id == localId) {
            return mapOf("error" to "SELF_PAIR")
        }
        if (peer.publicKey.isBlank()) {
            return mapOf("error" to "PEER_INCOMPLETE")
        }
        val signed = CryptoIdentityManager.sign(
            "SETU-PAIR-CODE-V1\u0000$normalized\u0000${peer.id}".toByteArray(Charsets.UTF_8)
        )
        return mapOf(
            "peerId" to peer.id,
            "publicKey" to peer.publicKey,
            "host" to peer.host,
            "port" to peer.port,
            "name" to peer.name,
            "introductionSignature" to signed,
            "expiresAt" to (System.currentTimeMillis() + CODE_TTL_MS),
        )
    }

    fun verifyIntroduction(code: String, peerId: String, publicKey: String, signature: String): Boolean {
        return try {
            val payload = "SETU-PAIR-CODE-V1\u0000$code\u0000$peerId".toByteArray(Charsets.UTF_8)
            CryptoIdentityManager.verify(payload, signature, publicKey)
        } catch (_: Exception) {
            false
        }
    }

    private fun rateLimit(code: String): Boolean {
        val now = System.currentTimeMillis()
        val window = redeemAttempts.getOrPut(code) { mutableListOf() }
        synchronized(window) {
            window.removeAll { now - it > 60_000L }
            if (window.size >= MAX_ATTEMPTS_PER_MINUTE) return false
            window.add(now)
        }
        return true
    }

    private fun purgeExpired() {
        val now = System.currentTimeMillis()
        activeCodes.entries.removeIf { it.value.expiresAt <= now }
    }
}
