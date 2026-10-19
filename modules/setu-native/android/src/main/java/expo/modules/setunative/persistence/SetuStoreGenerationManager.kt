package expo.modules.setunative.persistence

import android.content.Context
import android.util.AtomicFile
import expo.modules.setunative.security.SetuStoreKeyManager
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

internal data class SetuStoreCompaction(
    val generation: Long,
    val pointers: List<SetuStorePointer>,
    val totalBytes: Long
)

/** Authenticates the active generation and compacts only into a new generation. */
internal class SetuStoreGenerationManager(
    context: Context,
    private val keys: SetuStoreKeyManager,
    private val segments: SetuStoreSegmentFile
) {
    private val rootDirectory = File(context.applicationContext.noBackupFilesDir, "setu_store")
    private val marker = AtomicFile(File(rootDirectory, "active-generation.enc"))

    fun load(): Long {
        if (!marker.baseFile.exists()) {
            check(!keys.hasPersistentKeyMaterial() && !segments.hasAnySegments()) {
                "SetuStore generation marker is missing; refusing to initialize over existing data"
            }
            writeMarker(0L)
            return 0L
        }
        val envelope = marker.openRead().use { it.readBytes() }
        require(envelope.size in (NONCE_BYTES + TAG_BYTES + 1)..MAX_MARKER_BYTES) {
            "Invalid SetuStore generation marker"
        }
        val nonce = envelope.copyOfRange(0, NONCE_BYTES)
        val plaintext = try {
            keys.withDomainKey("ledger") { key ->
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
                cipher.updateAAD(MARKER_AAD)
                cipher.doFinal(envelope, NONCE_BYTES, envelope.size - NONCE_BYTES)
            }
        } finally {
            nonce.fill(0)
            envelope.fill(0)
        }
        return try {
            val input = DataInputStream(ByteArrayInputStream(plaintext))
            input.readLong().also { check(it >= 0 && input.available() == 0) }
        } finally {
            plaintext.fill(0)
        }
    }

    fun compact(current: Long, latestPointers: List<SetuStorePointer>): SetuStoreCompaction {
        val nextGeneration = current + 1L
        segments.deleteGeneration(nextGeneration)
        val pointers = ArrayList<SetuStorePointer>(latestPointers.size)
        val segmentSizes = HashMap<String, Pair<Int, Long>>()
        var totalBytes = 0L
        try {
            val ordered = latestPointers.sortedWith(compareBy({ it.domain }, { it.sequence }))
            for (oldPointer in ordered) {
                val entry = segments.read(current, oldPointer)
                try {
                    val currentSegment = segmentSizes[oldPointer.domain] ?: (1 to 0L)
                    val segment = if (currentSegment.second + entry.value.size + RECORD_OVERHEAD > MAX_SEGMENT_BYTES) {
                        currentSegment.first + 1
                    } else {
                        currentSegment.first
                    }
                    val pointer = segments.append(
                        nextGeneration,
                        oldPointer.domain,
                        oldPointer.recordId,
                        segment,
                        oldPointer.sequence,
                        entry.value,
                        oldPointer.deleted
                    )
                    pointers.add(pointer)
                    val segmentBytes = if (segment == currentSegment.first) {
                        currentSegment.second + pointer.recordBytes
                    } else {
                        pointer.recordBytes.toLong()
                    }
                    segmentSizes[oldPointer.domain] = segment to segmentBytes
                    totalBytes += pointer.recordBytes
                    check(totalBytes <= MAX_STORE_BYTES) { "Compacted SetuStore exceeds its size limit" }
                } finally {
                    entry.value.fill(0)
                }
            }
            writeMarker(nextGeneration)
            return SetuStoreCompaction(nextGeneration, pointers, totalBytes)
        } catch (error: Throwable) {
            segments.deleteGeneration(nextGeneration)
            throw error
        }
    }

    fun deleteGeneration(generation: Long) = segments.deleteGeneration(generation)

    private fun writeMarker(generation: Long) {
        val plaintext = ByteArrayOutputStream().also { bytes ->
            DataOutputStream(bytes).use { it.writeLong(generation) }
        }.toByteArray()
        val envelope = keys.withDomainKey("ledger") { key ->
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
            cipher.updateAAD(MARKER_AAD)
            cipher.iv + cipher.doFinal(plaintext)
        }
        plaintext.fill(0)
        check(rootDirectory.isDirectory || rootDirectory.mkdirs()) { "Unable to create SetuStore directory" }
        val output = marker.startWrite()
        try {
            output.write(envelope)
            output.fd.sync()
            marker.finishWrite(output)
        } catch (error: Throwable) {
            marker.failWrite(output)
            throw error
        } finally {
            envelope.fill(0)
        }
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAG_BITS = 128
        const val TAG_BYTES = TAG_BITS / 8
        const val NONCE_BYTES = 12
        const val MAX_MARKER_BYTES = 128
        const val MAX_SEGMENT_BYTES = 4L * 1024 * 1024
        const val MAX_STORE_BYTES = 64L * 1024 * 1024
        const val RECORD_OVERHEAD = 512L
        val MARKER_AAD = "SETU_STORE_GENERATION_V1".toByteArray(Charsets.UTF_8)
    }
}
