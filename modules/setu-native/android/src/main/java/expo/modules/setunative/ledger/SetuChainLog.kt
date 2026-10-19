package expo.modules.setunative.ledger

import android.content.Context
import expo.modules.setunative.persistence.SetuStore
import org.json.JSONObject
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

internal class SetuChainLog(context: Context) {
    private val store = SetuStore.getInstance(context)
    private val lock = ReentrantLock()
    private val forkDetector = SetuChainForkDetector { peerId -> store.write("trust", "quarantine:$peerId", byteArrayOf(1)) }

    fun append(operation: String, payload: String): SetuChainEntry = lock.withLock {
        val entries = entriesLocked()
        val previous = entries.maxWithOrNull(
            compareBy<SetuChainEntry> { it.lamport }.thenBy { it.deviceId }
        )
        val entry = SetuChainEntry.create(operation, payload, previous?.hash ?: "", (previous?.lamport ?: 0L) + 1L)
        check(entry.verify()) { "CHAIN_ENTRY_INVALID" }
        write(entry)
        entry
    }

    fun apply(entry: SetuChainEntry): Boolean = lock.withLock {
        if (!entry.verify() || store.read(DOMAIN, key(entry.entryId)) != null) return false
        val current = entriesLocked()
        val sameOrder = current.firstOrNull { it.lamport == entry.lamport && it.deviceId == entry.deviceId }
        if (sameOrder != null && sameOrder.hash != entry.hash) {
            forkDetector.inspect(current + entry)
            return false
        }
        write(entry)
        true
    }

    fun entries(): List<SetuChainEntry> = lock.withLock { entriesLocked() }

    private fun write(entry: SetuChainEntry) {
        val bytes = entry.encode()
        try { store.write(DOMAIN, key(entry.entryId), bytes) } finally { bytes.fill(0) }
    }

    private fun entriesLocked(): List<SetuChainEntry> = store.ids(DOMAIN)
        .filter { it.startsWith(PREFIX) }
        .mapNotNull { id -> store.read(DOMAIN, id)?.let { bytes -> try { decode(bytes) } finally { bytes.fill(0) } } }
        .sortedWith(compareBy<SetuChainEntry> { it.lamport }.thenBy { it.deviceId })

    private fun decode(bytes: ByteArray): SetuChainEntry {
        val json = JSONObject(bytes.toString(Charsets.UTF_8))
        return SetuChainEntry(
            entryId = json.getString("entryId"),
            deviceId = json.getString("deviceId"),
            publicKey = json.getString("publicKey"),
            lamport = json.getLong("lamport"),
            previousHash = json.getString("previousHash"),
            operation = json.getString("operation"),
            payload = json.getString("payload"),
            createdAt = json.getLong("createdAt"),
            hash = json.getString("hash"),
            signature = json.getString("signature")
        )
    }

    private fun key(id: String) = PREFIX + id

    companion object {
        private const val DOMAIN = "ledger"
        private const val PREFIX = "chain:"
    }
}
