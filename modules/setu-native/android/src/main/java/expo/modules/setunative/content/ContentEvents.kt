package expo.modules.setunative.content

import expo.modules.setunative.models.SetuContent
import expo.modules.setunative.shared.SetuEvents

/** Maps content-service callbacks to JS events, independent of any module instance. */
internal object ContentEvents {
    fun contentToMap(c: SetuContent): Map<String, Any?> = mapOf(
        "contentId" to c.contentId,
        "type" to c.type.name,
        "name" to c.name,
        "mimeType" to c.mimeType,
        "size" to c.size,
        "createdAt" to c.createdAt,
        "modifiedAt" to c.modifiedAt,
        "sourceUri" to (c.sourceUri ?: ""),
        "storageMode" to c.storageMode.name,
        "encryptionMode" to c.encryptionMode.name,
        "manifestId" to (c.manifestId ?: ""),
        "ownerId" to (c.ownerId ?: ""),
        "visibility" to c.visibility.name,
        "availability" to c.availability.name,
        "state" to c.state.name,
        "thumbnailUri" to (c.thumbnailUri ?: ""),
    )

    fun listener() = object : ContentService.ContentListener {
        private fun emit(event: String, body: Map<String, Any?>) =
            SetuEvents.emit(SetuEvents.CONTENT, event, body)

        override fun onContentDiscovered(content: SetuContent) = emit("onContentDiscovered", contentToMap(content))

        override fun onContentRemoved(contentId: String) = emit("onContentRemoved", mapOf("contentId" to contentId))

        override fun onContentUpdated(content: SetuContent) {}

        override fun onScanProgress(current: Int, total: Int) =
            emit("onScanProgress", mapOf("current" to current, "total" to total))

        override fun onScanComplete(total: Int) = emit("onScanComplete", mapOf("total" to total))

        override fun onScanFailed(reason: String) = emit("onScanFailed", mapOf("reason" to reason))
    }
}
