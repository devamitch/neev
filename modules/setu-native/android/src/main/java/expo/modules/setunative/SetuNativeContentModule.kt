package expo.modules.setunative

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.setunative.security.IdentityVault
import expo.modules.setunative.shared.SetuLog
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.bootstrap.SetuRuntime
import expo.modules.setunative.content.ContentEvents
import expo.modules.setunative.content.ContentService
import expo.modules.setunative.content.MediaLibrary
import expo.modules.setunative.content.PdfRendererService
import expo.modules.setunative.models.SetuContent
import expo.modules.setunative.shared.SetuEvents
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.vault.VaultService
import java.io.File
import java.io.InputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Bridge module for Setu content management (Library).
 * Handles content scan, query, state, thumbnails, and registration of received pieces.
 */
class SetuNativeContentModule : Module() {

    companion object {
        private const val DELETE_REQUEST = 7411
        private const val FAVORITE_REQUEST = 7412
    }

    private var vaultService: VaultService? = null
    private val vaultReadHandles = ConcurrentHashMap<String, InputStream>()
    private var pendingDelete: Promise? = null
    private var pendingDeleteCount: Int = 0
    private var pendingFavorite: Promise? = null
    private var pendingFavoriteCount: Int = 0

    /* Contract: listVaultContent(ownerId); importContentToVault(contentId);
     * copyContentToVault(contentId); moveContentToVault(contentId) -> {operation, content};
     * exportVaultContent(contentId, destinationUri, warningConfirmed);
     * deleteVaultContent(contentId); openVaultContentForRead(contentId) -> native handle.
     * Errors reject with VAULT_CONTENT_NOT_FOUND, VAULT_LOCKED, VAULT_OPERATION_FAILED,
     * or EXPORT_CONFIRMATION_REQUIRED. Events: onVaultContentChanged.
     */

