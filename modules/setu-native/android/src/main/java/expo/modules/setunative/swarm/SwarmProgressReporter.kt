package expo.modules.setunative.swarm

import android.util.Log
import expo.modules.setunative.models.TransferState

class SwarmProgressReporter(private val engine: SetuSwarmEngine) {
    fun report(manifestId: String, pieceIndex: Int, peerId: String, bytes: Long) {
        val manifest = engine.manifestRepository.get(manifestId) ?: return
        for (transfer in engine.getActiveTransfers().values) {
            if (transfer.manifestId != manifestId || !transfer.requestedPieces.remove(pieceIndex)) continue
            transfer.verifiedBytes = (transfer.verifiedBytes + manifest.pieceLength(pieceIndex)).coerceAtMost(transfer.totalBytes)
            engine.getListener()?.onPieceTransferred(manifestId, pieceIndex, peerId, bytes)
            engine.getListener()?.onTransferProgress(transfer.transferId, transfer.verifiedBytes, transfer.totalBytes)
            if (engine.pieceRepository.getAvailablePieces(manifestId).size >= manifest.pieceCount) {
                transfer.state = TransferState.COMPLETED
                engine.getActiveTransfers().remove(transfer.transferId)
                engine.getListener()?.onTransferCompleted(transfer.transferId, manifestId)
                Log.i("SETU_XFER_MGR", "Transfer ${transfer.transferId} completed")
            }
        }
    }
}
