package expo.modules.setunative.ledger

internal data class SetuChainBlock(
    val epoch: Long,
    val previousBlockHash: String,
    val entryHashes: List<String>,
    val merkleRoot: String,
    val createdAt: Long
) {
    companion object {
        fun create(epoch: Long, previousBlockHash: String, entries: List<SetuChainEntry>): SetuChainBlock {
            val hashes = entries.map { it.hash }
            return SetuChainBlock(
                epoch = epoch,
                previousBlockHash = previousBlockHash,
                entryHashes = hashes,
                merkleRoot = SetuChainMerkle.root(hashes),
                createdAt = System.currentTimeMillis()
            )
        }
    }
}