    override fun definition() = ModuleDefinition {
        Name("SetuNativeContent")
        Events("onContentDiscovered", "onContentRemoved", "onScanProgress", "onScanComplete", "onScanFailed", "onVaultContentChanged")

        OnCreate { SetuEvents.attach(SetuEvents.CONTENT, this@SetuNativeContentModule) }

        OnDestroy {
            SetuEvents.detach(SetuEvents.CONTENT, this@SetuNativeContentModule)
            vaultReadHandles.values.forEach { runCatching { it.close() } }
            vaultReadHandles.clear()
            PdfRendererService.closeAll()
            vaultService?.shutdown()
        }

        // ── Scan ──────────────────────────────────────────────────────────────

        AsyncFunction("scanContent") { ownerId: String ->
            svc().scanContentSources(ownerId)
        }

        // ── Query ─────────────────────────────────────────────────────────────

        AsyncFunction("getContent") { contentId: String ->
            svc().getContent(contentId)?.let { contentToMap(it) }
        }

        AsyncFunction("getContentByOwner") { ownerId: String ->
            svc().getContentByOwner(ownerId).map { contentToMap(it) }
        }

        /* Contract: getContentPage(ownerId, offset, limit<=100) -> one ordered page. */
        AsyncFunction("getContentPage") { ownerId: String, offset: Int, limit: Int ->
            svc().getContentPage(ownerId, offset, limit).map { contentToMap(it) }
        }

        AsyncFunction("searchContent") { query: String, ownerId: String, limit: Int ->
            svc().searchContent(query, ownerId, limit).map { contentToMap(it) }
        }

        // ── State ─────────────────────────────────────────────────────────────

        AsyncFunction("deleteContent") { contentId: String ->
            svc().deleteContent(contentId)
        }

        // ── Vault content ──────────────────────────────────────────────────────

        AsyncFunction("listVaultContent") { ownerId: String ->
            vaultSvc().getVaultContent(ownerId).map { contentToMap(it) }
        }

        AsyncFunction("importContentToVault") { contentId: String ->
            val source = contentRepo().get(contentId) ?: error("VAULT_CONTENT_NOT_FOUND")
            val stored = vaultSvc().copyToVault(source) ?: error("VAULT_OPERATION_FAILED")
            sendEvent("onVaultContentChanged", mapOf("operation" to "IMPORTED", "contentId" to stored.contentId))
            contentToMap(stored)
        }

        AsyncFunction("copyContentToVault") { contentId: String ->
            val source = contentRepo().get(contentId) ?: error("VAULT_CONTENT_NOT_FOUND")
            val stored = vaultSvc().copyToVault(source) ?: error("VAULT_OPERATION_FAILED")
            sendEvent("onVaultContentChanged", mapOf("operation" to "COPIED", "contentId" to stored.contentId))
            contentToMap(stored)
        }

        AsyncFunction("moveContentToVault") { contentId: String ->
            val source = contentRepo().get(contentId) ?: error("VAULT_CONTENT_NOT_FOUND")
            val stored = vaultSvc().copyToVault(source) ?: error("VAULT_OPERATION_FAILED")
            val moved = removeOriginal(source)
            if (moved) contentRepo().delete(source.contentId)
            val operation = if (moved) "MOVED" else "COPIED"
            sendEvent("onVaultContentChanged", mapOf("operation" to operation, "contentId" to stored.contentId))
            mapOf("operation" to operation, "content" to contentToMap(stored))
        }

        AsyncFunction("exportVaultContent") { contentId: String, destinationUri: String, warningConfirmed: Boolean ->
            if (!warningConfirmed) error("EXPORT_CONFIRMATION_REQUIRED")
            val item = contentRepo().get(contentId) ?: error("VAULT_CONTENT_NOT_FOUND")
            val destination = Uri.parse(destinationUri)
            val output = when (destination.scheme) {
                "content" -> getContext().contentResolver.openOutputStream(destination, "w")
                "file" -> destination.path?.let { File(it).outputStream() }
                null -> File(destinationUri).outputStream()
                else -> null
            } ?: error("VAULT_OPERATION_FAILED")
            output.use {
                if (!vaultSvc().exportToStream(item, it)) error("VAULT_OPERATION_FAILED")
            }
            sendEvent("onVaultContentChanged", mapOf("operation" to "EXPORTED", "contentId" to contentId))
            true
        }

        AsyncFunction("deleteVaultContent") { contentId: String ->
            val deleted = vaultSvc().deleteFromVault(contentId)
            if (!deleted) error("VAULT_OPERATION_FAILED")
            sendEvent("onVaultContentChanged", mapOf("operation" to "DELETED", "contentId" to contentId))
            true
        }

        AsyncFunction("openVaultContentForRead") { contentId: String ->
            val stream = vaultSvc().getVaultContentStream(contentId) ?: error("VAULT_CONTENT_NOT_FOUND")
            val handle = UUID.randomUUID().toString()
            vaultReadHandles[handle] = stream
            mapOf("nativeId" to contentId, "handle" to handle)
        }

        AsyncFunction("closeVaultContentRead") { handle: String ->
            vaultReadHandles.remove(handle)?.close() ?: error("VAULT_CONTENT_NOT_FOUND")
            true
        }

        // ── Registration ──────────────────────────────────────────────────────

        AsyncFunction("addSetuManagedContent") {
            name: String, mimeType: String, size: Double, sourceUri: String,
            ownerId: String, manifestId: String ->
            val content = svc().addSetuManagedContent(
                name, mimeType, size.toLong(), sourceUri, ownerId,
                manifestId.takeIf { it.isNotBlank() }
            )
            contentToMap(content)
        }

        // ── Device media library (paged straight from MediaStore) ─────────────

        /* Contract: getMediaPage(category, albumId?, query?, sort, offset, limit<=120) returns one
         * page of bounded metadata with a content:// uri per item. No bytes cross the bridge. */
        AsyncFunction("getMediaPage") {
            category: String, albumId: String?, query: String?, sort: String, offset: Int, limit: Int ->
            MediaLibrary.page(
                getContext(),
                parseCategory(category),
                albumId?.takeIf { it.isNotBlank() },
                query,
                parseSort(sort),
                offset,
                limit,
            ).map { it.toMap() }
        }

        AsyncFunction("getMediaAlbums") { MediaLibrary.albums(getContext()).map { it.toMap() } }

        AsyncFunction("getMediaCounts") { MediaLibrary.counts(getContext()) }

        /**
         * Hands a file to whatever app the user has for it — a PDF reader, a document editor, a
         * spreadsheet app. Setu does not bundle a viewer for every format and does not need to:
         * the read grant is temporary and scoped to this one uri.
         */
        AsyncFunction("openExternally") { uri: String, mimeType: String ->
            openExternally(uri, mimeType)
        }

        /** True when at least one installed app can open this type. */
        AsyncFunction("canOpenExternally") { mimeType: String -> canOpenExternally(mimeType) }

        // ── PDF ───────────────────────────────────────────────────────────────

        /**
         * Opens a PDF for in-app reading and returns a handle plus its page count. The document
         * stays open natively until closePdf; nothing but page metadata crosses the bridge.
         */
        AsyncFunction("openPdf") { uri: String ->
            val opened = PdfRendererService.open(getContext(), uri)
            mapOf("handle" to opened.handle, "pageCount" to opened.pageCount)
        }

        /** Rasterises one page to a PNG in the cache and returns a file uri the viewer renders. */
        AsyncFunction("renderPdfPage") { handle: String, page: Int, width: Int ->
            val rendered = PdfRendererService.renderPage(handle, page, width)
            mapOf("uri" to rendered.uri, "width" to rendered.width, "height" to rendered.height)
        }

        /** Releases the document and deletes the pages rendered for it. */
        AsyncFunction("closePdf") { handle: String -> PdfRendererService.close(handle) }

        /**
         * Asks Android to delete these MediaStore items. Setu never deletes a user's media on its
         * own authority: from Android 11 the system shows its own confirmation and performs the
         * delete, and this resolves with how many items went, or 0 if the user said no.
         */
        AsyncFunction("deleteMediaItems") { uris: List<String>, promise: Promise ->
            deleteMediaItems(uris, promise)
        }

        /**
         * Marks or unmarks these MediaStore items as favourites. The FAVORITES category could be
         * read but never written, so it could only ever be empty unless another app had set the
         * flag. Android owns the confirmation from Android 11, exactly as it does for a delete.
         */
        AsyncFunction("setMediaFavorite") { uris: List<String>, favorite: Boolean, promise: Promise ->
            setMediaFavorite(uris, favorite, promise)
        }

        // ── Thumbnail ─────────────────────────────────────────────────────────

        AsyncFunction("getThumbnail") { contentId: String ->
            val content = svc().getContent(contentId) ?: return@AsyncFunction null
            svc().generateThumbnail(content)
        }

        OnActivityResult { _, payload ->
            if (payload.requestCode == DELETE_REQUEST) finishDelete(payload.resultCode)
            if (payload.requestCode == FAVORITE_REQUEST) finishFavorite(payload.resultCode)
        }
    }

