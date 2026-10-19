package expo.modules.setunative.persistence

import android.database.sqlite.SQLiteDatabase

internal class ProviderMapRepositoryDelete(private val repository: ProviderMapRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()

    fun removeProvider(manifestId: String, pieceIndex: Int, providerPeerId: String): Boolean {
        val db = getWritableDb()
        return try {
            db.delete("setu_provider_map", "manifest_id = ? AND piece_index = ? AND provider_peer_id = ?",
                arrayOf(manifestId, pieceIndex.toString(), providerPeerId)) > 0
        } catch (error: Exception) {
            false
        }
    }

    fun removeByManifest(manifestId: String): Int {
        val db = getWritableDb()
        return try {
            db.delete("setu_provider_map", "manifest_id = ?", arrayOf(manifestId))
        } catch (error: Exception) {
            0
        }
    }

    fun removeByProvider(providerPeerId: String): Int {
        val db = getWritableDb()
        return try {
            db.delete("setu_provider_map", "provider_peer_id = ?", arrayOf(providerPeerId))
        } catch (error: Exception) {
            0
        }
    }

    fun clearExpired() {
        val db = getWritableDb()
        try {
            val whereClause = "last_advertised_at < ?"
            val whereArgs = arrayOf((System.currentTimeMillis() - (24 * 60 * 60 * 1000)).toString())
            db.delete("setu_provider_map", whereClause, whereArgs)
        } catch (_: Exception) {
            // Ignore errors during cleanup
        }
    }
}
