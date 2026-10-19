package expo.modules.setunative.content

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import expo.modules.setunative.models.*
import expo.modules.setunative.persistence.ContentRepository
import java.security.MessageDigest
import java.util.ArrayDeque

internal object SafTreeScanner {
    private const val PREFS = "setu_content_access"
    private const val TREE_URIS = "tree_uris"
    private const val MAX_ITEMS = 5000

    fun rememberTree(context: Context, treeUri: Uri) {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val trees = preferences.getStringSet(TREE_URIS, emptySet()).orEmpty().toMutableSet()
        trees.add(treeUri.toString())
        preferences.edit().putStringSet(TREE_URIS, trees).apply()
    }

    fun scanRemembered(
        context: Context,
        repository: ContentRepository,
        ownerId: String,
        onDiscovered: (SetuContent) -> Unit
    ): Int {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val trees = preferences.getStringSet(TREE_URIS, emptySet()).orEmpty().toSet()
        var total = 0
        for (tree in trees) {
            try {
                total += scanTree(context, repository, ownerId, Uri.parse(tree), onDiscovered).size
            } catch (_: SecurityException) {
                preferences.edit().putStringSet(TREE_URIS, trees - tree).apply()
            }
        }
        return total
    }

    fun scanTree(
        context: Context,
        repository: ContentRepository,
        ownerId: String,
        treeUri: Uri,
        onDiscovered: (SetuContent) -> Unit = {}
    ): List<SetuContent> {
        val pending = ArrayDeque<String>()
        val rootId = DocumentsContract.getTreeDocumentId(treeUri)
        pending.add(rootId)
        val seen = HashSet<String>()
        val found = ArrayList<SetuContent>()
        val columns = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
            DocumentsContract.Document.COLUMN_SIZE
        )

        while (pending.isNotEmpty() && seen.size < MAX_ITEMS) {
            val parentId = pending.removeFirst()
            val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId)
            context.contentResolver.query(childrenUri, columns, null, null, null)?.use { cursor ->
                val idColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                val nameColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                val mimeColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
                val modifiedColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
                val sizeColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE)
                while (cursor.moveToNext() && seen.size < MAX_ITEMS) {
                    val documentId = cursor.getString(idColumn) ?: continue
                    if (!seen.add(documentId)) continue
                    val mimeType = cursor.getString(mimeColumn) ?: "application/octet-stream"
                    if (mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
                        pending.add(documentId)
                        continue
                    }
                    val documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
                    val item = SetuContent(
                        contentId = "saf_${sha256(documentUri.toString()).take(32)}",
                        type = contentType(mimeType),
                        name = cursor.getString(nameColumn) ?: "Unnamed",
                        mimeType = mimeType,
                        size = if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) cursor.getLong(sizeColumn) else 0L,
                        createdAt = 0L,
                        modifiedAt = if (modifiedColumn >= 0 && !cursor.isNull(modifiedColumn)) cursor.getLong(modifiedColumn) else 0L,
                        source = ContentSource.SAF,
                        sourceUri = documentUri.toString(),
                        storageMode = StorageMode.EXTERNAL,
                        encryptionMode = EncryptionMode.NONE,
                        manifestId = null,
                        ownerId = ownerId,
                        visibility = Visibility.PRIVATE,
                        availability = Availability.FULL,
                        state = ContentState.ACTIVE
                    )
                    val isNew = repository.get(item.contentId) == null
                    if (repository.upsert(item)) {
                        found.add(item)
                        if (isNew) onDiscovered(item)
                    }
                }
            }
        }
        return found
    }

    private fun contentType(mimeType: String): ContentType = when {
        mimeType.startsWith("image/") -> ContentType.IMAGE
        mimeType.startsWith("video/") -> ContentType.VIDEO
        mimeType.startsWith("audio/") -> ContentType.AUDIO
        mimeType.startsWith("application/") -> ContentType.DOCUMENT
        else -> ContentType.OTHER
    }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
