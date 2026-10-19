package expo.modules.setunative.swarm

import expo.modules.setunative.security.CryptoIdentityManager

/**
 * Evaluates whether this device can leave the swarm without stranding rare pieces.
 */
object DepartureSafety {

    fun evaluate(engine: SetuSwarmEngine): Map<String, Any> {
        return try {
            val localPeerId = CryptoIdentityManager.getOrCreate().deviceId
            val replication = engine.getReplicationManager()
            val lastCopy = replication.getLastCopyPieces(localPeerId)
            val strandedPieces = lastCopy.values.sumOf { it.size }
            val manifestIds = lastCopy.keys.toList()
            val safe = strandedPieces == 0
            mapOf(
                "safeToLeave" to safe,
                "strandedPieceCount" to strandedPieces,
                "affectedManifestIds" to manifestIds,
                "reason" to if (safe) "REPLICATED" else "LAST_COPY_HOLDER",
            )
        } catch (e: Exception) {
            mapOf(
                "safeToLeave" to false,
                "strandedPieceCount" to -1,
                "affectedManifestIds" to emptyList<String>(),
                "reason" to "EVAL_ERROR:${e.message}",
            )
        }
    }

    private fun safeResult(safe: Boolean, count: Int, manifests: List<String>): Map<String, Any> =
        mapOf(
            "safeToLeave" to safe,
            "strandedPieceCount" to count,
            "affectedManifestIds" to manifests,
            "reason" to if (safe) "REPLICATED" else "LAST_COPY_HOLDER",
        )
}
