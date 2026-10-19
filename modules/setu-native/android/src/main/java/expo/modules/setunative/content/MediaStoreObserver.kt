package expo.modules.setunative.content

import android.content.ContentResolver
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore

internal class MediaStoreObserver(
    private val resolver: ContentResolver,
    private val onChanged: (Uri?) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())
    private var pendingChange: Uri? = null
    private val notify = Runnable {
        val changedUri = pendingChange
        pendingChange = null
        onChanged(changedUri)
    }
    private val observer = object : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            pendingChange = uri
            handler.removeCallbacks(notify)
            handler.postDelayed(notify, DEBOUNCE_MS)
        }
    }

    fun start() {
        listOf(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        ).forEach { resolver.registerContentObserver(it, true, observer) }
    }

    fun stop() {
        resolver.unregisterContentObserver(observer)
        handler.removeCallbacks(notify)
        pendingChange = null
    }

    private companion object {
        const val DEBOUNCE_MS = 500L
    }
}
