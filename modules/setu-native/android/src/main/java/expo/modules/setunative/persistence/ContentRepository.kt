package expo.modules.setunative.persistence

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import expo.modules.setunative.models.*

/**
 * Repository for SetuContent persistence.
 * Handles CRUD operations for content metadata.
 */
class ContentRepository(private val dbHelper: SetuDatabase) {

    companion object {
        private const val TAG = "SETU_CONTENT_REPO"
        private const val MAX_PAGE_SIZE = 100

        fun create(context: Context): ContentRepository {
            return ContentRepository(SetuDatabase.getInstance(context))
        }
    }

    internal fun getDb(): SQLiteDatabase = dbHelper.readableDatabase
    private fun getWritableDb(): SQLiteDatabase = dbHelper.writableDatabase
    private val sharedSpaceQuery = ContentRepositorySharedSpaceQuery(this)

    /**
     * Insert or update content
     */
    fun upsert(content: SetuContent): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("content_id", content.contentId)
                put("type", content.type.name)
                put("name", content.name)
                put("mime_type", content.mimeType)
                put("size", content.size)
                put("created_at", content.createdAt)
                put("modified_at", content.modifiedAt)
                put("source", content.source.name)
                put("source_uri", content.sourceUri)
                put("storage_mode", content.storageMode.name)
                put("encryption_mode", content.encryptionMode.name)
                put("manifest_id", content.manifestId)
                put("owner_id", content.ownerId)
                put("visibility", content.visibility.name)
                put("availability", content.availability.name)
                put("state", content.state.name)
                put("thumbnail_uri", content.thumbnailUri)
                put("metadata", org.json.JSONObject(content.metadata).toString())
            }

            val existing = get(content.contentId)
            if (existing != null) {
                val rows = db.update("setu_content", values, "content_id = ?", arrayOf(content.contentId))
                rows > 0
            } else {
                val rowId = db.insert("setu_content", null, values)
                rowId != -1L
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert content ${content.contentId}", e)
            false
        }
    }

    fun get(contentId: String): SetuContent? {
        val db = getDb()
        val cursor = db.query("setu_content", null, "content_id = ?", arrayOf(contentId), null, null, null)
        return cursor.use { if (it.moveToFirst()) mapContent(it) else null }
    }

    /**
     * Get all content for an owner
     */
    fun getByOwner(ownerId: String): List<SetuContent> {
        val db = getDb()
        val cursor = db.query(
            "setu_content",
            null,
            "owner_id = ?",
            arrayOf(ownerId),
            null, null, "modified_at DESC"
        )

        return cursor.use {
            val contents = mutableListOf<SetuContent>()
            while (it.moveToNext()) {
                contents.add(mapContent(it))
            }
            contents
        }
    }

    fun getByOwnerPage(ownerId: String, offset: Int, limit: Int): List<SetuContent> {
        require(ownerId.isNotBlank()) { "CONTENT_OWNER_INVALID" }
        require(offset >= 0) { "CONTENT_OFFSET_INVALID" }
        require(limit in 1..MAX_PAGE_SIZE) { "CONTENT_LIMIT_INVALID" }
        val cursor = getDb().query(
            "setu_content",
            null,
            "owner_id = ?",
            arrayOf(ownerId),
            null,
            null,
            "modified_at DESC, content_id DESC",
            "$limit OFFSET $offset"
        )
        return cursor.use {
            val contents = mutableListOf<SetuContent>()
            while (it.moveToNext()) contents.add(mapContent(it))
            contents
        }
    }

    /**
     * Get content by manifest ID
     */
    fun getByManifest(manifestId: String): List<SetuContent> {
        val db = getDb()
        val cursor = db.query(
            "setu_content",
            null,
            "manifest_id = ?",
            arrayOf(manifestId),
            null, null, null
        )

        return cursor.use {
            val contents = mutableListOf<SetuContent>()
            while (it.moveToNext()) {
                contents.add(mapContent(it))
            }
            contents
        }
    }

    fun getBySharedSpace(spaceId: String): List<SetuContent> = sharedSpaceQuery.getBySpace(spaceId)

    /**
     * Get content by storage mode
     */
    fun getByStorageMode(storageMode: StorageMode): List<SetuContent> {
        val db = getDb()
        val cursor = db.query(
            "setu_content",
            null,
            "storage_mode = ?",
            arrayOf(storageMode.name),
            null, null, null
        )

        return cursor.use {
            val contents = mutableListOf<SetuContent>()
            while (it.moveToNext()) {
                contents.add(mapContent(it))
            }
            contents
        }
    }

    /**
     * Update content state
     */
    fun updateState(contentId: String, state: ContentState): Boolean {
        val db = getWritableDb()
        val values = ContentValues().apply {
            put("state", state.name)
            put("modified_at", System.currentTimeMillis())
        }
        return db.update("setu_content", values, "content_id = ?", arrayOf(contentId)) > 0
    }

    /**
     * Update content availability
     */
    fun updateAvailability(contentId: String, availability: Availability): Boolean {
        val db = getWritableDb()
        val values = ContentValues().apply {
            put("availability", availability.name)
            put("modified_at", System.currentTimeMillis())
        }
        return db.update("setu_content", values, "content_id = ?", arrayOf(contentId)) > 0
    }

    /**
     * Delete content
     */
    fun delete(contentId: String): Boolean {
        val db = getWritableDb()
        return db.delete("setu_content", "content_id = ?", arrayOf(contentId)) > 0
    }

    /**
     * Get content count by storage mode
     */
    fun getCountByStorageMode(storageMode: StorageMode): Int {
        val db = getDb()
        val cursor = db.query(
            "setu_content",
            arrayOf("COUNT(*)"),
            "storage_mode = ?",
            arrayOf(storageMode.name),
            null, null, null
        )

        return cursor.use {
            if (it.moveToFirst()) it.getInt(0) else 0
        }
    }

    /**
     * Search content by name
     */
    fun searchByName(query: String, ownerId: String, limit: Int = 50): List<SetuContent> {
        val db = getDb()
        val cursor = db.query(
            "setu_content",
            null,
            "owner_id = ? AND name LIKE ?",
            arrayOf(ownerId, "%$query%"),
            null, null, "name ASC",
            limit.toString()
        )

        return cursor.use {
            val contents = mutableListOf<SetuContent>()
            while (it.moveToNext()) {
                contents.add(mapContent(it))
            }
            contents
        }
    }

    internal fun mapContent(cursor: Cursor): SetuContent {
        return SetuContent(
            contentId = cursor.getString(cursor.getColumnIndexOrThrow("content_id")),
            type = ContentType.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("type"))),
            name = cursor.getString(cursor.getColumnIndexOrThrow("name")),
            mimeType = cursor.getString(cursor.getColumnIndexOrThrow("mime_type")),
            size = cursor.getLong(cursor.getColumnIndexOrThrow("size")),
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
            modifiedAt = cursor.getLong(cursor.getColumnIndexOrThrow("modified_at")),
            source = ContentSource.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("source"))),
            sourceUri = cursor.getString(cursor.getColumnIndexOrThrow("source_uri")),
            storageMode = StorageMode.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("storage_mode"))),
            encryptionMode = EncryptionMode.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("encryption_mode"))),
            manifestId = cursor.getString(cursor.getColumnIndexOrThrow("manifest_id")),
            ownerId = cursor.getString(cursor.getColumnIndexOrThrow("owner_id")),
            visibility = Visibility.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("visibility"))),
            availability = Availability.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("availability"))),
            state = ContentState.valueOf(cursor.getString(cursor.getColumnIndexOrThrow("state"))),
            thumbnailUri = cursor.getString(cursor.getColumnIndexOrThrow("thumbnail_uri")),
            metadata = try {
                cursor.getString(cursor.getColumnIndexOrThrow("metadata"))?.let {
                    org.json.JSONObject(it).toMap()
                } ?: emptyMap()
            } catch (e: Exception) {
                emptyMap()
            }
        )
    }

    private fun org.json.JSONObject.toMap(): Map<String, String> =
        keys().asSequence().associateWith { key -> getString(key) }
}
