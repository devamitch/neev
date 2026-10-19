package expo.modules.setunative.persistence

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*

internal class PieceRepositoryUpsert(private val repository: PieceRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()
    private fun getDbHelper(): SetuDatabase = repository.getDbHelper()

    fun upsert(piece: SetuPiece): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("piece_id", piece.pieceId)
                put("manifest_id", piece.manifestId)
                put("content_id", piece.contentId)
                put("piece_index", piece.index)
                put("piece_hash", piece.hash)
                put("piece_length", piece.length)
                put("state", piece.state.name)
                put("storage_path", piece.storagePath)
                put("verified_at", piece.verifiedAt)
                put("provider_peer_ids", getDbHelper().serializeStringSet(piece.providerPeerIds))
            }
            
            val existing = repository.get(piece.pieceId)
            if (existing != null) {
                val rows = db.update("setu_pieces", values, "piece_id = ?", arrayOf(piece.pieceId))
                rows > 0
            } else {
                db.insert("setu_pieces", null, values) != -1L
            }
        } catch (error: Exception) {
            false
        }
    }
}