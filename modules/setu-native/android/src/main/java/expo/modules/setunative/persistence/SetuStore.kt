package expo.modules.setunative.persistence

import android.content.Context
import java.io.File
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** Single native index and append API for Setu's sensitive durable metadata. */
internal class SetuStore private constructor(context: Context) {
    private data class RecordKey(val domain: String, val id: String)

    private val appContext = context.applicationContext
    private val keys = expo.modules.setunative.security.SetuStoreKeyManager(appContext)
    private val segments = SetuStoreSegmentFile(appContext, keys)
    private val generations = SetuStoreGenerationManager(appContext, keys, segments)
    private val lock = ReentrantLock()
    private val index = LinkedHashMap<RecordKey, SetuStorePointer>()
    private val sequenceByDomain = HashMap<String, Long>()
    private var generation = 0L
    private var physicalRecordCount = 0
    private var storedBytes = 0L

    init {
        lock.withLock {
            generation = generations.load()
            rebuildIndex()
        }
    }

    fun read(domain: String, id: String): ByteArray? = lock.withLock {
        validateKey(domain, id)
        val pointer = index[RecordKey(domain, id)] ?: return null
        if (pointer.deleted) return null
        segments.read(generation, pointer).value
    }

    fun ids(domain: String): List<String> = lock.withLock {
        require(domain in DOMAINS) { "Unknown SetuStore domain" }
        index.values.asSequence().filter { it.domain == domain && !it.deleted }
            .map { it.recordId }.toList()
    }

    fun write(domain: String, id: String, value: ByteArray) = lock.withLock {
        append(domain, id, value, deleted = false)
    }

    fun delete(domain: String, id: String) = lock.withLock {
        append(domain, id, ByteArray(0), deleted = true)
    }

    fun compact() = lock.withLock { compactLocked(force = true) }

    private fun append(domain: String, id: String, value: ByteArray, deleted: Boolean) {
        validateKey(domain, id)
        require(value.size <= MAX_RECORD_BYTES) { "SetuStore record exceeds its size limit" }
        if (physicalRecordCount >= MAX_PHYSICAL_RECORDS || storedBytes + value.size + RECORD_OVERHEAD > MAX_STORE_BYTES) {
            compactLocked(force = false)
        }
        check(physicalRecordCount < MAX_PHYSICAL_RECORDS && storedBytes + value.size + RECORD_OVERHEAD <= MAX_STORE_BYTES) {
            "SetuStore capacity limit reached"
        }

        val sequence = (sequenceByDomain[domain] ?: 0L) + 1L
        check(sequence > 0) { "SetuStore sequence exhausted" }
        val sizes = segments.segmentSizes(generation, domain)
        require(sizes.size <= MAX_SEGMENTS_PER_DOMAIN) { "SetuStore segment count exceeds its limit" }
        var segment = sizes.lastOrNull()?.first ?: 1
        if ((sizes.lastOrNull()?.second ?: 0L) + value.size + RECORD_OVERHEAD > MAX_SEGMENT_BYTES) segment++
        check(segment <= MAX_SEGMENTS_PER_DOMAIN) { "SetuStore segment count exceeds its limit" }

        val pointer = segments.append(generation, domain, id, segment, sequence, value, deleted)
        index[RecordKey(domain, id)] = pointer
        sequenceByDomain[domain] = sequence
        physicalRecordCount++
        storedBytes += pointer.recordBytes
        compactLocked(force = false)
    }

    private fun rebuildIndex() {
        index.clear()
        sequenceByDomain.clear()
        physicalRecordCount = 0
        storedBytes = totalBytes(generation)
        check(storedBytes <= MAX_STORE_BYTES) { "SetuStore exceeds its size limit" }

        for (domain in DOMAINS) {
            var previousSequence = 0L
            val remaining = MAX_PHYSICAL_RECORDS - physicalRecordCount
            for (entry in segments.readAll(generation, domain, remaining)) {
                check(entry.pointer.sequence > previousSequence) { "SetuStore sequence is invalid" }
                previousSequence = entry.pointer.sequence
                index[RecordKey(domain, entry.pointer.recordId)] = entry.pointer
                physicalRecordCount++
                entry.value.fill(0)
            }
            sequenceByDomain[domain] = previousSequence
        }
        check(physicalRecordCount <= MAX_PHYSICAL_RECORDS) { "SetuStore record count exceeds its limit" }
    }

    private fun compactLocked(force: Boolean) {
        val latest = index.values.toList()
        if (!force && storedBytes < COMPACT_AT_BYTES && physicalRecordCount < latest.size * 2 + 32) return
        check(latest.size <= MAX_PHYSICAL_RECORDS) { "SetuStore index exceeds its limit" }

        val oldGeneration = generation
        val compacted = generations.compact(oldGeneration, latest)
        generation = compacted.generation
        index.clear()
        compacted.pointers.forEach { pointer -> index[RecordKey(pointer.domain, pointer.recordId)] = pointer }
        physicalRecordCount = compacted.pointers.size
        storedBytes = compacted.totalBytes
        generations.deleteGeneration(oldGeneration)
    }

    private fun totalBytes(generation: Long): Long {
        var total = 0L
        var fileCount = 0
        segments.generationDirectory(generation).walkTopDown().filter { it.isFile }.forEach { file ->
            require(file.extension == "seg" && file.length() <= MAX_SEGMENT_BYTES) {
                "Invalid SetuStore generation file"
            }
            fileCount++
            check(fileCount <= MAX_TOTAL_SEGMENTS) { "SetuStore segment count exceeds its limit" }
            total += file.length()
            check(total <= MAX_STORE_BYTES) { "SetuStore exceeds its size limit" }
        }
        return total
    }

    private fun validateKey(domain: String, id: String) {
        require(domain in DOMAINS) { "Unknown SetuStore domain" }
        require(id.isNotBlank() && id.toByteArray(Charsets.UTF_8).size <= MAX_ID_BYTES) {
            "Invalid SetuStore record ID"
        }
    }

    companion object {
        private val DOMAINS = setOf("messages", "ledger", "spaces", "trust", "vault-meta")
        private const val MAX_RECORD_BYTES = 2 * 1024 * 1024
        private const val MAX_ID_BYTES = 256
        private const val MAX_SEGMENT_BYTES = 4L * 1024 * 1024
        private const val MAX_STORE_BYTES = 64L * 1024 * 1024
        private const val COMPACT_AT_BYTES = 32L * 1024 * 1024
        private const val MAX_PHYSICAL_RECORDS = 20_000
        private const val MAX_SEGMENTS_PER_DOMAIN = 4096
        private const val MAX_TOTAL_SEGMENTS = 20_480
        private const val RECORD_OVERHEAD = 512L

        @Volatile
        private var instance: SetuStore? = null

        fun getInstance(context: Context): SetuStore = instance ?: synchronized(this) {
            instance ?: SetuStore(context.applicationContext).also { instance = it }
        }
    }
}
