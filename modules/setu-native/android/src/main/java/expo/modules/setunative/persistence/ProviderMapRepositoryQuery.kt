package expo.modules.setunative.persistence

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*
import java.util.*

internal class ProviderMapRepositoryQuery(private val repository: ProviderMapRepository) {

    private fun getDb(): SQLiteDatabase = repository.getDb()
    private fun getDbHelper(): SetuDatabase = repository.getDbHelper()

    fun getProviders(manifestId: String, pieceIndex: Int): List<ProviderMapEntry> {
        val db = getDb()
        val selection = "manifest_id = ? AND piece_index = ?"
        val selectionArgs = arrayOf(manifestId, pieceIndex.toString())

        return db.query("setu_provider_map", null, selection, selectionArgs, null, null, null)?.use { cursor ->
            val entries = mutableListOf<ProviderMapEntry>()
            while (cursor.moveToNext()) {
                entries.add(ProviderMapRepositoryMappings.mapEntry(cursor, getDbHelper()))
            }
            entries
        } ?: emptyList()
    }

    fun getPiecesByProvider(manifestId: String, providerPeerId: String): List<ProviderMapEntry> {
        val db = getDb()
        val selection = "manifest_id = ? AND provider_peer_id = ?"
        val selectionArgs = arrayOf(manifestId, providerPeerId)

        return db.query("setu_provider_map", null, selection, selectionArgs, null, null, null)?.use { cursor ->
            val entries = mutableListOf<ProviderMapEntry>()
            while (cursor.moveToNext()) {
                entries.add(ProviderMapRepositoryMappings.mapEntry(cursor, getDbHelper()))
            }
            entries
        } ?: emptyList()
    }

    fun getProviderMap(manifestId: String): Map<Int, Set<String>> {
        val db = getDb()
        val selection = "manifest_id = ?"
        val selectionArgs = arrayOf(manifestId)

        return db.query("setu_provider_map", null, selection, selectionArgs, null, null, null)?.use { cursor ->
            val map = mutableMapOf<Int, MutableSet<String>>()
            while (cursor.moveToNext()) {
                val pieceIndex = cursor.getInt(cursor.getColumnIndexOrThrow("piece_index"))
                val providerPeerId = cursor.getString(cursor.getColumnIndexOrThrow("provider_peer_id"))
                map.getOrPut(pieceIndex) { mutableSetOf() }.add(providerPeerId)
            }
            map
        } ?: emptyMap()
    }

    fun getVerifiedProviders(manifestId: String, pieceIndex: Int): List<String> {
        val db = getDb()
        val selection = "manifest_id = ? AND piece_index = ? AND is_verified = 1"
        val selectionArgs = arrayOf(manifestId, pieceIndex.toString())

        return db.query("setu_provider_map", arrayOf("provider_peer_id"), selection, selectionArgs, null, null, null)?.use { cursor ->
            val providers = mutableListOf<String>()
            while (cursor.moveToNext()) {
                providers.add(cursor.getString(0))
            }
            providers
        } ?: emptyList()
    }

    fun getPieceRarity(manifestId: String): Map<Int, Int> {
        val db = getDb()
        val selection = "manifest_id = ?"
        val selectionArgs = arrayOf(manifestId)

        return db.query("setu_provider_map", arrayOf("piece_index", "provider_peer_id"), selection, selectionArgs, null, null, null)?.use { cursor ->
            val counts = mutableMapOf<Int, Int>()
            while (cursor.moveToNext()) {
                val pieceIndex = cursor.getInt(0)
                counts[pieceIndex] = counts.getOrDefault(pieceIndex, 0) + 1
            }
            counts
        } ?: emptyMap()
    }

    fun getRarePieces(manifestId: String): Set<Int> {
        val rarity = getPieceRarity(manifestId)
        val threshold = if (rarity.isNotEmpty()) rarity.values.minOrNull() ?: 1 else 1
        return rarity.filterValues { it <= threshold * 2 }.keys.toSet()
    }

    fun getAtRiskPieces(manifestId: String, totalPieces: Int): Set<Int> {
        val rarity = getPieceRarity(manifestId)
        val threshold = if (rarity.isNotEmpty()) rarity.values.minOrNull() ?: 1 else 1
        return rarity.filterValues { it <= threshold }.keys.toSet()
    }

    fun getProvidedPiecesByPeer(providerPeerId: String): Map<String, Set<Int>> {
        val db = getDb()
        val selection = "provider_peer_id = ?"
        val selectionArgs = arrayOf(providerPeerId)

        return db.query("setu_provider_map", arrayOf("manifest_id", "piece_index"), selection, selectionArgs, null, null, null)?.use { cursor ->
            val map = mutableMapOf<String, MutableSet<Int>>()
            while (cursor.moveToNext()) {
                val manifestId = cursor.getString(0)
                val pieceIndex = cursor.getInt(1)
                map.getOrPut(manifestId) { mutableSetOf() }.add(pieceIndex)
            }
            map
        } ?: emptyMap()
    }
}
