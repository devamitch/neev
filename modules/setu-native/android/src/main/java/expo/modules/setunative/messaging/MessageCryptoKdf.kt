package expo.modules.setunative.messaging

import android.util.Base64
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

internal object MessageCryptoKdf {
    private const val HMAC = "HmacSHA256"
    private const val CIPHER = "AES/GCM/NoPadding"
    private const val NONCE_BYTES = 12
    private const val TAG_BITS = 128
    private const val MAX_PLAINTEXT = 1024 * 1024
    private const val PADDING_BUCKET = 256
    private val random = SecureRandom()

    data class Envelope(
        val messageId: String,
        val senderId: String,
        val recipientId: String,
        val counter: Long,
        val ciphertext: ByteArray,
        val nonce: ByteArray,
        val signature: String
    )

    fun hkdf(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int = 32): ByteArray {
        require(length in 1..64 * 1024)
        val extract = Mac.getInstance(HMAC).apply {
            init(SecretKeySpec(salt.copyOf(), HMAC))
        }.doFinal(ikm)
        val output = ByteArray(length)
        var previous = ByteArray(0)
        var offset = 0
        var block = 1
        while (offset < length) {
            val expand = Mac.getInstance(HMAC).apply {
                init(SecretKeySpec(extract, HMAC))
                update(previous)
                update(info)
                update(block.toByte())
            }
            previous = expand.doFinal()
            val count = minOf(previous.size, length - offset)
            previous.copyInto(output, offset, 0, count)
            offset += count
            block++
        }
        extract.fill(0)
        previous.fill(0)
        return output
    }

    fun encrypt(key: ByteArray, senderId: String, recipientId: String, counter: Long, plaintext: ByteArray): Pair<ByteArray, ByteArray> {
        require(plaintext.size <= MAX_PLAINTEXT)
        val nonce = ByteArray(NONCE_BYTES).also(random::nextBytes)
        val cipher = Cipher.getInstance(CIPHER)
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
        cipher.updateAAD(aad(senderId, recipientId, counter))
        return cipher.doFinal(pad(plaintext)) to nonce
    }

    fun decrypt(key: ByteArray, senderId: String, recipientId: String, counter: Long, ciphertext: ByteArray, nonce: ByteArray): ByteArray {
        require(nonce.size == NONCE_BYTES)
        val cipher = Cipher.getInstance(CIPHER)
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
        cipher.updateAAD(aad(senderId, recipientId, counter))
        return unpad(cipher.doFinal(ciphertext))
    }

    fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP)

    private fun aad(senderId: String, recipientId: String, counter: Long): ByteArray =
        ByteBuffer.allocate(8).putLong(counter).array() +
            senderId.toByteArray(Charsets.UTF_8) + recipientId.toByteArray(Charsets.UTF_8)

    private fun pad(value: ByteArray): ByteArray {
        val target = ((value.size / PADDING_BUCKET) + 1) * PADDING_BUCKET
        return ByteArray(target).also { value.copyInto(it) }
    }

    private fun unpad(value: ByteArray): ByteArray {
        var end = value.size
        while (end > 0 && value[end - 1] == 0.toByte()) end--
        return value.copyOf(end)
    }
}

internal class MessageReplayGuard(private val windowSize: Long = 64) {
    private val highest = HashMap<String, Long>()
    private val seen = HashMap<String, Long>()

    @Synchronized
    fun accept(senderId: String, messageId: String, counter: Long): Boolean {
        val key = "$senderId:$messageId"
        if (seen.containsKey(key)) return false
        val current = highest[senderId]
        if (current != null && counter + windowSize < current) {
            return false
        }
        seen[key] = counter
        if (current == null || counter > current) highest[senderId] = counter
        if (seen.size > 4096) {
            val cutoff = (highest.values.maxOrNull() ?: counter) - windowSize
            seen.entries.removeIf { it.value < cutoff }
        }
        return true
    }
}
