package expo.modules.setunative.network

import android.content.Context
import android.net.Uri
import android.util.Log
import expo.modules.setunative.models.SetuManifest
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.swarm.SetuSwarmEngine
import java.io.File

/**
 * Turns a finished 1:1 transfer into swarm membership.
 *
 * Setu's defining property is that a device which receives verified content can become a source of
 * it for another nearby device. Without this step a completed transfer is only a file on disk: the
 * swarm layer keys everything off [SetuManifest], so a receiver that never publishes one can never
 * answer a piece request, and a sender that never publishes one discards the receiver's HAVE.
 *
 * The manifest id is the hex of the manifest hash, so sender and receiver independently derive the
 * same id for the same content and their bitfields line up.
 */
internal object TransferSwarmPublisher {

    private const val TAG = "SETU_TRANSFER"

    /**
     * Receiver side: this device holds every byte, so it becomes a provider for every piece that
     * verifies out of its copy. [ownerPeerId] is the peer the content came from.
     *
     * Which copy that is has to be asked, not assumed. Indexing a received file hands it to the
     * phone's own media collections, and that move deletes the private copy this transfer just
     * assembled. Registering pieces against the assembled path regardless meant every piece failed
     * to verify, nothing was published, and a device that held the whole file could never serve it
     * or play it back from pieces. The content index records where the bytes actually ended up, so
     * that is what the pieces are registered against.
     */
    fun publishReceived(
        appContext: Context,
        manifest: TransferManifest,
        ownerPeerId: String,
        transferId: String,
        assembledFile: File,
    ) {
        if (manifest.pieceCount == 0) return
        val swarm = try {
            engine(appContext)
        } catch (error: Exception) {
            Log.e(TAG, "Swarm engine unavailable; received content stays local", error)
            return
        }
        // Verifying every piece re-reads the whole file, so never on a transport thread.
        swarm.getExecutor().execute {
            try {
                val manifestId = hex(manifest.manifestHash)
                val storagePath = resolveStoragePath(appContext, transferId, assembledFile)
                if (storagePath == null) {
                    Log.w(TAG, "No readable copy of $manifestId to publish")
                    return@execute
                }
                val published = swarm.publishLocalFile(
                    toSetuManifest(manifest, manifestId, ownerPeerId),
                    storagePath,
                )
                if (published != manifest.pieceCount) {
                    Log.w(TAG, "Published $published of ${manifest.pieceCount} pieces for $manifestId")
                }
                if (published > 0) linkManifest(appContext, transferId, manifestId)
            } catch (error: Exception) {
                // The file is already safely stored; failing to join the swarm must not undo it.
                Log.e(TAG, "Failed to publish received content to the swarm", error)
            }
        }
    }

    /**
     * Where the received bytes are now: the indexed location if the content row exists, otherwise
     * the assembled file. A `file://` URI is reduced to its path because piece storage is addressed
     * by path, and only a `content://` URI is kept as a URI.
     */
    private fun resolveStoragePath(appContext: Context, transferId: String, assembledFile: File): String? {
        val indexed = runCatching {
            ContentRepository.create(appContext).get(receivedContentId(transferId))?.sourceUri
        }.getOrNull()

        if (indexed != null) {
            if (indexed.startsWith("content://")) return indexed
            val path = if (indexed.startsWith("file://")) Uri.parse(indexed).path else indexed
            if (path != null && File(path).isFile) return path
        }
        return assembledFile.absolutePath.takeIf { assembledFile.isFile }
    }

    /**
     * Records on the content row which manifest this file is, now that it is in the swarm.
     *
     * Without it the chain stops: the row knows where the bytes are but not what content they are,
     * so nothing could ask how widely the file is replicated, which pieces this device serves, or
     * keep it available for other devices. Everything protocol-side is keyed by manifest, and this
     * is the one link from a file the user received to the content the swarm knows.
     */
    private fun linkManifest(appContext: Context, transferId: String, manifestId: String) {
        try {
            val repository = ContentRepository.create(appContext)
            val contentId = receivedContentId(transferId)
            val content = repository.get(contentId) ?: return
            if (content.manifestId == manifestId) return
            repository.upsert(content.copy(manifestId = manifestId))
        } catch (error: Exception) {
            Log.e(TAG, "Could not link $manifestId to the received content", error)
        }
    }

    /** The content id a received transfer is indexed under. One spelling, used by both sides. */
    fun receivedContentId(transferId: String): String = "transfer_$transferId"

    /**
     * Sender side: the bytes live behind a content URI the swarm cannot range-read, so no pieces are
     * registered here. Recording the manifest is still what lets this device accept the receiver's
     * HAVE and know that a second copy of the content now exists nearby.
     */
    fun publishSent(appContext: Context, manifest: TransferManifest, ownerPeerId: String) {
        if (manifest.pieceCount == 0) return
        try {
            val manifestId = hex(manifest.manifestHash)
            engine(appContext).publishManifest(toSetuManifest(manifest, manifestId, ownerPeerId))
        } catch (error: Exception) {
            Log.e(TAG, "Failed to record sent content in the swarm", error)
        }
    }

    /**
     * Sender side, after the file has been indexed: records which manifest the sent file is.
     *
     * The manifest is published when the transfer commits, but the content row for the sent file
     * does not exist until completion is reported, so the link is made here. Without it a device's
     * own pool stayed empty for everything it had shared - the manifest existed, the file existed,
     * and nothing joined the two.
     */
    fun linkSent(appContext: Context, transferId: String, manifest: TransferManifest) {
        if (manifest.pieceCount == 0) return
        linkManifest(appContext, transferId, hex(manifest.manifestHash))
    }

    private fun engine(appContext: Context) =
        SetuSwarmEngine.getInstance(appContext.applicationContext)

    private fun toSetuManifest(manifest: TransferManifest, manifestId: String, ownerId: String) =
        SetuManifest(
            manifestId = manifestId,
            contentId = manifestId,
            fileName = manifest.fileName,
            mimeType = manifest.mimeType,
            size = manifest.size,
            pieceSize = manifest.pieceSize,
            pieceHashes = manifest.pieceHashes,
            fileHash = manifest.fileHash,
            manifestHash = manifest.manifestHash,
            ownerId = ownerId,
            isPublic = true,
        )

    private fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }
}
