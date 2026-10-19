package expo.modules.setunative.network

import android.content.Context
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

internal class TransferOutgoingHandler(
    private val appContext: Context,
    private val listener: TransferListener,
    private val persistence: TransferPersistence,
    private val outgoingReplies: ConcurrentHashMap<String, LinkedBlockingQueue<TransferFrame>>,
    private val outgoingSessionIds: ConcurrentHashMap<String, String>,
    private val outgoingTransfers: MutableSet<String>,
    private val executor: ThreadPoolExecutor
) {

    fun startOutgoing(sessionId: String, uri: Uri, fileName: String, mimeType: String): String {
        if (!SetuPeerTransport.isSessionAuthorized(sessionId)) {
            throw SecurityException("SESSION_NOT_AUTHORIZED")
        }
        val transferId = UUID.randomUUID().toString()
        if (!outgoingTransfers.add(transferId)) throw IllegalStateException("TRANSFER_ID_COLLISION")

        try {
            executor.execute {
                sendFile(transferId, sessionId, uri, fileName, mimeType)
            }
        } catch (_: RejectedExecutionException) {
            outgoingTransfers.remove(transferId)
            throw IllegalStateException("TRANSFER_QUEUE_FULL")
        }
        return transferId
    }

    fun resumeOutgoing(sessionId: String, peerId: String) {
        if (!SetuPeerTransport.isSessionAuthorized(sessionId)) return
        persistence.getPendingOutgoing().values
            .filter { it.peerId == peerId && outgoingTransfers.add(it.transferId) }
            .forEach { transfer ->
                try {
                    executor.execute {
                        sendFile(
                            transfer.transferId,
                            sessionId,
                            transfer.sourceUri,
                            transfer.fileName,
                            transfer.mimeType,
                            transfer.manifest,
                        )
                    }
                } catch (_: RejectedExecutionException) {
                    outgoingTransfers.remove(transfer.transferId)
                }
            }
    }

    fun cancelTransfer(transferId: String): Boolean {
        val outgoing = persistence.getPendingOutgoing().remove(transferId)
        outgoing?.metadataFile?.delete()
        val replyQueue = outgoingReplies[transferId] ?: return outgoing != null
        val id = TransferUtils.parseTransferId(transferId) ?: return outgoing != null
        val sessionId = outgoingSessionIds[transferId] ?: return outgoing != null
        try {
            SetuPeerTransport.sendFrame(
                sessionId,
                SetuPeerTransport.FRAME_TRANSFER_CANCEL,
                TransferUtils.encodeTransferId(id)
            )
        } catch (_: Exception) {
        }
        replyQueue.offer(TransferFrame(SetuPeerTransport.FRAME_TRANSFER_REJECT, TransferUtils.encodeTransferId(id)))
        return true
    }

    fun onSessionClosed(sessionId: String) {
        outgoingSessionIds.entries
            .filter { it.value == sessionId }
            .forEach { entry ->
                outgoingReplies[entry.key]?.offer(
                    TransferFrame(0, TransferUtils.encodeTransferId(UUID.fromString(entry.key))),
                )
            }
    }

    private fun sendFile(
        transferIdText: String,
        sessionId: String,
        uri: Uri,
        requestedName: String,
        requestedMimeType: String,
        manifestOverride: TransferManifest? = null,
    ) {
        val transferId = UUID.fromString(transferIdText)
        val peerId = SetuPeerTransport.peerIdForSession(sessionId) ?: ""
        val replies = LinkedBlockingQueue<TransferFrame>(2)
        outgoingReplies[transferIdText] = replies
        outgoingSessionIds[transferIdText] = sessionId

        try {
            val name = TransferUtils.sanitizeFileName(requestedName)
            val mimeType = TransferUtils.sanitizeMimeType(requestedMimeType)
            val size = TransferUtils.querySize(appContext, uri)
            if (size !in 0..TransferConstants.MAX_FILE_SIZE) {
                throw IllegalArgumentException("FILE_SIZE_UNSUPPORTED")
            }
            val manifest = manifestOverride ?: TransferManifestParser.createManifest(
                appContext, uri, name, mimeType, size
            )
            if (manifest.size != size) throw IllegalStateException("SOURCE_SIZE_CHANGED")

            val transferDirectory = java.io.File(appContext.filesDir, TransferConstants.TRANSFER_TMP_DIR).apply { mkdirs() }
            val outgoing = OutgoingTransfer(
                transferIdText, peerId, uri, name, mimeType, manifest,
                java.io.File(transferDirectory, ".${transferIdText}.meta"),
            )
            persistence.getPendingOutgoing()[transferIdText] = outgoing
            persistence.persistOutgoing(outgoing)
            listener.onStarted(transferIdText, sessionId, peerId, name, mimeType, size)

            val offerPayload = ByteArrayOutputStream().also { bytes ->
                DataOutputStream(bytes).use { output ->
                    TransferUtils.writeTransferId(output, transferId)
                    output.write(TransferManifestParser.encodeManifest(manifest))
                }
            }.toByteArray()
            if (offerPayload.size + 1 > SetuPeerTransport.MAX_APPLICATION_FRAME_BYTES) {
                throw IllegalArgumentException("MANIFEST_TOO_LARGE")
            }

            SetuPeerTransport.sendFrame(sessionId, SetuPeerTransport.FRAME_TRANSFER_OFFER, offerPayload)
            val decision = TransferUtils.awaitReply(replies, transferIdText)
            when (decision.type) {
                SetuPeerTransport.FRAME_TRANSFER_REJECT -> throw IllegalStateException("TRANSFER_DECLINED")
                0 -> throw java.io.IOException("SESSION_CLOSED")
                SetuPeerTransport.FRAME_TRANSFER_ACCEPT -> Unit
                else -> throw SecurityException("INVALID_TRANSFER_DECISION")
            }
            val receivedPieces = TransferManifestParser.decodeAcceptedPieces(
                decision.payload, transferId, manifest.pieceCount
            )

            var sentBytes = 0L
            appContext.contentResolver.openInputStream(uri)?.use { input ->
                for (index in manifest.pieceHashes.indices) {
                    val expectedLength = TransferUtils.pieceLength(manifest, index)
                    val bytes = TransferUtils.readExactly(input, expectedLength)
                    if (!MessageDigest.isEqual(TransferUtils.sha256(bytes), manifest.pieceHashes[index])) {
                        throw SecurityException("SOURCE_CHANGED_DURING_TRANSFER")
                    }
                    if (receivedPieces.get(index)) {
                        sentBytes += bytes.size
                        listener.onProgress(transferIdText, sessionId, peerId, "upload", sentBytes, size)
                        continue
                    }
                    val piecePayload = ByteArrayOutputStream(24 + bytes.size).also { buffer ->
                        DataOutputStream(buffer).use { output ->
                            TransferUtils.writeTransferId(output, transferId)
                            output.writeInt(index)
                            output.writeInt(bytes.size)
                            output.write(bytes)
                        }
                    }.toByteArray()
                    SetuPeerTransport.sendFrame(sessionId, SetuPeerTransport.FRAME_TRANSFER_PIECE, piecePayload)
                    val acknowledgement = TransferUtils.awaitReply(replies, transferIdText)
                    if (acknowledgement.type == 0) throw java.io.IOException("SESSION_CLOSED")
                    if (acknowledgement.type != SetuPeerTransport.FRAME_TRANSFER_PIECE_ACK) {
                        throw IllegalStateException("PIECE_NOT_COMMITTED")
                    }
                    val ackInput = java.io.DataInputStream(java.io.ByteArrayInputStream(acknowledgement.payload))
                    val ackId = TransferUtils.readTransferId(ackInput)
                    val ackIndex = ackInput.readInt()
                    val durableBytes = ackInput.readLong()
                    if (ackId != transferId || ackIndex != index || durableBytes < sentBytes + bytes.size) {
                        throw SecurityException("INVALID_PIECE_ACK")
                    }
                    sentBytes = durableBytes
                    listener.onProgress(transferIdText, sessionId, peerId, "upload", sentBytes, size)
                }
            } ?: throw IllegalStateException("CONTENT_SOURCE_UNAVAILABLE")

            SetuPeerTransport.sendFrame(
                sessionId,
                SetuPeerTransport.FRAME_TRANSFER_COMPLETE,
                TransferUtils.encodeTransferId(transferId) + manifest.fileHash,
            )
            val completion = TransferUtils.awaitReply(replies, transferIdText)
            if (completion.type != SetuPeerTransport.FRAME_TRANSFER_COMPLETE_ACK ||
                !MessageDigest.isEqual(completion.payload, TransferUtils.encodeTransferId(transferId))
            ) {
                throw IllegalStateException("REMOTE_COMMIT_NOT_CONFIRMED")
            }
            TransferSwarmPublisher.publishSent(
                appContext,
                manifest,
                expo.modules.setunative.security.CryptoIdentityManager.getOrCreate().deviceId,
            )
            // The sender's own copy, so the finished transfer can be indexed and reopened here too.
            listener.onCompleted(
                transferIdText, sessionId, peerId, name, size, "upload", outgoing.sourceUri.toString(),
            )
            // The row exists now, so the sent file can be joined to the content the swarm knows.
            TransferSwarmPublisher.linkSent(appContext, transferIdText, manifest)
            persistence.getPendingOutgoing().remove(transferIdText)
            outgoing.metadataFile.delete()
        } catch (error: Exception) {
            listener.onFailed(transferIdText, sessionId, peerId, TransferUtils.safeFailure(error), "upload")
            val terminal = error.message in setOf(
                "TRANSFER_DECLINED",
                "SOURCE_CHANGED_DURING_TRANSFER",
                "SOURCE_SIZE_CHANGED",
                "CONTENT_SOURCE_UNAVAILABLE",
                "CORRUPT_PIECE",
                "TRANSFER_INCOMPLETE",
            )
            if (terminal) {
                persistence.getPendingOutgoing().remove(transferIdText)?.metadataFile?.delete()
                try {
                    SetuPeerTransport.sendFrame(
                        sessionId,
                        SetuPeerTransport.FRAME_TRANSFER_CANCEL,
                        TransferUtils.encodeTransferId(transferId),
                    )
                } catch (_: Exception) {
                }
            }
        } finally {
            outgoingTransfers.remove(transferIdText)
            outgoingReplies.remove(transferIdText)
            outgoingSessionIds.remove(transferIdText)
        }
    }
}
