package expo.modules.setunative.persistence

import android.database.Cursor
import expo.modules.setunative.models.*

internal object TransferRepositoryMappings {

    fun mapTransfer(cursor: Cursor, dbHelper: SetuDatabase): SetuTransfer {
        val transferId = cursor.getString(cursor.getColumnIndexOrThrow("transfer_id"))
        val contentId = cursor.getString(cursor.getColumnIndexOrThrow("content_id"))
        val manifestId = cursor.getString(cursor.getColumnIndexOrThrow("manifest_id"))
        val peerId = cursor.getString(cursor.getColumnIndexOrThrow("peer_id"))
        val stateStr = cursor.getString(cursor.getColumnIndexOrThrow("state"))
        val directionStr = cursor.getString(cursor.getColumnIndexOrThrow("direction"))
        val totalBytes = cursor.getLong(cursor.getColumnIndexOrThrow("total_bytes"))
        val verifiedBytes = cursor.getLong(cursor.getColumnIndexOrThrow("verified_bytes"))
        val sessionId = cursor.getStringOrNull(cursor.getColumnIndex("session_id"))
        val state = TransferState.valueOf(stateStr)
        val direction = TransferDirection.valueOf(directionStr)
        val bitfield = cursor.getBlob(cursor.getColumnIndexOrThrow("bitfield")) ?: ByteArray(0)

        return SetuTransfer(
            transferId = transferId,
            contentId = contentId,
            manifestId = manifestId,
            peerId = peerId,
            sessionId = sessionId ?: error("TRANSFER_SESSION_MISSING"),
            state = state,
            direction = direction,
            totalBytes = totalBytes,
            verifiedBytes = verifiedBytes,
            pieceBitfield = BitSetWrapper.fromByteArray(bitfield),
            requestedPieces = dbHelper.deserializeIntSet(cursor.getString(cursor.getColumnIndex("requested_pieces"))),
            failedPieces = dbHelper.deserializeIntSet(cursor.getString(cursor.getColumnIndex("failed_pieces"))),
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
            updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow("updated_at")),
            destination = TransferDestination.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("destination"))),
            batchId = cursor.getStringOrNull(cursor.getColumnIndex("batch_id"))
        )
    }

    fun Cursor.getStringOrNull(columnIndex: Int): String? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getString(columnIndex) else null
    }

    fun Cursor.getLongOrNull(columnIndex: Int): Long? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getLong(columnIndex) else null
    }
}
