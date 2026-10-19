package expo.modules.setunative.persistence

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*
import java.util.*

internal class PieceRepositoryQuery(private val repository: PieceRepository) {

    private fun getDb(): SQLiteDatabase = repository.getDb()
    private fun getDbHelper(): SetuDatabase = repository.getDbHelper()

    fun get(pieceId: String): SetuPiece? {
        val db = getDb()
        val selection = "piece_id = ?"
        val selectionArgs = arrayOf(pieceId)

        return db.query("setu_pieces", null, selection, selectionArgs, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                PieceRepositoryMappings.mapPiece(cursor, getDbHelper())
            } else {
                null
            }
        }
    }

    fun getByManifest(manifestId: String): List<SetuPiece> {
        val db = getDb()
        val selection = "manifest_id = ?"
        val selectionArgs = arrayOf(manifestId)

        return db.query("setu_pieces", null, selection, selectionArgs, null, null, "piece_index ASC")?.use { cursor ->
            val pieces = mutableListOf<SetuPiece>()
            while (cursor.moveToNext()) {
                pieces.add(PieceRepositoryMappings.mapPiece(cursor, getDbHelper()))
            }
            pieces
        } ?: emptyList()
    }

    fun getByState(manifestId: String, state: PieceState): List<SetuPiece> {
        val db = getDb()
        val selection = "manifest_id = ? AND state = ?"
        val selectionArgs = arrayOf(manifestId, state.name)

        return db.query("setu_pieces", null, selection, selectionArgs, null, null, "piece_index ASC")?.use { cursor ->
            val pieces = mutableListOf<SetuPiece>()
            while (cursor.moveToNext()) {
                pieces.add(PieceRepositoryMappings.mapPiece(cursor, getDbHelper()))
            }
            pieces
        } ?: emptyList()
    }

    fun getAvailablePieces(manifestId: String): List<SetuPiece> {
        val db = getDb()
        val selection = "manifest_id = ? AND state = ? AND storage_path IS NOT NULL"
        val selectionArgs = arrayOf(manifestId, PieceState.AVAILABLE.name)

        return db.query("setu_pieces", null, selection, selectionArgs, null, null, "piece_index ASC")?.use { cursor ->
            val pieces = mutableListOf<SetuPiece>()
            while (cursor.moveToNext()) {
                pieces.add(PieceRepositoryMappings.mapPiece(cursor, getDbHelper()))
            }
            pieces
        } ?: emptyList()
    }

    fun getMissingPieces(manifestId: String, totalPieces: Int): List<Int> {
        val db = getDb()
        val selection = "manifest_id = ?"
        val selectionArgs = arrayOf(manifestId)

        return db.query("setu_pieces", null, selection, selectionArgs, null, null, "piece_index ASC")?.use { cursor ->
            val presentIndices = mutableSetOf<Int>()
            while (cursor.moveToNext()) {
                val index = cursor.getInt(cursor.getColumnIndexOrThrow("piece_index"))
                presentIndices.add(index)
            }
            (0 until totalPieces).filterNot { presentIndices.contains(it) }
        } ?: (0 until totalPieces).toList()
    }

    fun getByContent(contentId: String): List<SetuPiece> {
        val db = getDb()
        val selection = "content_id = ?"
        val selectionArgs = arrayOf(contentId)

        return db.query("setu_pieces", null, selection, selectionArgs, null, null, null)?.use { cursor ->
            val pieces = mutableListOf<SetuPiece>()
            while (cursor.moveToNext()) {
                pieces.add(PieceRepositoryMappings.mapPiece(cursor, getDbHelper()))
            }
            pieces
        } ?: emptyList()
    }

    fun getBitfield(manifestId: String, totalPieces: Int): BitSet {
        val db = getDb()
        val selection = "manifest_id = ? AND state = ? AND storage_path IS NOT NULL"
        val selectionArgs = arrayOf(manifestId, PieceState.AVAILABLE.name)

        return db.query("setu_pieces", arrayOf("piece_index"), selection, selectionArgs, null, null, "piece_index ASC")?.use { cursor ->
            val bitfield = BitSet(totalPieces)
            while (cursor.moveToNext()) {
                val index = cursor.getInt(0)
                if (index < totalPieces) {
                    bitfield.set(index)
                }
            }
            bitfield
        } ?: BitSet(totalPieces)
    }

    fun getCountByState(manifestId: String, state: PieceState): Int {
        val db = getDb()
        val selection = "manifest_id = ? AND state = ?"
        val selectionArgs = arrayOf(manifestId, state.name)

        return db.query("setu_pieces", arrayOf("COUNT(*)"), selection, selectionArgs, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        } ?: 0
    }
}
