package expo.modules.setunative.persistence

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import expo.modules.setunative.models.*

/**
 * Repository for SetuManifest persistence.
 * Handles CRUD operations for manifest metadata and piece information.
 */
class ManifestRepository(private val dbHelper: SetuDatabase) {

    companion object {
        private const val TAG = "SETU_MANIFEST_REPO"

        fun create(context: Context): ManifestRepository {
            return ManifestRepository(SetuDatabase.getInstance(context))
        }
    }

    private fun getDb(): SQLiteDatabase = dbHelper.readableDatabase
    private fun getWritableDb(): SQLiteDatabase = dbHelper.writableDatabase

    /**
     * Insert or update manifest
     */
    fun upsert(manifest: SetuManifest): Boolean {
        val db = getWritableDb()
        return try {
            val pieceHashesBytes = dbHelper.serializeByteArrayList(manifest.pieceHashes)
            val values = ContentValues().apply {
                put("manifest_id", manifest.manifestId)
                put("content_id", manifest.contentId)
                put("version", manifest.version)
                put("file_name", manifest.fileName)
                put("mime_type", manifest.mimeType)
                put("size", manifest.size)
                put("piece_size", manifest.pieceSize)
                put("piece_hashes", pieceHashesBytes)
                put("file_hash", manifest.fileHash)
                put("manifest_hash", manifest.manifestHash)
                put("created_at", manifest.createdAt)
                put("owner_id", manifest.ownerId)
                put("is_public", if (manifest.isPublic) 1 else 0)
            }

            val existing = get(manifest.manifestId)
            if (existing != null) {
                val rows = db.update("setu_manifests", values, "manifest_id = ?", arrayOf(manifest.manifestId))
                rows > 0
            } else {
                val rowId = db.insert("setu_manifests", null, values)
                rowId != -1L
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert manifest ${manifest.manifestId}", e)
            false
        }
    }

    /**
     * Get manifest by ID
     */
    fun get(manifestId: String): SetuManifest? {
        val db = getDb()
        val cursor = db.query(
            "setu_manifests",
            null,
            "manifest_id = ?",
            arrayOf(manifestId),
            null, null, null
        )

        return cursor.use {
            if (it.moveToFirst()) {
                mapManifest(it)
            } else {
                null
            }
        }
    }

    /**
     * Get manifest by content ID
     */
    fun getByContent(contentId: String): List<SetuManifest> {
        val db = getDb()
        val cursor = db.query(
            "setu_manifests",
            null,
            "content_id = ?",
            arrayOf(contentId),
            null, null, "version DESC"
        )

        return cursor.use {
            val manifests = mutableListOf<SetuManifest>()
            while (it.moveToNext()) {
                manifests.add(mapManifest(it))
            }
            manifests
        }
    }

    /**
     * Get manifest by owner
     */
    fun getByOwner(ownerId: String, limit: Int = 100): List<SetuManifest> {
        val db = getDb()
        val cursor = db.query(
            "setu_manifests",
            null,
            "owner_id = ?",
            arrayOf(ownerId),
            null, null, "created_at DESC",
            limit.toString()
        )

        return cursor.use {
            val manifests = mutableListOf<SetuManifest>()
            while (it.moveToNext()) {
                manifests.add(mapManifest(it))
            }
            manifests
        }
    }

    /**
     * Get all manifests
     */
    fun getAll(): List<SetuManifest> {
        val db = getDb()
        val cursor = db.query(
            "setu_manifests",
            null, null, null, null, null, "created_at DESC"
        )

        return cursor.use {
            val manifests = mutableListOf<SetuManifest>()
            while (it.moveToNext()) {
                manifests.add(mapManifest(it))
            }
            manifests
        }
    }

    /**
     * Delete manifest and all associated pieces
     */
    fun delete(manifestId: String): Boolean {
        val db = getWritableDb()
        return try {
            db.beginTransaction()
            try {
                // Delete pieces first
                db.delete("setu_pieces", "manifest_id = ?", arrayOf(manifestId))
                db.delete("setu_provider_map", "manifest_id = ?", arrayOf(manifestId))
                db.delete("setu_swarm_state", "manifest_id = ?", arrayOf(manifestId))

                // Delete manifest
                val rows = db.delete("setu_manifests", "manifest_id = ?", arrayOf(manifestId))
                db.setTransactionSuccessful()
                rows > 0
            } finally {
                db.endTransaction()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete manifest $manifestId", e)
            false
        }
    }

    /**
     * Get piece count for manifest
     */
    fun getPieceCount(manifestId: String): Int {
        val manifest = get(manifestId) ?: return 0
        return manifest.pieceCount
    }

    private fun mapManifest(cursor: Cursor): SetuManifest {
        return SetuManifest(
            manifestId = cursor.getString(cursor.getColumnIndexOrThrow("manifest_id")),
            contentId = cursor.getString(cursor.getColumnIndexOrThrow("content_id")),
            version = cursor.getInt(cursor.getColumnIndexOrThrow("version")),
            fileName = cursor.getString(cursor.getColumnIndexOrThrow("file_name")),
            mimeType = cursor.getString(cursor.getColumnIndexOrThrow("mime_type")),
            size = cursor.getLong(cursor.getColumnIndexOrThrow("size")),
            pieceSize = cursor.getInt(cursor.getColumnIndexOrThrow("piece_size")),
            pieceHashes = dbHelper.deserializeByteArrayList(
                cursor.getBlob(cursor.getColumnIndexOrThrow("piece_hashes"))
            ),
            fileHash = cursor.getBlob(cursor.getColumnIndexOrThrow("file_hash")),
            manifestHash = cursor.getBlob(cursor.getColumnIndexOrThrow("manifest_hash")),
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
            ownerId = cursor.getString(cursor.getColumnIndexOrThrow("owner_id")),
            isPublic = cursor.getInt(cursor.getColumnIndexOrThrow("is_public")) == 1
        )
    }
}
