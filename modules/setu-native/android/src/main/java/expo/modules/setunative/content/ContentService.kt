package expo.modules.setunative.content

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.governor.ResourceGovernor
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

/**
 * Content Service for managing all Setu content operations.
 * Handles SAF trees, MediaStore integration, thumbnails, and content discovery.
 */
class ContentService(
    private val context: Context,
    private val contentRepository: ContentRepository,
    private val governor: ResourceGovernor
) {

    companion object {
        private const val TAG = "SETU_CONTENT_SVC"
        private const val THUMBNAIL_SIZE = 512
        private const val MAX_CONTENT_SCAN = 1000
        private const val CONTENT_BATCH_SIZE = 100
    }

    private val executor = Executors.newCachedThreadPool()
    private val thumbnailCache = mutableMapOf<String, String>()
    private var isMonitoring = false
    private var lastScannedOwnerId: String? = null
    private var mediaStoreObserver: MediaStoreObserver? = null

    interface ContentListener {
        fun onContentDiscovered(content: SetuContent)
        fun onContentRemoved(contentId: String)
        fun onContentUpdated(content: SetuContent)
        fun onScanProgress(current: Int, total: Int)
        fun onScanComplete(total: Int)
        fun onScanFailed(reason: String)
    }

    private val listeners = mutableListOf<ContentListener>()

    fun addListener(listener: ContentListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: ContentListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    fun startMonitoring() {
        if (isMonitoring) return
        isMonitoring = true
        mediaStoreObserver = MediaStoreObserver(context.contentResolver) {
            lastScannedOwnerId?.let { ownerId ->
                if (isMonitoring) scanContentSources(ownerId)
            }
        }.also { it.start() }
        Log.i(TAG, "Content service monitoring started")
    }

    fun stopMonitoring() {
        if (!isMonitoring) return
        isMonitoring = false
        mediaStoreObserver?.stop()
        mediaStoreObserver = null
        Log.i(TAG, "Content service monitoring stopped")
    }

    /**
     * Scan for accessible content from all sources
     */
    fun scanContentSources(ownerId: String) {
        lastScannedOwnerId = ownerId
        executor.execute {
            try {
                if (governor.isConstrained()) {
                    Log.w(TAG, "Content scan deferred due to resource constraints")
                    notifyScanFailed("RESOURCE_CONSTRAINED")
                    return@execute
                }

                val scanCount = scanMediaStoreContent(ownerId) +
                               scanSafContent(ownerId) +
                               scanSetuManagedContent(ownerId)

                synchronized(listeners) {
                    for (listener in listeners) {
                        listener.onScanComplete(scanCount)
                    }
                }

            } catch (e: Exception) {
                Log.e(TAG, "Content scan failed", e)
                notifyScanFailed("SCAN_FAILED")
            }
        }
    }

    private fun notifyScanFailed(reason: String) {
        synchronized(listeners) {
            listeners.forEach { it.onScanFailed(reason) }
        }
    }

    private fun scanMediaStoreContent(ownerId: String): Int {
        var count = 0
        val mediaTypes = listOf(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        )

        for (mediaType in mediaTypes) {
            count += scanMediaStoreType(mediaType, ownerId, ContentSource.MEDIASTORE)
        }

        return count
    }

    private fun scanMediaStoreType(
        uri: Uri,
        ownerId: String,
        source: ContentSource
    ): Int {
        var count = 0
        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.MIME_TYPE,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.DATE_ADDED,
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.WIDTH,
            MediaStore.MediaColumns.HEIGHT,
            MediaStore.MediaColumns.DURATION
        )

        val sortOrder = "${MediaStore.MediaColumns.DATE_MODIFIED} DESC"

        try {
            context.contentResolver.query(uri, projection, null, null, sortOrder)?.use { cursor ->
                while (cursor.moveToNext() && count < MAX_CONTENT_SCAN) {
                    val contentId = "${source.name}_${cursor.getLong(0)}"
                    val name = cursor.getString(1) ?: "Unnamed"
                    val mimeType = cursor.getString(2) ?: "application/octet-stream"
                    val size = cursor.getLong(3)
                    val createdAt = cursor.getLong(4) * 1000 // Convert to milliseconds
                    val modifiedAt = cursor.getLong(5) * 1000

                    // Skip if this content already exists
                    if (contentRepository.get(contentId) != null) {
                        continue
                    }

                    val contentType = getContentType(mimeType)
                    val contentUri = ContentUris.withAppendedId(uri, cursor.getLong(0))

                    val content = SetuContent(
                        contentId = contentId,
                        type = contentType,
                        name = name,
                        mimeType = mimeType,
                        size = size,
                        createdAt = createdAt,
                        modifiedAt = modifiedAt,
                        source = source,
                        sourceUri = contentUri.toString(),
                        storageMode = StorageMode.EXTERNAL,
                        encryptionMode = EncryptionMode.NONE,
                        manifestId = null,
                        ownerId = ownerId,
                        visibility = Visibility.PRIVATE,
                        availability = Availability.FULL,
                        state = ContentState.ACTIVE,
                        thumbnailUri = null,
                        metadata = getMediaMetadata(cursor)
                    )

                    // Save to repository
                    contentRepository.upsert(content)

                    synchronized(listeners) {
                        for (listener in listeners) {
                            listener.onContentDiscovered(content)
                        }
                    }

                    count++
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to scan MediaStore $uri", e)
        }

        return count
    }

    private fun scanSafContent(ownerId: String): Int {
        return SafTreeScanner.scanRemembered(context, contentRepository, ownerId) { content ->
            synchronized(listeners) {
                listeners.forEach { it.onContentDiscovered(content) }
            }
        }
    }

    private fun scanSetuManagedContent(ownerId: String): Int {
        // Scan for content that Setu has already managed
        val existing = contentRepository.getByOwner(ownerId)
        return existing.filter { it.source == ContentSource.SETU_MANAGED }.size
    }

    private fun getContentType(mimeType: String): ContentType {
        return when {
            mimeType.startsWith("image/") -> ContentType.IMAGE
            mimeType.startsWith("video/") -> ContentType.VIDEO
            mimeType.startsWith("audio/") -> ContentType.AUDIO
            mimeType.startsWith("application/") -> ContentType.DOCUMENT
            else -> ContentType.OTHER
        }
    }

    private fun getMediaMetadata(cursor: Cursor): Map<String, String> {
        val metadata = mutableMapOf<String, String>()

        try {
            val widthIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.WIDTH)
            if (widthIndex >= 0) {
                metadata["width"] = cursor.getInt(widthIndex).toString()
            }
        } catch (e: Exception) {}

        try {
            val heightIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.HEIGHT)
            if (heightIndex >= 0) {
                metadata["height"] = cursor.getInt(heightIndex).toString()
            }
        } catch (e: Exception) {}

        try {
            val durationIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DURATION)
            if (durationIndex >= 0) {
                metadata["duration"] = cursor.getLong(durationIndex).toString()
            }
        } catch (e: Exception) {}

        return metadata
    }

    /**
     * Generate thumbnail for a content item
     */
    fun generateThumbnail(content: SetuContent): String? {
        if (thumbnailCache.containsKey(content.contentId)) {
            return thumbnailCache[content.contentId]
        }

        return try {
            val contentUri = content.sourceUri?.let { Uri.parse(it) }
            val thumbnailPath = generateThumbnailFromUri(contentUri, content.contentId)

            if (thumbnailPath != null) {
                thumbnailCache[content.contentId] = thumbnailPath
                // Update content with thumbnail URI
                val updatedContent = content.copy(thumbnailUri = thumbnailPath)
                contentRepository.upsert(updatedContent)
            }

            thumbnailPath
        } catch (e: Exception) {
            Log.e(TAG, "Failed to generate thumbnail for ${content.contentId}", e)
            null
        }
    }

    private fun generateThumbnailFromUri(uri: Uri?, contentId: String): String? {
        if (uri == null) return null

        return try {
            val thumbnailDir = File(context.cacheDir, "thumbnails")
            if (!thumbnailDir.exists()) thumbnailDir.mkdirs()

            val thumbnailFile = File(thumbnailDir, "$contentId.jpg")

            when {
                uri.scheme == "content" -> {
                    context.contentResolver.openInputStream(uri)?.use { inputStream ->
                        val bitmap = if (uri.toString().contains("image") ||
                                       uri.toString().contains("video")) {
                            android.graphics.BitmapFactory.decodeStream(inputStream)
                        } else {
                            null
                        }

                        bitmap?.let { bmp ->
                            val scaledBitmap = android.graphics.Bitmap.createScaledBitmap(
                                bmp, THUMBNAIL_SIZE, THUMBNAIL_SIZE, false
                            )
                            FileOutputStream(thumbnailFile).use { outputStream ->
                                scaledBitmap.compress(
                                    Bitmap.CompressFormat.JPEG,
                                    85,
                                    outputStream
                                )
                            }
                            scaledBitmap.recycle()
                            bmp.recycle()
                            thumbnailFile.absolutePath
                        }
                    }
                }
                uri.scheme == "file" -> {
                    val sourceFile = File(uri.path!!)
                    if (sourceFile.exists()) {
                        val bitmap = android.graphics.BitmapFactory.decodeFile(sourceFile.absolutePath)
                        bitmap?.let { bmp ->
                            val scaledBitmap = android.graphics.Bitmap.createScaledBitmap(
                                bmp, THUMBNAIL_SIZE, THUMBNAIL_SIZE, false
                            )
                            FileOutputStream(thumbnailFile).use { outputStream ->
                                scaledBitmap.compress(
                                    Bitmap.CompressFormat.JPEG,
                                    85,
                                    outputStream
                                )
                            }
                            scaledBitmap.recycle()
                            bmp.recycle()
                            thumbnailFile.absolutePath
                        }
                    } else null
                }
                else -> null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to generate thumbnail for URI: $uri", e)
            null
        }
    }

    /**
     * Get content by ID
     */
    fun getContent(contentId: String): SetuContent? {
        return contentRepository.get(contentId)
    }

    /**
     * Get all content for an owner
     */
    fun getContentByOwner(ownerId: String): List<SetuContent> {
        return contentRepository.getByOwner(ownerId)
    }

    fun getContentPage(ownerId: String, offset: Int, limit: Int): List<SetuContent> {
        return contentRepository.getByOwnerPage(ownerId, offset, limit)
    }

    /**
     * Search content by name
     */
    fun searchContent(query: String, ownerId: String, limit: Int = 50): List<SetuContent> {
        return contentRepository.searchByName(query, ownerId, limit)
    }

    /**
     * Get content by type
     */
    fun getContentByType(type: ContentType, ownerId: String): List<SetuContent> {
        return contentRepository.getByOwner(ownerId)
            .filter { it.type == type }
    }

    /**
     * Get content by storage mode
     */
    fun getContentByStorageMode(storageMode: StorageMode, ownerId: String): List<SetuContent> {
        return contentRepository.getByStorageMode(storageMode)
            .filter { it.ownerId == ownerId }
    }

    /**
     * Update content state
     */
    fun updateContentState(contentId: String, state: ContentState): Boolean {
        return contentRepository.updateState(contentId, state)
    }

    /**
     * Delete content
     */
    fun deleteContent(contentId: String): Boolean {
        // Delete from repository
        val deleted = contentRepository.delete(contentId)

        // Also delete from cache
        thumbnailCache.remove(contentId)

        synchronized(listeners) {
            for (listener in listeners) {
                listener.onContentRemoved(contentId)
            }
        }

        return deleted
    }

    /**
     * Get content stream for reading
     */
    fun getContentStream(content: SetuContent): java.io.InputStream? {
        return try {
            content.sourceUri?.let { Uri.parse(it) }?.let { uri ->
                context.contentResolver.openInputStream(uri)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open content stream for ${content.contentId}", e)
            null
        }
    }

    /**
     * Get content file
     */
    fun getContentFile(content: SetuContent): File? {
        return try {
            content.sourceUri?.let { sourceUri ->
                if (sourceUri.startsWith("file://")) {
                    File(sourceUri.substring("file://".length))
                } else {
                    // For content URIs, we'd need to copy to a temp file
                    // This is more complex and would require additional permissions
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get content file for ${content.contentId}", e)
            null
        }
    }

    /**
     * Add Setu-managed content
     */
    fun addSetuManagedContent(
        name: String,
        mimeType: String,
        size: Long,
        sourceUri: String,
        ownerId: String,
        manifestId: String? = null
    ): SetuContent {
        val contentId = "setu_${System.currentTimeMillis()}_${java.util.UUID.randomUUID()}"

        val content = SetuContent(
            contentId = contentId,
            type = getContentType(mimeType),
            name = name,
            mimeType = mimeType,
            size = size,
            createdAt = System.currentTimeMillis(),
            modifiedAt = System.currentTimeMillis(),
            source = ContentSource.SETU_MANAGED,
            sourceUri = sourceUri,
            storageMode = StorageMode.SETU_MANAGED,
            encryptionMode = EncryptionMode.NONE,
            manifestId = manifestId,
            ownerId = ownerId,
            visibility = Visibility.PRIVATE,
            availability = Availability.FULL,
            state = ContentState.ACTIVE,
            thumbnailUri = null
        )

        contentRepository.upsert(content)

        synchronized(listeners) {
            for (listener in listeners) {
                listener.onContentDiscovered(content)
            }
        }

        return content
    }

    /**
     * Copy content to Setu-managed storage
     */
    fun copyToSetuManaged(content: SetuContent): SetuContent? {
        return try {
            val sourceUri = content.sourceUri ?: return null
            val sourceFile = getContentFile(content) ?: return null

            // Create destination in Setu-managed storage
            val setuDir = File(context.filesDir, "setu_managed")
            if (!setuDir.exists()) setuDir.mkdirs()

            val destFile = File(setuDir, "${content.contentId}_${content.name}")

            // Copy file
            sourceFile.inputStream().use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }

            // Create new Setu-managed content record
            val setuContent = content.copy(
                contentId = "setu_${System.currentTimeMillis()}",
                source = ContentSource.SETU_MANAGED,
                sourceUri = destFile.absolutePath,
                storageMode = StorageMode.SETU_MANAGED,
                modifiedAt = System.currentTimeMillis()
            )

            contentRepository.upsert(setuContent)

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onContentDiscovered(setuContent)
                }
            }

            setuContent
        } catch (e: Exception) {
            Log.e(TAG, "Failed to copy content to Setu-managed storage", e)
            null
        }
    }

    /**
     * Sort content by various criteria
     */
    fun sortContent(
        contents: List<SetuContent>,
        sortBy: String = "modified",
        sortOrder: String = "desc"
    ): List<SetuContent> {
        return when (sortBy) {
            "name" -> when (sortOrder) {
                "asc" -> contents.sortedBy { it.name.lowercase() }
                "desc" -> contents.sortedByDescending { it.name.lowercase() }
                else -> contents
            }
            "size" -> when (sortOrder) {
                "asc" -> contents.sortedBy { it.size }
                "desc" -> contents.sortedByDescending { it.size }
                else -> contents
            }
            "created" -> when (sortOrder) {
                "asc" -> contents.sortedBy { it.createdAt }
                "desc" -> contents.sortedByDescending { it.createdAt }
                else -> contents
            }
            else -> when (sortOrder) {
                "asc" -> contents.sortedBy { it.modifiedAt }
                "desc" -> contents.sortedByDescending { it.modifiedAt }
                else -> contents
            }
        }
    }

    /**
     * Filter content by various criteria
     */
    fun filterContent(
        contents: List<SetuContent>,
        contentTypes: Set<ContentType>? = null,
        storageModes: Set<StorageMode>? = null,
        minSize: Long? = null,
        maxSize: Long? = null
    ): List<SetuContent> {
        return contents.filter { content ->
            (contentTypes == null || content.type in contentTypes) &&
            (storageModes == null || content.storageMode in storageModes) &&
            (minSize == null || content.size >= minSize) &&
            (maxSize == null || content.size <= maxSize)
        }
    }

    /**
     * Get content statistics
     */
    fun getContentStats(ownerId: String): Map<String, Any> {
        val allContent = contentRepository.getByOwner(ownerId)

        val byType = allContent.groupBy { it.type }.mapValues { it.value.size }
        val byStorageMode = allContent.groupBy { it.storageMode }.mapValues { it.value.size }
        val byVisibility = allContent.groupBy { it.visibility }.mapValues { it.value.size }
        val totalSize = allContent.sumOf { it.size }

        return mapOf(
            "total_content" to allContent.size,
            "total_size" to totalSize,
            "by_type" to byType,
            "by_storage_mode" to byStorageMode,
            "by_visibility" to byVisibility
        )
    }

    /**
     * Clean up cache and temporary files
     */
    fun cleanupCache() {
        // Clean up thumbnail cache
        val thumbnailDir = File(context.cacheDir, "thumbnails")
        if (thumbnailDir.exists()) {
            thumbnailDir.deleteRecursively()
            thumbnailDir.mkdirs()
        }

        thumbnailCache.clear()
    }

    fun shutdown() {
        stopMonitoring()
        cleanupCache()
        executor.shutdown()
    }
}
