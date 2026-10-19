package expo.modules.setunative.network

import android.content.Context
import android.net.Uri
import android.os.SystemClock
import android.webkit.MimeTypeMap
import expo.modules.setunative.content.ContentEvents
import expo.modules.setunative.content.MediaStorePublisher
import expo.modules.setunative.models.Availability
import expo.modules.setunative.models.ContentSource
import expo.modules.setunative.models.ContentState
import expo.modules.setunative.models.ContentType
import expo.modules.setunative.models.EncryptionMode
import expo.modules.setunative.models.SetuContent
import expo.modules.setunative.models.StorageMode
import expo.modules.setunative.models.Visibility
import expo.modules.setunative.notifications.SetuNotificationManager
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.persistence.PeerRepository
import expo.modules.setunative.security.CryptoIdentityManager
import expo.modules.setunative.shared.SetuEvents
import expo.modules.setunative.shared.SetuLog
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Turns file-transfer callbacks into JS events, notifications and (for received files) an entry in
 * the content index. Progress events are throttled to 4/s and progress notifications to 1/s per
 * transfer; the final state always goes through.
 */
class TransferEventBridge(context: Context) : TransferListener {
    private val context = context.applicationContext
    private val lastEventAt = ConcurrentHashMap<String, Long>()
    private val lastNotificationAt = ConcurrentHashMap<String, Long>()

    private fun emit(event: String, body: Map<String, Any?>) = SetuEvents.emit(SetuEvents.CORE, event, body)

    override fun onIncomingOffer(offer: OfferProjection) {
        // The peer's own display name, not its id truncated to eight characters: this is what a
        // transfer request actually reads as "<name> wants to send <file>", and nothing had ever
        // looked the name up.
        val senderName = PeerRepository.create(context).get(offer.peerId)?.displayName
            ?: offer.peerId.take(8)
        SetuNotificationManager.showRequest(
            context,
            offer.transferId,
            offer.peerId,
            senderName,
            offer.fileName
        )
        emit(
            "onIncomingTransferOffer",
            mapOf(
                "transferId" to offer.transferId,
                "sessionId" to offer.sessionId,
                "peerId" to offer.peerId,
                "fileName" to offer.fileName,
                "mimeType" to offer.mimeType,
                "size" to offer.size,
            ),
        )
    }

    override fun onStarted(
        transferId: String,
        sessionId: String,
        peerId: String,
        fileName: String,
        mimeType: String,
        size: Long,
    ) {
        emit(
            "onTransferStarted",
            mapOf(
                "transferId" to transferId,
                "sessionId" to sessionId,
                "peerId" to peerId,
                "fileName" to fileName,
                "mimeType" to mimeType,
                "size" to size,
            ),
        )
    }

    override fun onProgress(
        transferId: String,
        sessionId: String,
        peerId: String,
        direction: String,
        verifiedBytes: Long,
        totalBytes: Long,
    ) {
        val now = SystemClock.elapsedRealtime()
        val done = totalBytes > 0 && verifiedBytes >= totalBytes
        if (done || now - (lastNotificationAt[transferId] ?: 0L) >= NOTIFICATION_INTERVAL_MS) {
            lastNotificationAt[transferId] = now
            SetuNotificationManager.updateTransferProgress(
                context,
                transferId,
                peerId.take(8),
                verifiedBytes,
                totalBytes,
                direction == "upload",
            )
        }
        if (done || now - (lastEventAt[transferId] ?: 0L) >= EVENT_INTERVAL_MS) {
            lastEventAt[transferId] = now
            emit(
                "onTransferProgress",
                mapOf(
                    "transferId" to transferId,
                    "sessionId" to sessionId,
                    "peerId" to peerId,
                    "direction" to direction,
                    "verifiedBytes" to verifiedBytes,
                    "totalBytes" to totalBytes,
                ),
            )
        }
    }

    override fun onCompleted(
        transferId: String,
        sessionId: String,
        peerId: String,
        fileName: String,
        size: Long,
        direction: String,
        localFilePath: String?,
    ) {
        lastEventAt.remove(transferId)
        lastNotificationAt.remove(transferId)
        /*
         * A finished transfer becomes a content record on both sides, under the same id.
         *
         * The id is derived from the transfer, which both devices know, so a message that names it
         * as an attachment resolves on the sender against its own copy and on the receiver against
         * the one it just assembled. Without the sending half, a shared file appeared in the
         * sender's thread as permanently unavailable.
         */
        var contentId = ""
        if (localFilePath != null) {
            contentId = if (direction == "download") {
                indexReceivedFile(transferId, peerId, fileName, size, localFilePath)
            } else {
                indexSentFile(transferId, fileName, size, localFilePath)
            }
        }
        SetuNotificationManager.updateTransferProgress(
            context, transferId, peerId.take(8), size, size, direction == "upload", true,
        )
        emit(
            "onTransferCompleted",
            mapOf(
                "transferId" to transferId,
                "sessionId" to sessionId,
                "peerId" to peerId,
                "fileName" to fileName,
                "size" to size,
                "direction" to direction,
                "contentId" to contentId,
            ),
        )
    }

