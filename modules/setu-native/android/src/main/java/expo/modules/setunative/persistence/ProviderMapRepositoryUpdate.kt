package expo.modules.setunative.persistence

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase

internal class ProviderMapRepositoryUpdate(private val repository: ProviderMapRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()

    fun markVerified(manifestId: String, pieceIndex: Int, providerPeerId: String): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("is_verified", 1)
            }
            db.update("setu_provider_map", values, "manifest_id = ? AND piece_index = ? AND provider_peer_id = ?",
                arrayOf(manifestId, pieceIndex.toString(), providerPeerId)) > 0
        } catch (error: Exception) {
            false
        }
    }

    fun updateLastAdvertised(manifestId: String, pieceIndex: Int, providerPeerId: String): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("last_advertised_at", System.currentTimeMillis())
            }
            db.update("setu_provider_map", values, "manifest_id = ? AND piece_index = ? AND provider_peer_id = ?",
                arrayOf(manifestId, pieceIndex.toString(), providerPeerId)) > 0
        } catch (error: Exception) {
            false
        }
    }
}
