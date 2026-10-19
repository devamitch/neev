package expo.modules.setunative.content

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.setunative.shared.SetuLog
import java.io.File

/**
 * Publishes a received file into the phone's own media collections.
 *
 * A completed transfer is assembled into app-private internal storage, which is correct while the
 * bytes are being verified and wrong the moment they are the user's. Nothing outside Setu can read
 * that directory and MediaStore has never heard of it, so a received photo was absent from the
 * gallery, from Photos, from Recent, and from every other browse surface in the app that reads
 * MediaStore. The file was intact the whole time; it simply did not exist as far as the phone was
 * concerned.
 *
 * Publication MOVES the file rather than copying it. The project rule is one logical file with one
 * physical copy: a piece store copy plus an assembled copy plus a MediaStore copy is three times
 * the storage for one photo. After this returns, the private file is gone and the `content://` URI
 * is the only handle.
 *
 * Android version behaviour is deliberately different, not papered over:
 *
 *  - API 29+ owns its own inserts under scoped storage, so no permission is involved and the write
 *    is staged through IS_PENDING so nothing half-written is ever visible.
 *  - API 26-28 would need WRITE_EXTERNAL_STORAGE, which Setu does not request and should not. The
 *    file stays private and is reached through the FileProvider instead. That is a real
 *    limitation of those versions, reported honestly rather than faked.
 */
internal object MediaStorePublisher {

    /** The published `content://` URI, or null when this build cannot publish. */
    fun publish(context: Context, file: File, displayName: String, mimeType: String): Uri? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        if (!file.exists() || file.length() == 0L) return null

        val target = collectionFor(mimeType) ?: return null
        val resolver = context.contentResolver

        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
            put(MediaStore.MediaColumns.RELATIVE_PATH, target.relativePath)
            // Nothing sees a partially written file.
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }

        val uri = try {
            resolver.insert(target.collection, values)
        } catch (error: Exception) {
            SetuLog.e(SetuLog.STORAGE, "MediaStore insert failed: ${error.message}")
            null
        } ?: return null

        return try {
            // Streamed, so a large video never has to fit in memory.
            resolver.openOutputStream(uri)?.use { output ->
                file.inputStream().use { input -> input.copyTo(output, DEFAULT_BUFFER_SIZE) }
            } ?: throw IllegalStateException("MEDIASTORE_STREAM_UNAVAILABLE")

            resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)

            // One logical file, one physical copy.
            if (!file.delete()) {
                SetuLog.w(SetuLog.STORAGE, "published but could not remove the private copy")
            }
            uri
        } catch (error: Exception) {
            // Leave nothing half-published behind, and keep the private file as the usable copy.
            runCatching { resolver.delete(uri, null, null) }
            SetuLog.e(SetuLog.STORAGE, "MediaStore publish failed: ${error.message}")
            null
        }
    }

    private data class Target(val collection: Uri, val relativePath: String)

    /**
     * Where the phone expects this kind of file to live. Documents and anything unrecognised go to
     * Downloads, which is what every other app does with a received file.
     */
    private fun collectionFor(mimeType: String): Target? = when {
        mimeType.startsWith("image/") -> Target(
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
            "${Environment.DIRECTORY_PICTURES}/$FOLDER",
        )
        mimeType.startsWith("video/") -> Target(
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
            "${Environment.DIRECTORY_MOVIES}/$FOLDER",
        )
        mimeType.startsWith("audio/") -> Target(
            MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
            "${Environment.DIRECTORY_MUSIC}/$FOLDER",
        )
        else -> Target(
            MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
            "${Environment.DIRECTORY_DOWNLOADS}/$FOLDER",
        )
    }

    private const val FOLDER = "Setu"
}
