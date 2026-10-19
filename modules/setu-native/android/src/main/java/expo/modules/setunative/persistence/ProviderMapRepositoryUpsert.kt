package expo.modules.setunative.persistence

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*

internal class ProviderMapRepositoryUpsert(private val repository: ProviderMapRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()

    fun upsert(entry: ProviderMapEntry): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("manifest_id", entry.manifestId)
                put("piece_index", entry.pieceIndex)
                put("provider_peer_id", entry.providerPeerId)
                put("is_verified", if (entry.isVerified) 1 else 0)
                put("last_advertised_at", entry.lastAdvertisedAt)
            }

            val existing = repository.getProviders(entry.manifestId, entry.pieceIndex)
                .firstOrNull { it.providerPeerId == entry.providerPeerId }

            if (existing != null) {
                db.update("setu_provider_map", values, "manifest_id = ? AND piece_index = ? AND provider_peer_id = ?",
                    arrayOf(entry.manifestId, entry.pieceIndex.toString(), entry.providerPeerId)) > 0
            } else {
                db.insert("setu_provider_map", null, values) != -1L
            }
        } catch (error: Exception) {
            false
        }
    }
}
