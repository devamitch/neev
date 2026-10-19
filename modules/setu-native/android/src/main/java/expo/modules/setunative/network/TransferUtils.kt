package expo.modules.setunative.network

import android.content.Context
import android.net.Uri
import android.os.StatFs
import android.provider.OpenableColumns
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

internal object TransferUtils {
    fun querySize(appContext: Context, uri: Uri): Long {
        appContext.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (index >= 0 && !cursor.isNull(index)) return cursor.getLong(index)
            }
        }
        appContext.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
            if (descriptor.length >= 0) return descriptor.length
        }
        throw IllegalArgumentException("CONTENT_SIZE_UNAVAILABLE")
    }

    fun hasSufficientStorage(appContext: Context, requiredBytes: Long): Boolean {
        val stats = StatFs(appContext.filesDir.absolutePath)
        return stats.availableBytes >= requiredBytes + TransferConstants.STORAGE_MARGIN_BYTES
    }

    fun awaitReply(
        queue: LinkedBlockingQueue<TransferFrame>,
        transferId: String,
        timeoutMs: Long = TransferConstants.OPERATION_TIMEOUT_MS
    ): TransferFrame = queue.poll(timeoutMs, TimeUnit.MILLISECONDS)
        ?: throw java.util.concurrent.TimeoutException("TRANSFER_REPLY_TIMEOUT:$transferId")

    fun uniqueLibraryFile(directory: File, fileName: String, transferId: String): File {
        val prefix = "${System.currentTimeMillis().toString(36)}-${transferId.take(8)}_"
        return File(directory, prefix + fileName)
    }

    fun sanitizeFileName(value: String): String {
        val normalized = value.replace(Regex("[\\\\/\\u0000-\\u001f]"), "_").trim()
        if (normalized.isBlank() || normalized == "." || normalized == "..") return "shared-file"
        return normalized.take(180)
    }

    fun sanitizeMimeType(value: String): String {
        val normalized = value.trim().take(255)
        return if (normalized.matches(Regex("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+"))) {
            normalized
        } else {
            "application/octet-stream"
        }
    }

    fun pieceLength(manifest: TransferManifest, index: Int): Int = manifest.pieceLength(index)

    fun readExactly(input: InputStream, length: Int): ByteArray {
        val result = ByteArray(length)
        var offset = 0
        while (offset < length) {
            val read = input.read(result, offset, length - offset)
            if (read < 0) throw IllegalStateException("SOURCE_TRUNCATED")
            if (read == 0) continue
            offset += read
        }
        return result
    }

    fun hashFile(file: File): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest()
    }

    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    fun encodeTransferId(id: UUID): ByteArray = ByteArrayOutputStream(16).also { bytes ->
        DataOutputStream(bytes).use { writeTransferId(it, id) }
    }.toByteArray()

    fun writeTransferId(output: DataOutputStream, id: UUID) {
        output.writeLong(id.mostSignificantBits)
        output.writeLong(id.leastSignificantBits)
    }

    fun readTransferId(input: DataInputStream): UUID = UUID(input.readLong(), input.readLong())

    fun parseTransferId(text: String): UUID? = try {
        UUID.fromString(text)
    } catch (_: IllegalArgumentException) {
        null
    }

    fun parseTransferIdPayload(payload: ByteArray): UUID {
        if (payload.size < 16) throw SecurityException("INVALID_TRANSFER_ID")
        return DataInputStream(ByteArrayInputStream(payload)).use(::readTransferId)
    }

    fun writeBoundedString(output: DataOutputStream, value: String, maxBytes: Int) {
        val bytes = value.toByteArray(Charsets.UTF_8)
        require(bytes.size in 1..maxBytes) { "INVALID_MANIFEST_STRING" }
        output.writeShort(bytes.size)
        output.write(bytes)
    }

    fun readBoundedString(input: DataInputStream, maxBytes: Int): String {
        val length = input.readUnsignedShort()
        if (length !in 1..maxBytes) throw SecurityException("INVALID_MANIFEST_STRING")
        return String(ByteArray(length).also(input::readFully), Charsets.UTF_8)
    }

    fun safeFailure(error: Exception): String = when (error.message) {
        "TRANSFER_DECLINED" -> "The recipient declined the transfer."
        "CONTENT_SOURCE_UNAVAILABLE" -> "The selected content is no longer available."
        "SOURCE_CHANGED_DURING_TRANSFER", "SOURCE_SIZE_CHANGED" -> "The source changed before the transfer finished."
        "CORRUPT_PIECE", "FINAL_FILE_HASH_MISMATCH" -> "Setu detected damaged content and discarded the incomplete transfer."
        "TRANSFER_INCOMPLETE", "MANIFEST_HASH_MISMATCH" -> "Setu could not verify the transfer and discarded the incomplete file."
        "TRANSFER_QUEUE_FULL" -> "Setu is busy with other transfers. Try again shortly."
        else -> "The transfer could not be completed. Check the connection and try again."
    }
}
