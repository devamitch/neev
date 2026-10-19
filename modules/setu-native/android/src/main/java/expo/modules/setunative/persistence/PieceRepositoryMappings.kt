package expo.modules.setunative.persistence

import android.database.Cursor
import expo.modules.setunative.models.*

internal object PieceRepositoryMappings {

    fun mapPiece(cursor: Cursor, dbHelper: SetuDatabase): SetuPiece {
        val pieceId = cursor.getString(cursor.getColumnIndexOrThrow("piece_id"))
        val manifestId = cursor.getString(cursor.getColumnIndexOrThrow("manifest_id"))
        val contentId = cursor.getString(cursor.getColumnIndexOrThrow("content_id"))
        val index = cursor.getInt(cursor.getColumnIndexOrThrow("piece_index"))
        val hash = cursor.getBlob(cursor.getColumnIndexOrThrow("piece_hash"))
        val length = cursor.getLong(cursor.getColumnIndexOrThrow("piece_length")).toInt()
        val stateStr = cursor.getString(cursor.getColumnIndexOrThrow("state"))
        val storagePath = cursor.getStringOrNull(cursor.getColumnIndex("storage_path"))
        val verifiedAt = cursor.getLongOrNull(cursor.getColumnIndex("verified_at"))
        val providerIdsStr = cursor.getStringOrNull(cursor.getColumnIndex("provider_peer_ids"))

        val state = try { PieceState.valueOf(stateStr) } catch (_: Exception) { PieceState.UNKNOWN }
        val providerPeerIds = dbHelper.deserializeStringSet(providerIdsStr ?: "")

        return SetuPiece(
            pieceId = pieceId,
            manifestId = manifestId,
            contentId = contentId,
            index = index,
            hash = hash,
            length = length,
            state = state,
            storagePath = storagePath,
            verifiedAt = verifiedAt,
            providerPeerIds = providerPeerIds.toMutableSet()
        )
    }

    fun Cursor.getStringOrNull(columnIndex: Int): String? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getString(columnIndex) else null
    }

    fun Cursor.getLongOrNull(columnIndex: Int): Long? {
        return if (columnIndex >= 0 && !isNull(columnIndex)) getLong(columnIndex) else null
    }
}
