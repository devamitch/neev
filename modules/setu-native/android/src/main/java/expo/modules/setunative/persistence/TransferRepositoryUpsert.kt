package expo.modules.setunative.persistence

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*

internal class TransferRepositoryUpsert(private val repository: TransferRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()

    fun upsert(transfer: SetuTransfer): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("transfer_id", transfer.transferId)
                put("content_id", transfer.contentId)
                put("manifest_id", transfer.manifestId)
                put("peer_id", transfer.peerId)
                put("session_id", transfer.sessionId)
                put("state", transfer.state.name)
                put("direction", transfer.direction.name)
                put("total_bytes", transfer.totalBytes)
                put("verified_bytes", transfer.verifiedBytes)
                put("bitfield", transfer.pieceBitfield.toByteArray())
                put("requested_pieces", repository.getDbHelper().serializeIntSet(transfer.requestedPieces))
                put("failed_pieces", repository.getDbHelper().serializeIntSet(transfer.failedPieces))
                put("created_at", transfer.createdAt)
                put("updated_at", transfer.updatedAt)
                put("destination", transfer.destination.name)
                put("batch_id", transfer.batchId)
            }

            val existing = repository.get(transfer.transferId)
            if (existing != null) {
                db.update("setu_transfers", values, "transfer_id = ?", arrayOf(transfer.transferId)) > 0
            } else {
                db.insert("setu_transfers", null, values) != -1L
            }
        } catch (error: Exception) {
            false
        }
    }
}
