package expo.modules.setunative.network

import android.content.Context
import android.net.Uri
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.BitSet
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

internal class TransferPersistence(private val appContext: Context) {
    private val transferTmpDir: File by lazy {
        File(appContext.filesDir, TransferConstants.TRANSFER_TMP_DIR).apply { mkdirs() }
    }
    private val libraryDir: File by lazy {
        File(appContext.filesDir, TransferConstants.LIBRARY_DIR).apply { mkdirs() }
    }

    private val pendingIncoming = ConcurrentHashMap<String, IncomingTransfer>()
    private val pendingOutgoing = ConcurrentHashMap<String, OutgoingTransfer>()

    var tempCleanupComplete = false

    fun getPendingIncoming(): ConcurrentHashMap<String, IncomingTransfer> = pendingIncoming
    fun getPendingOutgoing(): ConcurrentHashMap<String, OutgoingTransfer> = pendingOutgoing

    fun restoreTransfers() {
        if (tempCleanupComplete) return

        transferTmpDir.listFiles()?.filter { it.isFile && it.name.endsWith(".meta") }?.forEach { metadataFile ->
            runCatching {
                val metadata = readMetadata(metadataFile)
                val transferId = metadata.getString("transferId")
                val peerId = metadata.getString("peerId")
                val manifest = TransferManifestParser.decodeManifest(
                    Base64.decode(metadata.getString("manifest"), Base64.NO_WRAP)
                )
                if (metadata.getString("direction") == "upload") {
                    pendingOutgoing[transferId] = OutgoingTransfer(
                        transferId = transferId,
                        peerId = peerId,
                        sourceUri = Uri.parse(metadata.getString("sourceUri")),
                        fileName = manifest.fileName,
                        mimeType = manifest.mimeType,
                        manifest = manifest,
                        metadataFile = metadataFile,
                    )
                    return@runCatching
                }
                val transfer = IncomingTransfer(
                    offer = TransferOffer(UUID.fromString(transferId), "", peerId, manifest),
                    tempFile = File(transferTmpDir, ".${transferId}.part"),
                    metadataFile = metadataFile,
                    receivedPieces = BitSet.valueOf(
                        Base64.decode(metadata.optString("pieces", ""), Base64.NO_WRAP),
                    ),
                    approved = metadata.optBoolean("approved", false),
                )
                validateExistingPieces(transfer)
                if (pendingIncoming.size < TransferConstants.MAX_PENDING_INCOMING) {
                    pendingIncoming[transferId] = transfer
                } else {
                    closeAndDelete(transfer)
                }
            }.onFailure {
                metadataFile.delete()
            }
        }
        transferTmpDir.listFiles()?.filter { it.isFile && it.name.endsWith(".part") }?.forEach { partFile ->
            val metadata = File(transferTmpDir, partFile.name.removeSuffix(".part") + ".meta")
            if (!metadata.exists()) partFile.delete()
        }
        tempCleanupComplete = true
    }

    fun validateExistingPieces(transfer: IncomingTransfer) {
        if (!transfer.tempFile.exists()) {
            transfer.receivedPieces.clear()
            return
        }
        java.io.RandomAccessFile(transfer.tempFile, "rw").use { file ->
            var index = transfer.receivedPieces.nextSetBit(0)
            while (index >= 0) {
                val length = TransferUtils.pieceLength(transfer.offer.manifest, index)
                if (file.length() < transfer.offer.manifest.pieceOffset(index) + length) {
                    transfer.receivedPieces.clear(index)
                } else {
                    val bytes = ByteArray(length)
                    file.seek(transfer.offer.manifest.pieceOffset(index))
                    file.readFully(bytes)
                    if (MessageDigest.isEqual(
                            TransferUtils.sha256(bytes),
                            transfer.offer.manifest.pieceHashes[index]
                        )
                    ) {
                        transfer.verifiedBytes += length
                    } else {
                        transfer.receivedPieces.clear(index)
                    }
                }
                index = transfer.receivedPieces.nextSetBit(index + 1)
            }
        }
        persistIncoming(transfer)
    }

    fun persistIncoming(transfer: IncomingTransfer) {
        val metadata = JSONObject()
            .put("direction", "download")
            .put("transferId", transfer.offer.transferId.toString())
            .put("peerId", transfer.offer.peerId)
            .put("manifest", Base64.encodeToString(
                TransferManifestParser.encodeManifest(transfer.offer.manifest), Base64.NO_WRAP
            ))
            .put("pieces", Base64.encodeToString(transfer.receivedPieces.toByteArray(), Base64.NO_WRAP))
            .put("approved", transfer.approved)
        writeMetadata(transfer.metadataFile, metadata)
    }

    fun persistOutgoing(transfer: OutgoingTransfer) {
        val metadata = JSONObject()
            .put("direction", "upload")
            .put("transferId", transfer.transferId)
            .put("peerId", transfer.peerId)
            .put("sourceUri", transfer.sourceUri.toString())
            .put("manifest", Base64.encodeToString(
                TransferManifestParser.encodeManifest(transfer.manifest), Base64.NO_WRAP
            ))
        writeMetadata(transfer.metadataFile, metadata)
    }

    private fun readMetadata(file: File): JSONObject = AtomicFile(file).openRead().use { input ->
        JSONObject(input.readBytes().toString(Charsets.UTF_8))
    }

    fun writeMetadata(file: File, metadata: JSONObject) {
        val atomic = AtomicFile(file)
        val output = atomic.startWrite()
        try {
            output.write(metadata.toString().toByteArray(Charsets.UTF_8))
            atomic.finishWrite(output)
        } catch (error: Exception) {
            atomic.failWrite(output)
            throw error
        }
    }

    fun closeAndDelete(transfer: IncomingTransfer) {
        try {
            transfer.output?.close()
        } catch (_: Exception) {
        }
        transfer.output = null
        if (transfer.tempFile.exists()) transfer.tempFile.delete()
        transfer.metadataFile.delete()
    }
}
