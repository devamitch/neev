package expo.modules.setunative.persistence

import expo.modules.setunative.security.SetuStoreKeyManager
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Serializes and authenticates individual SetuStore records. */
internal class SetuStoreRecordCodec(private val keys: SetuStoreKeyManager) {
    fun encode(
        domain: String,
        recordId: String,
        segment: Int,
        sequence: Long,
        value: ByteArray,
        deleted: Boolean
    ): ByteArray {
        val plaintext = byteArrayOf(if (deleted) 1 else 0) + value
        val encrypted = try {
            keys.withDomainKey(domain) { key ->
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
                cipher.updateAAD(aad(storeId(domain, recordId), segment, sequence, FORMAT_VERSION))
                cipher.iv to cipher.doFinal(plaintext)
            }
        } finally {
            plaintext.fill(0)
        }

        val nonce = encrypted.first
        val ciphertext = encrypted.second
        val id = recordId.toByteArray(Charsets.UTF_8)
        return try {
            val bodyBytes = ByteArrayOutputStream()
            DataOutputStream(bodyBytes).use { body ->
                body.writeInt(MAGIC)
                body.writeInt(FORMAT_VERSION)
                body.writeInt(segment)
                body.writeLong(sequence)
                body.writeInt(id.size)
                body.write(id)
                body.writeInt(nonce.size)
                body.write(nonce)
                body.writeInt(ciphertext.size)
                body.write(ciphertext)
            }
            val body = bodyBytes.toByteArray()
            try {
                ByteArrayOutputStream().also { record ->
                    DataOutputStream(record).use { output ->
                        output.writeInt(body.size)
                        output.write(body)
                    }
                }.toByteArray()
            } finally {
                body.fill(0)
            }
        } finally {
            id.fill(0)
            nonce.fill(0)
            ciphertext.fill(0)
        }
    }

    fun decodeAt(bytes: ByteArray, domain: String, expectedSegment: Int, offset: Int): SetuStoreEntry {
        require(offset >= 0 && offset < bytes.size) { "Invalid SetuStore record offset" }
        val input = DataInputStream(ByteArrayInputStream(bytes, offset, bytes.size - offset))
        val recordLength = input.readInt()
        require(recordLength in MIN_RECORD_BYTES..MAX_RECORD_BYTES && recordLength <= input.available()) {
            "Invalid SetuStore record length"
        }
        val body = ByteArray(recordLength).also(input::readFully)
        var nonce: ByteArray? = null
        var ciphertext: ByteArray? = null
        try {
            val record = DataInputStream(ByteArrayInputStream(body))
            require(record.readInt() == MAGIC) { "Invalid SetuStore record header" }
            val version = record.readInt()
            require(version == FORMAT_VERSION) { "Unsupported SetuStore record version" }
            val segment = record.readInt()
            require(segment == expectedSegment) { "SetuStore segment mismatch" }
            val sequence = record.readLong()
            require(sequence > 0) { "Invalid SetuStore sequence" }
            val idLength = record.readInt()
            require(idLength in 1..MAX_ID_BYTES && idLength <= record.available()) {
                "Invalid SetuStore record ID"
            }
            val idBytes = ByteArray(idLength).also(record::readFully)
            val id = try {
                idBytes.toString(Charsets.UTF_8)
            } finally {
                idBytes.fill(0)
            }
            val nonceLength = record.readInt()
            require(nonceLength == NONCE_BYTES && nonceLength <= record.available()) {
                "Invalid SetuStore nonce"
            }
            nonce = ByteArray(nonceLength).also(record::readFully)
            val ciphertextLength = record.readInt()
            require(ciphertextLength in (TAG_BYTES + 1)..MAX_CIPHERTEXT_BYTES && ciphertextLength == record.available()) {
                "Invalid SetuStore ciphertext length"
            }
            ciphertext = ByteArray(ciphertextLength).also(record::readFully)
            val plaintext = keys.withDomainKey(domain) { key ->
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
                cipher.updateAAD(aad(storeId(domain, id), segment, sequence, version))
                cipher.doFinal(ciphertext)
            }
            try {
                require(plaintext.isNotEmpty()) { "Invalid SetuStore value" }
                val flag = plaintext[0].toInt()
                require(flag in 0..1) { "Invalid SetuStore record flag" }
                val pointer = SetuStorePointer(domain, id, segment, sequence, offset, recordLength + 4, flag == 1)
                return SetuStoreEntry(pointer, plaintext.copyOfRange(1, plaintext.size))
            } finally {
                plaintext.fill(0)
            }
        } finally {
            body.fill(0)
            nonce?.fill(0)
            ciphertext?.fill(0)
        }
    }

    fun recordLength(bytes: ByteArray, offset: Int): Int {
        require(offset >= 0 && offset <= bytes.size - 4) { "Truncated SetuStore segment" }
        val input = DataInputStream(ByteArrayInputStream(bytes, offset, bytes.size - offset))
        val length = input.readInt()
        require(length in MIN_RECORD_BYTES..MAX_RECORD_BYTES && length <= bytes.size - offset - 4) {
            "Invalid SetuStore record length"
        }
        return length + 4
    }

    private fun storeId(domain: String, recordId: String) = "setu_store_v1:$domain:$recordId"

    private fun aad(storeId: String, segment: Int, sequence: Long, version: Int) =
        "$storeId|$segment|$sequence|$version".toByteArray(Charsets.UTF_8)

    private companion object {
        const val MAGIC = 0x53545552
        const val FORMAT_VERSION = 1
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAG_BITS = 128
        const val TAG_BYTES = TAG_BITS / 8
        const val NONCE_BYTES = 12
        const val MAX_ID_BYTES = 256
        const val MAX_CIPHERTEXT_BYTES = 2 * 1024 * 1024 + TAG_BYTES + 1
        const val MAX_RECORD_BYTES = MAX_CIPHERTEXT_BYTES + MAX_ID_BYTES + 128
        const val MIN_RECORD_BYTES = 32
    }
}
