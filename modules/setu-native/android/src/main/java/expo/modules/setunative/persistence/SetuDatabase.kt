package expo.modules.setunative.persistence

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log
import expo.modules.setunative.models.*
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream

/**
 * SQLite database for Setu durable state.
 * Handles all persistence for content, peers, transfers, pieces, manifests, and swarm state.
 *
 * Schema definitions are in SetuDatabaseSchema.
 */
class SetuDatabase private constructor(context: Context) : SQLiteOpenHelper(
    context,
    SetuDatabaseSchema.DATABASE_NAME,
    null,
    SetuDatabaseSchema.DATABASE_VERSION
) {

    companion object {
        private const val TAG = "SETU_DB"

        @Volatile
        private var instance: SetuDatabase? = null

        fun getInstance(context: Context): SetuDatabase {
            return instance ?: synchronized(this) {
                instance ?: SetuDatabase(context.applicationContext).also { instance = it }
            }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        try {
            // Create all tables from schema
            for (tableSql in SetuDatabaseSchema.ALL_TABLES) {
                db.execSQL(tableSql)
            }
            createIndexes(db)
        } catch (e: Exception) {
            Log.e(TAG, "Database creation failed", e)
            throw e
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2 && newVersion >= 2) {
            val hasTransfers = db.rawQuery(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                arrayOf("setu_transfers")
            ).use { it.moveToFirst() }
            if (hasTransfers) {
                val hasErrorColumn = db.rawQuery("PRAGMA table_info(setu_transfers)", null).use { cursor ->
                    val nameIndex = cursor.getColumnIndexOrThrow("name")
                    var found = false
                    while (cursor.moveToNext()) {
                        if (cursor.getString(nameIndex) == "error_message") found = true
                    }
                    found
                }
                if (!hasErrorColumn) db.execSQL("ALTER TABLE setu_transfers ADD COLUMN error_message TEXT")
            }
        }
        if (oldVersion < 3 && newVersion >= 3) {
            // Shared spaces and tombstones now live in the encrypted SetuStore. The legacy tables are
            // created here only when upgrading from a build that had them, so the one-time
            // SharedSpaceStoreMigration can read and then drop them.
            db.execSQL(SetuDatabaseSchema.CREATE_SHARED_SPACES_TABLE)
            db.execSQL(SetuDatabaseSchema.CREATE_TOMBSTONES_TABLE)
        }
    }

    private fun createIndexes(db: SQLiteDatabase) {
        // Content indexes
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_content_owner ON setu_content(owner_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_content_manifest ON setu_content(manifest_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_content_state ON setu_content(state)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_content_storage ON setu_content(storage_mode)")

        // Manifest indexes
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_manifest_content ON setu_manifests(content_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_manifest_owner ON setu_manifests(owner_id)")

        // Piece indexes
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_piece_manifest ON setu_pieces(manifest_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_piece_content ON setu_pieces(content_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_piece_state ON setu_pieces(state)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_piece_index ON setu_pieces(piece_index)")

        // Transfer indexes
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_transfer_state ON setu_transfers(state)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_transfer_peer ON setu_transfers(peer_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_transfer_session ON setu_transfers(session_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_transfer_batch ON setu_transfers(batch_id)")

        // Provider map indexes
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_provider_manifest ON setu_provider_map(manifest_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_provider_peer ON setu_provider_map(provider_peer_id)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_provider_verified ON setu_provider_map(is_verified)")

        // Swarm state indexes
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_swarm_availability ON setu_swarm_state(available_pieces)")
    }

    // ====================================================
    // SERIALIZATION HELPERS
    // ====================================================

    fun serializeBitSet(bitSet: java.util.BitSet): ByteArray = bitSet.toByteArray()
    fun deserializeBitSet(bytes: ByteArray): java.util.BitSet = java.util.BitSet.valueOf(bytes)
    fun serializeStringSet(set: Set<String>): String = set.joinToString(",")
    fun deserializeStringSet(str: String?): Set<String> =
        if (str.isNullOrEmpty()) emptySet() else str.split(",").toSet()
    fun serializeByteArrayList(arrays: List<ByteArray>): ByteArray {
        val output = ByteArrayOutputStream()
        DataOutputStream(output).use { dos ->
            dos.writeInt(arrays.size)
            for (array in arrays) {
                dos.writeInt(array.size)
                dos.write(array)
            }
        }
        return output.toByteArray()
    }
    fun deserializeByteArrayList(bytes: ByteArray): List<ByteArray> {
        val input = DataInputStream(ByteArrayInputStream(bytes))
        val count = input.readInt()
        val result = mutableListOf<ByteArray>()
        repeat(count) {
            val size = input.readInt()
            val array = ByteArray(size)
            input.readFully(array)
            result.add(array)
        }
        return result
    }
    fun serializeIntSet(set: Set<Int>): String = set.joinToString(",")
    fun deserializeIntSet(str: String?): Set<Int> =
        if (str.isNullOrEmpty()) emptySet() else str.split(",").mapNotNull { it.toIntOrNull() }.toSet()
}
