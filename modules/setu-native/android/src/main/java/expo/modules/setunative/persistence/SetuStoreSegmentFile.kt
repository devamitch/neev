package expo.modules.setunative.persistence

import android.content.Context
import android.util.AtomicFile
import expo.modules.setunative.security.SetuStoreKeyManager
import java.io.File

internal data class SetuStorePointer(
    val domain: String,
    val recordId: String,
    val segment: Int,
    val sequence: Long,
    val offset: Int,
    val recordBytes: Int,
    val deleted: Boolean
)

internal data class SetuStoreEntry(val pointer: SetuStorePointer, val value: ByteArray)

/** Atomic, bounded segment-file operations for SetuStore records. */
internal class SetuStoreSegmentFile(context: Context, private val keys: SetuStoreKeyManager) {
    private val root = File(context.applicationContext.noBackupFilesDir, "setu_store/generations")
    private val codec = SetuStoreRecordCodec(keys)

    fun append(
        generation: Long,
        domain: String,
        recordId: String,
        segment: Int,
        sequence: Long,
        value: ByteArray,
        deleted: Boolean = false
    ): SetuStorePointer {
        require(recordId.toByteArray(Charsets.UTF_8).size in 1..MAX_ID_BYTES)
        require(value.size <= MAX_VALUE_BYTES)
        require(segment > 0 && sequence > 0)

        val directory = domainDirectory(generation, domain)
        check(directory.mkdirsOrExists()) { "Unable to create SetuStore segment directory" }
        val base = File(directory, segmentName(segment))
        require(!base.exists() || base.length() <= MAX_SEGMENT_BYTES) { "SetuStore segment exceeds its size limit" }
        val atomic = AtomicFile(base)
        val previous = if (base.exists()) atomic.openRead().use { it.readBytes() } else ByteArray(0)
        val offset = previous.size
        val record = codec.encode(domain, recordId, segment, sequence, value, deleted)
        check(offset.toLong() + record.size <= MAX_SEGMENT_BYTES) { "SetuStore segment is full" }

        val output = atomic.startWrite()
        try {
            output.write(previous)
            output.write(record)
            output.fd.sync()
            atomic.finishWrite(output)
        } catch (error: Throwable) {
            atomic.failWrite(output)
            throw error
        } finally {
            previous.fill(0)
            record.fill(0)
        }
        return SetuStorePointer(domain, recordId, segment, sequence, offset, record.size, deleted)
    }

    fun readAll(generation: Long, domain: String, maxRecords: Int): List<SetuStoreEntry> {
        require(maxRecords >= 0)
        val directory = domainDirectory(generation, domain)
        val files = directory.listFiles()?.filter { it.extension == "seg" }
            ?.sortedBy { it.nameWithoutExtension.toIntOrNull() ?: Int.MAX_VALUE }
            ?: emptyList()
        require(files.size <= MAX_SEGMENTS_PER_DOMAIN) { "SetuStore segment count exceeds its limit" }
        val entries = mutableListOf<SetuStoreEntry>()
        for (file in files) {
            require(file.length() <= MAX_SEGMENT_BYTES) { "SetuStore segment exceeds its size limit" }
            val segment = file.nameWithoutExtension.toIntOrNull()
                ?: throw IllegalStateException("Invalid SetuStore segment name")
            val bytes = AtomicFile(file).openRead().use { it.readBytes() }
            try {
                entries.addAll(decodeSegment(bytes, domain, segment, maxRecords - entries.size))
            } finally {
                bytes.fill(0)
            }
        }
        return entries
    }

    fun read(generation: Long, pointer: SetuStorePointer): SetuStoreEntry {
        val file = File(domainDirectory(generation, pointer.domain), segmentName(pointer.segment))
        require(file.length() <= MAX_SEGMENT_BYTES) { "SetuStore segment exceeds its size limit" }
        val bytes = AtomicFile(file).openRead().use { it.readBytes() }
        return try {
            codec.decodeAt(bytes, pointer.domain, pointer.segment, pointer.offset).also {
                check(it.pointer.recordId == pointer.recordId && it.pointer.sequence == pointer.sequence) {
                    "SetuStore index does not match its segment"
                }
            }
        } finally {
            bytes.fill(0)
        }
    }

    fun segmentSizes(generation: Long, domain: String): List<Pair<Int, Long>> {
        return domainDirectory(generation, domain).listFiles()?.mapNotNull { file ->
            if (file.extension != "seg") return@mapNotNull null
            val segment = file.nameWithoutExtension.toIntOrNull()
                ?: throw IllegalStateException("Invalid SetuStore segment name")
            segment to file.length()
        }?.sortedBy { it.first } ?: emptyList()
    }

    fun generationDirectory(generation: Long): File = File(root, "gen_$generation")

    fun hasAnySegments(): Boolean = root.walkTopDown().any { it.isFile && it.extension == "seg" }

    fun deleteGeneration(generation: Long) {
        generationDirectory(generation).deleteRecursively()
    }

    private fun decodeSegment(bytes: ByteArray, domain: String, segment: Int, maxRecords: Int): List<SetuStoreEntry> {
        val records = mutableListOf<SetuStoreEntry>()
        var offset = 0
        while (offset < bytes.size) {
            require(records.size < maxRecords) { "SetuStore record count exceeds its limit" }
            val entry = codec.decodeAt(bytes, domain, segment, offset)
            records.add(entry)
            offset += codec.recordLength(bytes, offset)
        }
        return records
    }

    private fun domainDirectory(generation: Long, domain: String): File =
        File(generationDirectory(generation), domain)

    private fun storeId(domain: String, recordId: String) = "setu_store_v1:$domain:$recordId"

    private fun aad(storeId: String, segment: Int, sequence: Long, version: Int) =
        "$storeId|$segment|$sequence|$version".toByteArray(Charsets.UTF_8)

    private fun File.mkdirsOrExists(): Boolean = isDirectory || mkdirs()

    private fun segmentName(segment: Int) = "%06d.seg".format(segment)

    private companion object {
        const val MAX_ID_BYTES = 256
        const val MAX_VALUE_BYTES = 2 * 1024 * 1024
        const val MAX_SEGMENT_BYTES = 4L * 1024 * 1024
        const val MAX_SEGMENTS_PER_DOMAIN = 4096
    }
}
