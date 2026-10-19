package expo.modules.setunative.content

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import expo.modules.setunative.shared.SetuLog

/**
 * Paged, read-only view of the device's media, straight from MediaStore.
 *
 * Nothing is copied or scanned up front: each call reads exactly one page with the cursor's own
 * LIMIT/OFFSET, so a 50,000-photo library costs the same as a 50-photo one and JS only ever holds
 * the page it is showing. Items carry a content:// uri that expo-image renders directly; no bytes
 * cross the bridge.
 */
object MediaLibrary {

    /** Library sections the UI offers. */
    enum class Category { PHOTOS, VIDEOS, AUDIO, DOCUMENTS, DOWNLOADS, FAVORITES, RECENT, ALL }

    enum class SortOrder { DATE_DESC, DATE_ASC, NAME_ASC, NAME_DESC, SIZE_DESC, SIZE_ASC }

    const val MAX_PAGE_SIZE = 120
    private const val RECENT_WINDOW_DAYS = 30L

    /** Exact MIME types that read as a document to a person, whatever MediaStore classified them as. */
    private val DOCUMENT_MIME_TYPES = listOf(
        "application/pdf",
        "application/epub+zip",
        "application/rtf",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.presentation",
        "application/zip",
        "application/json",
    )

    /** MIME prefixes covering the long tail: anything under the text type is a document here. */
    private val DOCUMENT_MIME_PREFIXES = listOf("text/")

