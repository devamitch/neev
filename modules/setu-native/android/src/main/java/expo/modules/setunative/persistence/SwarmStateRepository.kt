package expo.modules.setunative.persistence

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import expo.modules.setunative.models.*

/**
 * Repository for swarm state persistence.
 * Tracks replication status, rare pieces, and overall swarm health.
 */
class SwarmStateRepository(private val dbHelper: SetuDatabase) {

    companion object {
        private const val TAG = "SETU_SWARM_REPO"
        
        fun create(context: Context): SwarmStateRepository {
            return SwarmStateRepository(SetuDatabase.getInstance(context))
        }
    }

    private fun getDb(): SQLiteDatabase = dbHelper.readableDatabase
    private fun getWritableDb(): SQLiteDatabase = dbHelper.writableDatabase

    /**
     * Insert or update swarm state for a manifest
     */
    fun upsert(state: SwarmState): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("manifest_id", state.manifestId)
                put("total_pieces", state.totalPieces)
                put("available_pieces", state.availablePieces)
                put("replication_factor", state.replicationFactor)
                put("rare_pieces", dbHelper.serializeIntSet(state.rarePieces))
                put("at_risk_pieces", dbHelper.serializeIntSet(state.atRiskPieces))
            }
            
            val existing = get(state.manifestId)
            if (existing != null) {
                val rows = db.update("setu_swarm_state", values, "manifest_id = ?", arrayOf(state.manifestId))
                rows > 0
            } else {
                val rowId = db.insert("setu_swarm_state", null, values)
                rowId != -1L
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert swarm state for ${state.manifestId}", e)
            false
        }
    }

    /**
     * Get swarm state for a manifest
     */
    fun get(manifestId: String): SwarmState? {
        val db = getDb()
        val cursor = db.query(
            "setu_swarm_state",
            null,
            "manifest_id = ?",
            arrayOf(manifestId),
            null, null, null
        )
        
        return cursor.use {
            if (it.moveToFirst()) {
                mapSwarmState(it)
            } else {
                null
            }
        }
    }

    /**
     * Get swarm states that need attention (have at-risk pieces)
     */
    fun getNeedingRepair(): List<SwarmState> {
        val db = getDb()
        val cursor = db.query(
            "setu_swarm_state",
            null,
            "at_risk_pieces IS NOT NULL AND at_risk_pieces != ''",
            null, null, null, "at_risk_pieces DESC"
        )
        
        return cursor.use {
            val states = mutableListOf<SwarmState>()
            while (it.moveToNext()) {
                states.add(mapSwarmState(it))
            }
            states
        }
    }

    /**
     * Get swarm states with rare pieces
     */
    fun getWithRarePieces(): List<SwarmState> {
        val db = getDb()
        val cursor = db.query(
            "setu_swarm_state",
            null,
            "rare_pieces IS NOT NULL AND rare_pieces != ''",
            null, null, null, null
        )
        
        return cursor.use {
            val states = mutableListOf<SwarmState>()
            while (it.moveToNext()) {
                states.add(mapSwarmState(it))
            }
            states
        }
    }

    /**
     * Update available pieces count
     */
    fun updateAvailablePieces(manifestId: String, availablePieces: Int): Boolean {
        val db = getWritableDb()
        val values = ContentValues().apply {
            put("available_pieces", availablePieces)
        }
        return db.update("setu_swarm_state", values, "manifest_id = ?", arrayOf(manifestId)) > 0
    }

    /**
     * Update replication factor
     */
    fun updateReplicationFactor(manifestId: String, replicationFactor: Int): Boolean {
        val db = getWritableDb()
        val values = ContentValues().apply {
            put("replication_factor", replicationFactor)
        }
        return db.update("setu_swarm_state", values, "manifest_id = ?", arrayOf(manifestId)) > 0
    }

    /**
     * Update rare pieces
     */
    fun updateRarePieces(manifestId: String, rarePieces: Set<Int>): Boolean {
        val db = getWritableDb()
        val values = ContentValues().apply {
            put("rare_pieces", dbHelper.serializeIntSet(rarePieces))
        }
        return db.update("setu_swarm_state", values, "manifest_id = ?", arrayOf(manifestId)) > 0
    }

    /**
     * Update at-risk pieces
     */
    fun updateAtRiskPieces(manifestId: String, atRiskPieces: Set<Int>): Boolean {
        val db = getWritableDb()
        val values = ContentValues().apply {
            put("at_risk_pieces", dbHelper.serializeIntSet(atRiskPieces))
        }
        return db.update("setu_swarm_state", values, "manifest_id = ?", arrayOf(manifestId)) > 0
    }

    /**
     * Delete swarm state
     */
    fun delete(manifestId: String): Boolean {
        val db = getWritableDb()
        return db.delete("setu_swarm_state", "manifest_id = ?", arrayOf(manifestId)) > 0
    }

    /**
     * Check if manifest needs replication (has pieces below replication factor)
     */
    fun needsReplication(manifestId: String, targetReplication: Int = 2): Boolean {
        val state = get(manifestId) ?: return false
        return state.availablePieces < state.totalPieces * targetReplication
    }

    /**
     * Get completion percentage for a manifest
     */
    fun getCompletionPercentage(manifestId: String): Double {
        val state = get(manifestId) ?: return 0.0
        return if (state.totalPieces > 0) {
            state.availablePieces.toDouble() / state.totalPieces.toDouble()
        } else {
            0.0
        }
    }

    private fun mapSwarmState(cursor: Cursor): SwarmState {
        return SwarmState(
            manifestId = cursor.getString(cursor.getColumnIndexOrThrow("manifest_id")),
            totalPieces = cursor.getInt(cursor.getColumnIndexOrThrow("total_pieces")),
            availablePieces = cursor.getInt(cursor.getColumnIndexOrThrow("available_pieces")),
            replicationFactor = cursor.getInt(cursor.getColumnIndexOrThrow("replication_factor")),
            rarePieces = dbHelper.deserializeIntSet(
                cursor.getStringOrNull(cursor.getColumnIndexOrThrow("rare_pieces"))
            ),
            atRiskPieces = dbHelper.deserializeIntSet(
                cursor.getStringOrNull(cursor.getColumnIndexOrThrow("at_risk_pieces"))
            ),
            providerMap = emptyMap() // This is computed from ProviderMapRepository
        )
    }

    private fun Cursor.getStringOrNull(columnIndex: Int): String? {
        return if (isNull(columnIndex)) null else getString(columnIndex)
    }
}