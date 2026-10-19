package expo.modules.setunative.persistence

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*

internal class PieceRepositoryUpdate(private val repository: PieceRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()
    private fun getDbHelper(): SetuDatabase = repository.getDbHelper()

    fun updateState(pieceId: String, state: PieceState): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("state", state.name)
                if (state == PieceState.AVAILABLE) {
                    put("verified_at", System.currentTimeMillis())
                }
            }
            db.update("setu_pieces", values, "piece_id = ?", arrayOf(pieceId)) > 0
        } catch (error: Exception) {
            false
        }
    }

    fun updateStoragePath(pieceId: String, storagePath: String): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("storage_path", storagePath)
                put("state", PieceState.AVAILABLE.name)
                put("verified_at", System.currentTimeMillis())
            }
            db.update("setu_pieces", values, "piece_id = ?", arrayOf(pieceId)) > 0
        } catch (error: Exception) {
            false
        }
    }

    fun addProvider(pieceId: String, peerId: String): Boolean {
        val db = getWritableDb()
        return try {
            val existing = repository.get(pieceId)
            if (existing != null) {
                val updatedProviders = existing.providerPeerIds.toMutableSet().apply {
                    add(peerId)
                }
                val values = ContentValues().apply {
                    put("provider_peer_ids", getDbHelper().serializeStringSet(updatedProviders))
                }
                db.update("setu_pieces", values, "piece_id = ?", arrayOf(pieceId)) > 0
            } else {
                false
            }
        } catch (error: Exception) {
            false
        }
    }

    fun removeProvider(pieceId: String, peerId: String): Boolean {
        val db = getWritableDb()
        return try {
            val existing = repository.get(pieceId)
            if (existing != null) {
                val updatedProviders = existing.providerPeerIds.toMutableSet().apply {
                    remove(peerId)
                }
                val values = ContentValues().apply {
                    put("provider_peer_ids", getDbHelper().serializeStringSet(updatedProviders))
                }
                db.update("setu_pieces", values, "piece_id = ?", arrayOf(pieceId)) > 0
            } else {
                false
            }
        } catch (error: Exception) {
            false
        }
    }
}