    override fun onFailed(transferId: String, sessionId: String, peerId: String, reason: String, direction: String) {
        lastEventAt.remove(transferId)
        lastNotificationAt.remove(transferId)
        emit(
            "onTransferFailed",
            mapOf(
                "transferId" to transferId,
                "sessionId" to sessionId,
                "peerId" to peerId,
                "reason" to reason,
                "direction" to direction,
            ),
        )
    }

    private fun indexReceivedFile(
        transferId: String,
        peerId: String,
        fileName: String,
        size: Long,
        localFilePath: String,
    ): String {
        val extension = fileName.substringAfterLast('.', "").lowercase()
        val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
        val contentType = contentTypeFor(mimeType)
        val contentId = TransferSwarmPublisher.receivedContentId(transferId)
        val now = System.currentTimeMillis()

        /*
         * Hand the file to the phone before recording it.
         *
         * Assembled transfers land in app-private storage, which is right while the bytes are
         * being verified and wrong the moment they belong to the user: nothing outside Setu can
         * read that directory and MediaStore has never heard of it, so a received photo was
         * missing from the gallery and from every browse surface that reads MediaStore. On the
         * Android versions that allow it the file is moved into the proper collection and the
         * content row points at the resulting content:// URI, so the message thread, Received,
         * the library and the player all resolve to the same one file.
         */
        val published = MediaStorePublisher.publish(context, File(localFilePath), fileName, mimeType)
        val sourceUri = published?.toString() ?: Uri.fromFile(File(localFilePath)).toString()
        // A published file is in the phone's own storage now, which the enum already has a name for.
        val storage = if (published != null) StorageMode.EXTERNAL else StorageMode.SETU_MANAGED
        val content = SetuContent(
            contentId = contentId,
            type = contentType,
            name = fileName,
            mimeType = mimeType,
            size = size,
            createdAt = now,
            modifiedAt = now,
            source = ContentSource.SETU_MANAGED,
            sourceUri = sourceUri,
            storageMode = storage,
            encryptionMode = EncryptionMode.NONE,
            manifestId = null,
            ownerId = CryptoIdentityManager.getOrCreate().deviceId,
            visibility = Visibility.PRIVATE,
            availability = Availability.FULL,
            state = ContentState.ACTIVE,
        )
        if (!ContentRepository.create(context).upsert(content)) {
            SetuLog.e(SetuLog.STORAGE, "received file could not be indexed transfer=${SetuLog.id(transferId)}")
            return ""
        }
        // Content exists now, so every surface holding a stale answer for this id is told once,
        // rather than each of them polling or showing the file as missing until it is reopened.
        SetuEvents.emit(SetuEvents.CONTENT, "onContentDiscovered", ContentEvents.contentToMap(content))
        val senderName = PeerRepository.create(context).get(peerId)?.displayName ?: peerId.take(8)
        SetuNotificationManager.showFileReceived(context, peerId, fileName, mimeType, senderName, sourceUri, contentId)
        return contentId
    }

    /**
     * Records a file this device sent, so the sender's own thread can resolve the attachment it
     * named. The bytes are already the user's own - in MediaStore, or in the cache for a document
     * they picked - so this records where they are and copies nothing.
     */
    private fun indexSentFile(transferId: String, fileName: String, size: Long, sourceUri: String): String {
        val extension = fileName.substringAfterLast('.', "").lowercase()
        val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
        val contentId = TransferSwarmPublisher.receivedContentId(transferId)
        val now = System.currentTimeMillis()
        val content = SetuContent(
            contentId = contentId,
            type = contentTypeFor(mimeType),
            name = fileName,
            mimeType = mimeType,
            size = size,
            createdAt = now,
            modifiedAt = now,
            // The file came from the phone's own storage and stays there; nothing was moved.
            source = ContentSource.MEDIASTORE,
            sourceUri = sourceUri,
            storageMode = StorageMode.EXTERNAL,
            encryptionMode = EncryptionMode.NONE,
            manifestId = null,
            ownerId = CryptoIdentityManager.getOrCreate().deviceId,
            visibility = Visibility.PRIVATE,
            availability = Availability.FULL,
            state = ContentState.ACTIVE,
        )
        if (!ContentRepository.create(context).upsert(content)) {
            SetuLog.e(SetuLog.STORAGE, "sent file could not be indexed transfer=${SetuLog.id(transferId)}")
            return ""
        }
        SetuEvents.emit(SetuEvents.CONTENT, "onContentDiscovered", ContentEvents.contentToMap(content))
        return contentId
    }

    private fun contentTypeFor(mimeType: String): ContentType = when {
        mimeType.startsWith("image/") -> ContentType.IMAGE
        mimeType.startsWith("video/") -> ContentType.VIDEO
        mimeType.startsWith("audio/") -> ContentType.AUDIO
        mimeType.startsWith("application/") -> ContentType.DOCUMENT
        else -> ContentType.OTHER
    }

    private companion object {
        const val EVENT_INTERVAL_MS = 250L
        const val NOTIFICATION_INTERVAL_MS = 1_000L
    }
}