    private fun deleteMediaItems(uris: List<String>, promise: Promise) {
        val parsed = uris.mapNotNull { runCatching { Uri.parse(it) }.getOrNull() }
            .filter { it.scheme == "content" }
        if (parsed.isEmpty()) {
            promise.reject("NO_MEDIA", "No media item to delete", null)
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            // Setu does not hold WRITE_EXTERNAL_STORAGE, so before Android 11 it can only delete
            // what it owns. Anything else is Android's to refuse, and the caller is told so.
            var removed = 0
            for (uri in parsed) {
                removed += try {
                    getContext().contentResolver.delete(uri, null, null)
                } catch (_: SecurityException) {
                    promise.reject("DELETE_NOT_PERMITTED", "Android did not allow this delete", null)
                    return
                } catch (error: Exception) {
                    promise.reject("DELETE_FAILED", error.message ?: "Could not delete the item", null)
                    return
                }
            }
            promise.resolve(removed)
            return
        }

        val activity = appContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Foreground activity is required", null)
            return
        }
        if (pendingDelete != null) {
            promise.reject("IN_PROGRESS", "A delete is already waiting for confirmation", null)
            return
        }

        pendingDelete = promise
        pendingDeleteCount = parsed.size
        try {
            val request = MediaStore.createDeleteRequest(getContext().contentResolver, parsed)
            activity.startIntentSenderForResult(request.intentSender, DELETE_REQUEST, null, 0, 0, 0)
        } catch (error: Exception) {
            pendingDelete = null
            pendingDeleteCount = 0
            promise.reject("DELETE_FAILED", error.message ?: "Could not ask Android to delete", null)
        }
    }

    private fun setMediaFavorite(uris: List<String>, favorite: Boolean, promise: Promise) {
        val parsed = uris.mapNotNull { runCatching { Uri.parse(it) }.getOrNull() }
            .filter { it.scheme == "content" }
        if (parsed.isEmpty()) {
            promise.reject("NO_MEDIA", "No media item to update", null)
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            // Android 10 and below have no favourite column at all, so the category cannot exist
            // there. The caller is told plainly rather than being shown a control that does nothing.
            promise.reject("FAVORITE_UNSUPPORTED", "Favourites need Android 11 or newer", null)
            return
        }
        val activity = appContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Foreground activity is required", null)
            return
        }
        if (pendingFavorite != null) {
            promise.reject("IN_PROGRESS", "A favourite change is already waiting", null)
            return
        }

        pendingFavorite = promise
        pendingFavoriteCount = parsed.size
        try {
            val request = MediaStore.createFavoriteRequest(getContext().contentResolver, parsed, favorite)
            activity.startIntentSenderForResult(request.intentSender, FAVORITE_REQUEST, null, 0, 0, 0)
        } catch (error: Exception) {
            pendingFavorite = null
            pendingFavoriteCount = 0
            promise.reject("FAVORITE_FAILED", error.message ?: "Could not ask Android to update", null)
        }
    }

    private fun finishFavorite(resultCode: Int) {
        val promise = pendingFavorite ?: return
        val count = pendingFavoriteCount
        pendingFavorite = null
        pendingFavoriteCount = 0
        promise.resolve(if (resultCode == Activity.RESULT_OK) count else 0)
    }

    private fun finishDelete(resultCode: Int) {
        val promise = pendingDelete ?: return
        val count = pendingDeleteCount
        pendingDelete = null
        pendingDeleteCount = 0
        promise.resolve(if (resultCode == Activity.RESULT_OK) count else 0)
    }

    private fun parseCategory(value: String): MediaLibrary.Category =
        runCatching { MediaLibrary.Category.valueOf(value.uppercase()) }
            .getOrElse { MediaLibrary.Category.ALL }

    private fun parseSort(value: String): MediaLibrary.SortOrder =
        runCatching { MediaLibrary.SortOrder.valueOf(value.uppercase()) }
            .getOrElse { MediaLibrary.SortOrder.DATE_DESC }

    /**
     * A URI another app is allowed to read.
     *
     * A received file lives in app-private storage, so handing its `file://` URI to a viewer
     * throws FileUriExposedException on API 24+ — which was swallowed, and surfaced to the user as
     * "No app on this phone can open that file" for every document they received. Anything under
     * our own files goes out through the FileProvider instead; `content://` URIs from MediaStore
     * and elsewhere are already shareable and pass straight through.
     */
    private fun shareableUri(uri: String): android.net.Uri {
        val parsed = android.net.Uri.parse(uri)
        if (!"file".equals(parsed.scheme, ignoreCase = true)) return parsed
        val path = parsed.path ?: return parsed
        return try {
            androidx.core.content.FileProvider.getUriForFile(
                getContext(),
                "${getContext().packageName}.fileprovider",
                java.io.File(path),
            )
        } catch (error: IllegalArgumentException) {
            // Outside every configured FileProvider path: not ours to hand out.
            SetuLog.w(
                SetuLog.MEDIA,
                "refusing to share a file outside the provider paths: ${error.message}",
            )
            parsed
        }
    }

    private fun viewIntent(uri: String, mimeType: String): android.content.Intent =
        android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
            setDataAndType(shareableUri(uri), mimeType.ifBlank { "*/*" })
            addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        }

    private fun canOpenExternally(mimeType: String): Boolean = try {
        val probe = viewIntent("content://probe", mimeType)
        getContext().packageManager.queryIntentActivities(probe, 0).isNotEmpty()
    } catch (_: Exception) {
        false
    }

    private fun openExternally(uri: String, mimeType: String): Boolean = try {
        val intent = viewIntent(uri, mimeType)
        val activity = appContext.currentActivity
        if (activity != null) activity.startActivity(intent) else getContext().startActivity(intent)
        true
    } catch (_: android.content.ActivityNotFoundException) {
        false
    } catch (error: Exception) {
        // Every failure used to look identical from JS, so a URI we were not allowed to hand out
        // was indistinguishable from a phone with no reader installed.
        SetuLog.w(SetuLog.MEDIA, "open failed: ${error.javaClass.simpleName} ${error.message}")
        false
    }

    private fun getContext(): Context =
        appContext.reactContext?.applicationContext
            ?: throw IllegalStateException("React context unavailable")

    private fun contentRepo(): ContentRepository = ContentRepository.create(getContext())

    private fun vaultSvc(): VaultService = vaultService ?: VaultService(
        getContext(), contentRepo(), IdentityVault
    ).also {
        it.ensureInitialized()
        vaultService = it
    }

    private fun removeOriginal(content: SetuContent): Boolean {
        val source = content.sourceUri ?: return false
        return try {
            val uri = Uri.parse(source)
            when (uri.scheme) {
                "content" -> getContext().contentResolver.delete(uri, null, null) > 0
                "file" -> uri.path?.let { File(it).delete() } ?: false
                null -> File(source).delete()
                else -> false
            }
        } catch (_: SecurityException) {
            false
        } catch (_: java.io.IOException) {
            false
        }
    }

    private fun svc(): ContentService = SetuRuntime.content(getContext())

    private fun contentToMap(c: SetuContent): Map<String, Any?> = ContentEvents.contentToMap(c)

}
