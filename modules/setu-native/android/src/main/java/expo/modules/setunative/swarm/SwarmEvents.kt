package expo.modules.setunative.swarm

import android.os.SystemClock
import expo.modules.setunative.shared.SetuEvents
import java.util.concurrent.ConcurrentHashMap

/** Maps swarm-engine callbacks to JS events. Progress is throttled to at most 4 events/s per transfer. */
internal object SwarmEvents {
    private const val PROGRESS_INTERVAL_MS = 250L
    private val lastProgressAt = ConcurrentHashMap<String, Long>()

    private fun emit(event: String, body: Map<String, Any?>) = SetuEvents.emit(SetuEvents.SWARM, event, body)

    fun listener(engine: () -> SetuSwarmEngine) = object : SetuSwarmEngine.SwarmListener {
        override fun onPieceAvailable(manifestId: String, pieceIndex: Int, peerId: String) = emit(
            "onPieceAvailable",
            mapOf("manifestId" to manifestId, "pieceIndex" to pieceIndex, "peerId" to peerId),
        )

        override fun onPieceRequested(manifestId: String, pieceIndex: Int, peerId: String) = emit(
            "onPieceRequested",
            mapOf("manifestId" to manifestId, "pieceIndex" to pieceIndex, "peerId" to peerId),
        )

        override fun onPieceServed(manifestId: String, pieceIndex: Int, peerId: String, bytes: Long) = emit(
            "onPieceServed",
            mapOf(
                "manifestId" to manifestId,
                "pieceIndex" to pieceIndex,
                "peerId" to peerId,
                "bytes" to bytes,
                "at" to System.currentTimeMillis(),
            ),
        )

        override fun onPieceTransferred(manifestId: String, pieceIndex: Int, peerId: String, bytes: Long) = emit(
            "onPieceTransferred",
            mapOf("manifestId" to manifestId, "pieceIndex" to pieceIndex, "peerId" to peerId, "bytes" to bytes),
        )

        override fun onTransferProgress(transferId: String, verifiedBytes: Long, totalBytes: Long) {
            val now = SystemClock.elapsedRealtime()
            val done = totalBytes > 0 && verifiedBytes >= totalBytes
            val last = lastProgressAt[transferId] ?: 0L
            if (!done && now - last < PROGRESS_INTERVAL_MS) return
            lastProgressAt[transferId] = now
            emit(
                "onSwarmTransferProgress",
                mapOf("transferId" to transferId, "verifiedBytes" to verifiedBytes, "totalBytes" to totalBytes),
            )
        }

        override fun onTransferCompleted(transferId: String, manifestId: String) {
            lastProgressAt.remove(transferId)
            emit("onSwarmTransferCompleted", mapOf("transferId" to transferId, "manifestId" to manifestId))
        }

        override fun onTransferFailed(transferId: String, reason: String) {
            lastProgressAt.remove(transferId)
            emit("onSwarmTransferFailed", mapOf("transferId" to transferId, "reason" to reason))
        }

        override fun onRarePieceDetected(manifestId: String, pieceIndex: Int) {
            val state = engine().getSwarmState()[manifestId] ?: return
            emit(
                "onSwarmHealthChanged",
                mapOf(
                    "manifestId" to state.manifestId,
                    "availablePieces" to state.availablePieces,
                    "totalPieces" to state.totalPieces,
                    "rarePieces" to state.rarePieces.toList(),
                    "atRiskPieces" to state.atRiskPieces.toList(),
                    "replicationFactor" to state.replicationFactor,
                    "isComplete" to (state.availablePieces == state.totalPieces),
                ),
            )
        }

        override fun onSwarmHealthChanged(manifestId: String, health: SetuSwarmEngine.SwarmHealth) = emit(
            "onSwarmHealthChanged",
            mapOf(
                "manifestId" to manifestId,
                "availablePieces" to health.availablePieces,
                "totalPieces" to health.totalPieces,
                "rarePieces" to health.rarePieces.toList(),
                "atRiskPieces" to health.atRiskPieces.toList(),
                "replicationFactor" to health.replicationFactor,
                "isComplete" to health.isComplete,
            ),
        )

        override fun onDepartureDetected(peerId: String, sessionId: String, rarePieces: Set<Int>) = emit(
            "onDepartureDetected",
            mapOf("peerId" to peerId, "sessionId" to sessionId, "rarePieces" to rarePieces.toList()),
        )
    }
}
