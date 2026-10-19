package expo.modules.setunative.media

import android.os.SystemClock
import expo.modules.setunative.models.PieceState
import expo.modules.setunative.models.SetuManifest
import expo.modules.setunative.persistence.PieceRepository
import expo.modules.setunative.swarm.PieceStore
import expo.modules.setunative.swarm.SetuSwarmEngine

internal class PieceAvailabilityWaiter(
    private val manifest: SetuManifest,
    private val pieceRepository: PieceRepository,
    private val swarmEngine: SetuSwarmEngine
) {

    /**
     * Blocks the Media3 read thread until the piece is VERIFIED and locatable, and returns where
     * its bytes are. The wait is a condition wait signalled by [SetuSwarmEngine.onPieceVerified];
     * the bounded slice is only a safety net for a signal that arrives between the check and the
     * wait, never a poll loop.
     *
     * The returned location carries the piece's offset inside whatever backs it, because that is
     * the whole point: for content this device received in one transfer every piece is a range of
     * one file, and a reader that assumes offset zero reads piece 0 over and over.
     */
    fun await(index: Int): PieceStore.PieceLocation {
        require(index in 0 until manifest.pieceCount) { "PIECE_INDEX_INVALID" }
        swarmEngine.requestPiece(manifest.manifestId, index)
        val deadline = SystemClock.elapsedRealtime() + WAIT_TIMEOUT_MS
        while (true) {
            val piece = pieceRepository.get("${manifest.manifestId}_$index")
            if (piece?.state == PieceState.AVAILABLE &&
                swarmEngine.pieceStore.verifyFile(manifest, index, piece.hash, piece.storagePath)
            ) {
                swarmEngine.pieceStore.locate(manifest, index, piece.storagePath)?.let { return it }
            }
            val remaining = deadline - SystemClock.elapsedRealtime()
            if (remaining <= 0L) break
            try {
                swarmEngine.awaitPieceProgress(minOf(remaining, WAIT_SLICE_MS))
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                throw DataSourceException("PLAYBACK_INTERRUPTED")
            }
        }
        throw DataSourceException("PIECE_UNAVAILABLE")
    }

    companion object {
        private const val WAIT_TIMEOUT_MS = 30_000L
        private const val WAIT_SLICE_MS = 2_000L
    }
}
