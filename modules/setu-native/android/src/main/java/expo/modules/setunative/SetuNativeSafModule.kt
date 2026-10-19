package expo.modules.setunative

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.content.SafTreeScanner
import expo.modules.setunative.models.SetuContent
import expo.modules.setunative.persistence.ContentRepository

class SetuNativeSafModule : Module() {
    companion object {
        private const val TREE_REQUEST = 7401
    }

    private var pendingPromise: Promise? = null
    private var pendingOwnerId: String? = null

    override fun definition() = ModuleDefinition {
        Name("SetuNativeSaf")
        AsyncFunction("selectSafTree") { ownerId: String, promise: Promise ->
            selectTree(ownerId, promise)
        }
        OnActivityResult { _, payload ->
            if (payload.requestCode == TREE_REQUEST) finishTreeSelection(payload.resultCode, payload.data)
        }
    }

    private fun selectTree(ownerId: String, promise: Promise) {
        val activity = appContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Foreground activity is required", null)
            return
        }
        if (pendingPromise != null) {
            promise.reject("IN_PROGRESS", "A folder selection is already active", null)
            return
        }
        pendingPromise = promise
        pendingOwnerId = ownerId
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        try {
            activity.startActivityForResult(intent, TREE_REQUEST)
        } catch (error: Exception) {
            pendingPromise = null
            pendingOwnerId = null
            promise.reject("SAF_UNAVAILABLE", error.message ?: "Folder selection failed", null)
        }
    }

    private fun finishTreeSelection(resultCode: Int, data: Intent?) {
        val promise = pendingPromise ?: return
        val ownerId = pendingOwnerId.orEmpty()
        pendingPromise = null
        pendingOwnerId = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null || ownerId.isBlank()) {
            promise.reject("SAF_CANCELLED", "No folder was selected", null)
            return
        }
        try {
            val context = appContext.reactContext?.applicationContext
                ?: throw IllegalStateException("React context unavailable")
            val grants = (data.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION) or
                (data.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            context.contentResolver.takePersistableUriPermission(
                uri,
                grants and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            )
            SafTreeScanner.rememberTree(context, uri)
            val content = SafTreeScanner.scanTree(context, ContentRepository.create(context), ownerId, uri)
            promise.resolve(content.size)
        } catch (error: Exception) {
            promise.reject("SAF_SCAN_FAILED", error.message ?: "Could not scan the selected folder", null)
        }
    }

    private fun contentToMap(content: SetuContent): Map<String, Any?> = mapOf(
        "contentId" to content.contentId,
        "type" to content.type.name,
        "name" to content.name,
        "mimeType" to content.mimeType,
        "size" to content.size,
        "createdAt" to content.createdAt,
        "modifiedAt" to content.modifiedAt,
        "sourceUri" to (content.sourceUri ?: ""),
        "storageMode" to content.storageMode.name,
        "encryptionMode" to content.encryptionMode.name,
        "manifestId" to (content.manifestId ?: ""),
        "ownerId" to content.ownerId,
        "visibility" to content.visibility.name,
        "availability" to content.availability.name,
        "state" to content.state.name,
        "thumbnailUri" to (content.thumbnailUri ?: "")
    )
}
