package expo.modules.setunative.network

import android.content.Context
import android.os.StatFs
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

internal class TransferIncomingHandler(
    private val appContext: Context,
    private val listener: TransferListener,
    private val persistence: TransferPersistence,
    private val outgoingSessionIds: ConcurrentHashMap<String, String>,
    private val outgoingReplies: ConcurrentHashMap<String, java.util.concurrent.LinkedBlockingQueue<TransferFrame>>
) {

    fun acceptIncoming(transferId: String): Boolean {
        val transfer = persistence.getPendingIncoming()[transferId] ?: return false
        if (transfer.output != null) return false

        val stats = StatFs(appContext.filesDir.absolutePath)
        if (stats.availableBytes < transfer.offer.manifest.size + TransferConstants.STORAGE_MARGIN_BYTES) {
            declineIncoming(transferId)
            return false
        }

        return try {
            transfer.tempFile.parentFile?.mkdirs()
            transfer.output = java.io.RandomAccessFile(transfer.tempFile, "rw")
            transfer.approved = true
            persistence.persistIncoming(transfer)
            SetuPeerTransport.sendFrame(
                transfer.offer.sessionId,
                SetuPeerTransport.FRAME_TRANSFER_ACCEPT,
                TransferUtils.encodeTransferId(transfer.offer.transferId) + transfer.receivedPieces.toByteArray(),
            )
            true
        } catch (_: Exception) {
            persistence.getPendingIncoming().remove(transferId)?.let { persistence.closeAndDelete(it) }
            false
        }
    }

    fun declineIncoming(transferId: String): Boolean {
        val transfer = persistence.getPendingIncoming().remove(transferId) ?: return false
        persistence.closeAndDelete(transfer)
        transfer.metadataFile.delete()
        try {
            SetuPeerTransport.sendFrame(
                transfer.offer.sessionId,
                SetuPeerTransport.FRAME_TRANSFER_REJECT,
                TransferUtils.encodeTransferId(transfer.offer.transferId),
            )
        } catch (_: Exception) {
        }
        return true
    }

    fun cancelIncoming(transferId: String): Boolean {
        val transfer = persistence.getPendingIncoming()[transferId] ?: return false
        persistence.getPendingIncoming().remove(transferId)?.let { persistence.closeAndDelete(it) }
        try {
            SetuPeerTransport.sendFrame(
                transfer.offer.sessionId,
                SetuPeerTransport.FRAME_TRANSFER_CANCEL,
                TransferUtils.encodeTransferId(transfer.offer.transferId),
            )
        } catch (_: Exception) {
        }
        return true
    }

    fun handleIncomingOffer(session: PeerSession, payload: ByteArray) {
        if (persistence.getPendingIncoming().size >= TransferConstants.MAX_PENDING_INCOMING) {
            throw IllegalStateException("TOO_MANY_PENDING_TRANSFERS")
        }
        val input = java.io.DataInputStream(java.io.ByteArrayInputStream(payload))
        val transferId = TransferUtils.readTransferId(input)
        val manifestBytes = ByteArray(input.available()).also(input::readFully)
        val manifest = TransferManifestParser.decodeManifest(manifestBytes)
        val transferIdText = transferId.toString()
        val existing = persistence.getPendingIncoming()[transferIdText]

        if (existing != null) {
            if (existing.offer.peerId != session.peerId ||
                !MessageDigest.isEqual(existing.offer.manifest.manifestHash, manifest.manifestHash)
            ) {
                throw SecurityException("TRANSFER_RESUME_MISMATCH")
            }
            existing.offer.sessionId = session.sessionId
            if (existing.approved) {
                existing.output = java.io.RandomAccessFile(existing.tempFile, "rw")
                SetuPeerTransport.sendFrame(
                    session.sessionId,
                    SetuPeerTransport.FRAME_TRANSFER_ACCEPT,
                    TransferUtils.encodeTransferId(transferId) + existing.receivedPieces.toByteArray(),
                )
            } else {
                listener.onIncomingOffer(
                    OfferProjection(
                        transferIdText,
                        session.sessionId,
                        session.peerId,
                        manifest.fileName,
                        manifest.mimeType,
                        manifest.size,
                    ),
                )
            }
            return
        }

        val receiveDirectory = java.io.File(appContext.filesDir, TransferConstants.TRANSFER_TMP_DIR).apply { mkdirs() }
        val tempFile = java.io.File(receiveDirectory, ".${transferIdText}.part")
        val metadataFile = java.io.File(receiveDirectory, ".${transferIdText}.meta")
        val offer = TransferOffer(transferId, session.sessionId, session.peerId, manifest)
        val pending = IncomingTransfer(offer, tempFile, metadataFile)
        if (persistence.getPendingIncoming().putIfAbsent(transferIdText, pending) != null) return
        persistence.persistIncoming(pending)
        listener.onIncomingOffer(
            OfferProjection(
                transferIdText,
                session.sessionId,
                session.peerId,
                manifest.fileName,
                manifest.mimeType,
                manifest.size,
            ),
        )
    }

    fun handleIncomingPiece(session: PeerSession, payload: ByteArray) {
        val input = java.io.DataInputStream(java.io.ByteArrayInputStream(payload))
        val id = TransferUtils.readTransferId(input)
        val transferIdText = id.toString()
        val transfer = persistence.getPendingIncoming()[transferIdText] ?: throw SecurityException("UNKNOWN_TRANSFER")
        if (transfer.offer.sessionId != session.sessionId) throw SecurityException("TRANSFER_SESSION_MISMATCH")
        val output = transfer.output ?: throw SecurityException("TRANSFER_NOT_ACCEPTED")
        val index = input.readInt()
        val length = input.readInt()
        if (index !in 0 until transfer.offer.manifest.pieceCount || transfer.receivedPieces.get(index)) {
            throw SecurityException("UNEXPECTED_PIECE_INDEX")
        }
        if (length != TransferUtils.pieceLength(transfer.offer.manifest, index) || input.available() != length) {
            throw SecurityException("INVALID_PIECE_LENGTH")
        }
        val bytes = ByteArray(length).also(input::readFully)
        val expectedHash = transfer.offer.manifest.pieceHashes[index]
        if (!MessageDigest.isEqual(TransferUtils.sha256(bytes), expectedHash)) {
            throw SecurityException("CORRUPT_PIECE")
        }

        output.seek(transfer.offer.manifest.pieceOffset(index))
        output.write(bytes)
        output.fd.sync()
        transfer.receivedPieces.set(index)
        transfer.verifiedBytes += bytes.size
        persistence.persistIncoming(transfer)
        listener.onProgress(
            transferIdText,
            session.sessionId,
            session.peerId,
            "download",
            transfer.verifiedBytes,
            transfer.offer.manifest.size,
        )
        val ack = ByteArrayOutputStream(28).also { buffer ->
            java.io.DataOutputStream(buffer).use { data ->
                TransferUtils.writeTransferId(data, id)
                data.writeInt(index)
                data.writeLong(transfer.verifiedBytes)
            }
        }.toByteArray()
        SetuPeerTransport.sendFrame(session.sessionId, SetuPeerTransport.FRAME_TRANSFER_PIECE_ACK, ack)
    }

    fun handleIncomingComplete(session: PeerSession, payload: ByteArray) {
        if (payload.size != 48) throw SecurityException("INVALID_TRANSFER_COMPLETE")
        val input = java.io.DataInputStream(java.io.ByteArrayInputStream(payload))
        val id = TransferUtils.readTransferId(input)
        val transferIdText = id.toString()
        val transfer = persistence.getPendingIncoming()[transferIdText] ?: throw SecurityException("UNKNOWN_TRANSFER")
        if (transfer.offer.sessionId != session.sessionId) throw SecurityException("TRANSFER_SESSION_MISMATCH")
        val offeredHash = ByteArray(32).also(input::readFully)
        val manifest = transfer.offer.manifest
        if (transfer.receivedPieces.cardinality() != manifest.pieceCount ||
            !MessageDigest.isEqual(offeredHash, manifest.fileHash) ||
            transfer.verifiedBytes != manifest.size
        ) {
            throw SecurityException("TRANSFER_INCOMPLETE")
        }

        val output = transfer.output ?: throw SecurityException("TRANSFER_NOT_ACCEPTED")
        output.fd.sync()
        output.close()
        transfer.output = null
        if (transfer.tempFile.length() != manifest.size ||
            !MessageDigest.isEqual(TransferUtils.hashFile(transfer.tempFile), manifest.fileHash)
        ) {
            throw SecurityException("FINAL_FILE_HASH_MISMATCH")
        }

        val libraryDirectory = java.io.File(appContext.filesDir, TransferConstants.LIBRARY_DIR).apply { mkdirs() }
        val target = TransferUtils.uniqueLibraryFile(libraryDirectory, manifest.fileName, transferIdText)
        if (!transfer.tempFile.renameTo(target)) {
            throw IllegalStateException("ATOMIC_FINALIZE_FAILED")
        }
        persistence.getPendingIncoming().remove(transferIdText)
        transfer.metadataFile.delete()
        SetuPeerTransport.sendFrame(
            session.sessionId,
            SetuPeerTransport.FRAME_TRANSFER_COMPLETE_ACK,
            TransferUtils.encodeTransferId(id),
        )
        listener.onCompleted(
            transferIdText,
            session.sessionId,
            session.peerId,
            target.name,
            manifest.size,
            "download",
            target.absolutePath
        )
        // Joining the swarm re-reads the whole file to verify each piece, so it runs after the peer
        // has its commit confirmation and off this thread.
        TransferSwarmPublisher.publishReceived(
            appContext,
            manifest,
            transfer.offer.peerId,
            transferIdText,
            target,
        )
    }

    fun handleIncomingCancel(session: PeerSession, payload: ByteArray) {
        val id = TransferUtils.parseTransferIdPayload(payload)
        val transferIdText = id.toString()
        val transfer = persistence.getPendingIncoming()[transferIdText] ?: return
        if (transfer.offer.sessionId != session.sessionId) throw SecurityException("TRANSFER_SESSION_MISMATCH")
        persistence.getPendingIncoming().remove(transferIdText)?.let { persistence.closeAndDelete(it) }
        listener.onFailed(transferIdText, session.sessionId, session.peerId, "Transfer cancelled.", "download")
    }

    fun routeReply(session: PeerSession, payload: ByteArray, type: Int) {
        val id = TransferUtils.parseTransferIdPayload(payload)
        if (outgoingSessionIds[id.toString()] != session.sessionId) {
            throw SecurityException("TRANSFER_SESSION_MISMATCH")
        }
        outgoingReplies[id.toString()]?.offer(TransferFrame(type, payload))
    }

    fun onIncomingSessionClosed(session: PeerSession) {
        persistence.getPendingIncoming().entries
            .filter { it.value.offer.sessionId == session.sessionId }
            .forEach { entry ->
                runCatching { entry.value.output?.close() }
                entry.value.output = null
                entry.value.offer.sessionId = ""
            }
    }
}