    private val BASE_PROJECTION = arrayOf(
        MediaStore.Files.FileColumns._ID,
        MediaStore.Files.FileColumns.DISPLAY_NAME,
        MediaStore.Files.FileColumns.MIME_TYPE,
        MediaStore.Files.FileColumns.SIZE,
        MediaStore.Files.FileColumns.DATE_ADDED,
        MediaStore.Files.FileColumns.DATE_MODIFIED,
        MediaStore.Files.FileColumns.BUCKET_ID,
        MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME,
        MediaStore.Files.FileColumns.MEDIA_TYPE,
    ) + if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        // readItem has always read these three. They were never asked for, so the cursor had no
        // such columns and every item came back 0x0 with no duration: the gallery's masonry wall
        // had nothing but 1:1 ratios to lay out, so every tile was a square, and no video ever
        // showed its length. The Files collection only gained them in Q.
        arrayOf(
            MediaStore.Files.FileColumns.WIDTH,
            MediaStore.Files.FileColumns.HEIGHT,
            MediaStore.Files.FileColumns.DURATION,
        )
    } else {
        emptyArray()
    } + if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        arrayOf(MediaStore.Files.FileColumns.IS_FAVORITE)
    } else {
        emptyArray()
    }

    data class MediaItem(
        val id: String,
        val uri: String,
        val name: String,
        val mimeType: String,
        val size: Long,
        val createdAt: Long,
        val modifiedAt: Long,
        val durationMs: Long,
        val width: Int,
        val height: Int,
        val albumId: String?,
        val albumName: String?,
        val kind: String,
        val isFavorite: Boolean,
    ) {
        fun toMap(): Map<String, Any?> = mapOf(
            "id" to id,
            "uri" to uri,
            "name" to name,
            "mimeType" to mimeType,
            "size" to size,
            "createdAt" to createdAt,
            "modifiedAt" to modifiedAt,
            "durationMs" to durationMs,
            "width" to width,
            "height" to height,
            "albumId" to albumId,
            "albumName" to albumName,
            "kind" to kind,
            "isFavorite" to isFavorite,
        )
    }

    data class Album(val id: String, val name: String, val itemCount: Int, val coverUri: String?) {
        fun toMap(): Map<String, Any?> = mapOf(
            "id" to id,
            "name" to name,
            "itemCount" to itemCount,
            "coverUri" to coverUri,
        )
    }

    /**
     * One page of [category]. [albumId] narrows to a single bucket, [query] matches the display
     * name. Returns at most [MAX_PAGE_SIZE] items.
     */
    fun page(
        context: Context,
        category: Category,
        albumId: String?,
        query: String?,
        sort: SortOrder,
        offset: Int,
        limit: Int,
    ): List<MediaItem> {
        val safeLimit = limit.coerceIn(1, MAX_PAGE_SIZE)
        val safeOffset = offset.coerceAtLeast(0)
        val selection = buildSelection(category, albumId, query)
        val order = orderBy(sort)

        return runCatching {
            queryPage(context, selection, order, safeLimit, safeOffset).use { cursor ->
                buildList {
                    while (cursor != null && cursor.moveToNext()) {
                        readItem(cursor)?.let(::add)
                    }
                }
            }
        }.getOrElse {
            SetuLog.w(SetuLog.MEDIA, "media page failed: ${it.javaClass.simpleName}")
            emptyList()
        }
    }

    /** Albums (MediaStore buckets) holding photos or videos, most recent first. */
    fun albums(context: Context): List<Album> = runCatching {
        val selection = Selection(
            "(${MediaStore.Files.FileColumns.MEDIA_TYPE} = ? OR ${MediaStore.Files.FileColumns.MEDIA_TYPE} = ?)",
            listOf(
                MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(),
                MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString(),
            ),
        )
        val counts = LinkedHashMap<String, Album>()
        context.contentResolver.query(
            contentUri(),
            arrayOf(
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.BUCKET_ID,
                MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
            ),
            selection.where,
            selection.args.toTypedArray(),
            "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC",
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val bucketId = cursor.stringOrNull(MediaStore.Files.FileColumns.BUCKET_ID) ?: continue
                val name = cursor.stringOrNull(MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME) ?: "Album"
                val existing = counts[bucketId]
                if (existing == null) {
                    val id = cursor.longOrNull(MediaStore.Files.FileColumns._ID) ?: continue
                    val mediaType = cursor.longOrNull(MediaStore.Files.FileColumns.MEDIA_TYPE)?.toInt()
                    counts[bucketId] = Album(bucketId, name, 1, itemUri(id, mediaType).toString())
                } else {
                    counts[bucketId] = existing.copy(itemCount = existing.itemCount + 1)
                }
            }
        }
        counts.values.toList()
    }.getOrElse {
        SetuLog.w(SetuLog.MEDIA, "album listing failed: ${it.javaClass.simpleName}")
        emptyList()
    }

    /** How many items each category currently holds, for the section chips. */
    fun counts(context: Context): Map<String, Int> {
        val result = LinkedHashMap<String, Int>()
        for (category in Category.entries) {
            val selection = buildSelection(category, null, null)
            result[category.name] = runCatching {
                context.contentResolver.query(
                    contentUri(),
                    arrayOf(MediaStore.Files.FileColumns._ID),
                    selection.where,
                    selection.args.toTypedArray(),
                    null,
                )?.use { it.count } ?: 0
            }.getOrDefault(0)
        }
        return result
    }

    // ── Query building ──────────────────────────────────────────────────────────

    private data class Selection(val where: String?, val args: List<String>)

    private fun buildSelection(category: Category, albumId: String?, query: String?): Selection {
        val clauses = mutableListOf<String>()
        val args = mutableListOf<String>()

        when (category) {
            Category.PHOTOS -> {
                clauses += "${MediaStore.Files.FileColumns.MEDIA_TYPE} = ?"
                args += MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString()
            }
            Category.VIDEOS -> {
                clauses += "${MediaStore.Files.FileColumns.MEDIA_TYPE} = ?"
                args += MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString()
            }
            Category.AUDIO -> {
                clauses += "${MediaStore.Files.FileColumns.MEDIA_TYPE} = ?"
                args += MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO.toString()
            }
            Category.DOCUMENTS -> {
                clauses += documentClause()
            }
            Category.DOWNLOADS -> {
                clauses += "${MediaStore.Files.FileColumns.RELATIVE_PATH} LIKE ?"
                args += "%Download%"
            }
            Category.FAVORITES -> {
                // Only Android 11+ records a favourite flag; older versions have no equivalent.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    clauses += "${MediaStore.Files.FileColumns.IS_FAVORITE} = 1"
                } else {
                    clauses += "1 = 0"
                }
            }
            Category.RECENT -> {
                clauses += "${MediaStore.Files.FileColumns.DATE_MODIFIED} >= ?"
                args += ((System.currentTimeMillis() / 1000) - RECENT_WINDOW_DAYS * 24 * 3600).toString()
                clauses += mediaTypeInClause()
            }
            Category.ALL -> clauses += mediaTypeInClause()
        }

        if (!albumId.isNullOrBlank()) {
            clauses += "${MediaStore.Files.FileColumns.BUCKET_ID} = ?"
            args += albumId
        }
        val needle = query?.trim().orEmpty()
        if (needle.isNotEmpty()) {
            clauses += "${MediaStore.Files.FileColumns.DISPLAY_NAME} LIKE ? ESCAPE '\\'"
            args += "%${needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")}%"
        }
        // Never list placeholder rows for files that are still being written.
        clauses += "${MediaStore.Files.FileColumns.SIZE} > 0"

        return Selection(clauses.joinToString(" AND "), args)
    }

    private fun mediaTypeInClause(): String {
        val media = "${MediaStore.Files.FileColumns.MEDIA_TYPE} IN (" +
            listOf(
                MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE,
                MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO,
                MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO,
            ).joinToString(",") + ")"
        return "($media OR ${documentClause()})"
    }

    /**
     * Documents are matched on MIME type, not on MEDIA_TYPE. MediaStore only sets
     * MEDIA_TYPE_DOCUMENT for a narrow set of files, so a PDF, a spreadsheet or a text file is
     * normally indexed as MEDIA_TYPE_NONE and a MEDIA_TYPE query returns nothing for them.
     */
    private fun documentClause(): String {
        val mimes = DOCUMENT_MIME_TYPES.joinToString(",") { "'$it'" }
        val prefixes = DOCUMENT_MIME_PREFIXES.joinToString(" OR ") {
            "${MediaStore.Files.FileColumns.MIME_TYPE} LIKE '$it%'"
        }
        return "(${MediaStore.Files.FileColumns.MIME_TYPE} IN ($mimes) OR $prefixes OR " +
            "${MediaStore.Files.FileColumns.MEDIA_TYPE} = " +
            "${MediaStore.Files.FileColumns.MEDIA_TYPE_DOCUMENT})"
    }

    private fun orderBy(sort: SortOrder): String = when (sort) {
        SortOrder.DATE_DESC -> "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC"
        SortOrder.DATE_ASC -> "${MediaStore.Files.FileColumns.DATE_MODIFIED} ASC"
        SortOrder.NAME_ASC -> "${MediaStore.Files.FileColumns.DISPLAY_NAME} COLLATE NOCASE ASC"
        SortOrder.NAME_DESC -> "${MediaStore.Files.FileColumns.DISPLAY_NAME} COLLATE NOCASE DESC"
        SortOrder.SIZE_DESC -> "${MediaStore.Files.FileColumns.SIZE} DESC"
        SortOrder.SIZE_ASC -> "${MediaStore.Files.FileColumns.SIZE} ASC"
    }

    /** Android 11+ takes paging through QUERY_ARG_*; older versions use the LIMIT suffix. */
    private fun queryPage(
        context: Context,
        selection: Selection,
        order: String,
        limit: Int,
        offset: Int,
    ): Cursor? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val args = Bundle().apply {
            putString(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION, selection.where)
            putStringArray(
                android.content.ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,
                selection.args.toTypedArray(),
            )
            putString(android.content.ContentResolver.QUERY_ARG_SQL_SORT_ORDER, order)
            putInt(android.content.ContentResolver.QUERY_ARG_LIMIT, limit)
            putInt(android.content.ContentResolver.QUERY_ARG_OFFSET, offset)
        }
        context.contentResolver.query(contentUri(), BASE_PROJECTION, args, null)
    } else {
        context.contentResolver.query(
            contentUri(),
            BASE_PROJECTION,
            selection.where,
            selection.args.toTypedArray(),
            "$order LIMIT $limit OFFSET $offset",
        )
    }

    private fun contentUri(): Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
        @Suppress("DEPRECATION")
        MediaStore.Files.getContentUri("external")
    }

    private fun itemUri(id: Long, mediaType: Int?): Uri = when (mediaType) {
        MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE ->
            ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
        MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO ->
            ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)
        MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO ->
            ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
        else -> ContentUris.withAppendedId(contentUri(), id)
    }

    private fun readItem(cursor: Cursor): MediaItem? {
        val id = cursor.longOrNull(MediaStore.Files.FileColumns._ID) ?: return null
        val mediaType = cursor.longOrNull(MediaStore.Files.FileColumns.MEDIA_TYPE)?.toInt()
        val mime = cursor.stringOrNull(MediaStore.Files.FileColumns.MIME_TYPE) ?: "application/octet-stream"
        return MediaItem(
            id = id.toString(),
            uri = itemUri(id, mediaType).toString(),
            name = cursor.stringOrNull(MediaStore.Files.FileColumns.DISPLAY_NAME) ?: "Untitled",
            mimeType = mime,
            size = cursor.longOrNull(MediaStore.Files.FileColumns.SIZE) ?: 0L,
            createdAt = (cursor.longOrNull(MediaStore.Files.FileColumns.DATE_ADDED) ?: 0L) * 1000,
            modifiedAt = (cursor.longOrNull(MediaStore.Files.FileColumns.DATE_MODIFIED) ?: 0L) * 1000,
            durationMs = cursor.longOrNull(MediaStore.Files.FileColumns.DURATION) ?: 0L,
            width = cursor.longOrNull(MediaStore.Files.FileColumns.WIDTH)?.toInt() ?: 0,
            height = cursor.longOrNull(MediaStore.Files.FileColumns.HEIGHT)?.toInt() ?: 0,
            albumId = cursor.stringOrNull(MediaStore.Files.FileColumns.BUCKET_ID),
            albumName = cursor.stringOrNull(MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME),
            kind = when {
                mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE || mime.startsWith("image/") -> "image"
                mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO || mime.startsWith("video/") -> "video"
                mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO || mime.startsWith("audio/") -> "audio"
                else -> "document"
            },
            // Only Android 11+ has the column; below that the flag is absent, never "false by fact".
            isFavorite = (cursor.longOrNull(MediaStore.Files.FileColumns.IS_FAVORITE) ?: 0L) == 1L,
        )
    }

    private fun Cursor.stringOrNull(column: String): String? =
        getColumnIndex(column).takeIf { it >= 0 && !isNull(it) }?.let(::getString)

    private fun Cursor.longOrNull(column: String): Long? =
        getColumnIndex(column).takeIf { it >= 0 && !isNull(it) }?.let(::getLong)
}
