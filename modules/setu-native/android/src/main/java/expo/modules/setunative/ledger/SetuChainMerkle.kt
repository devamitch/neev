package expo.modules.setunative.ledger

import java.security.MessageDigest

internal object SetuChainMerkle {
    fun root(hashes: List<String>): String {
        if (hashes.isEmpty()) return sha256(ByteArray(0))
        var level = hashes.map { it.toByteArray(Charsets.UTF_8) }
        while (level.size > 1) {
            level = level.chunked(2).map { pair ->
                val right = pair.getOrElse(1) { pair[0] }
                sha256(pair[0] + right).toByteArray(Charsets.UTF_8)
            }
        }
        return level.single().toString(Charsets.UTF_8)
    }

    private fun sha256(value: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it) }
}
