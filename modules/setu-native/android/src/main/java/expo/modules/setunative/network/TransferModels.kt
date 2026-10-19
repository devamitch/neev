package expo.modules.setunative.network

import android.net.Uri
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.BitSet
import java.util.UUID

internal data class TransferManifest(
    val fileName: String,
    val mimeType: String,
    val size: Long,
    val pieceSize: Int,
    val pieceHashes: List<ByteArray>,
    val fileHash: ByteArray,
    val manifestHash: ByteArray,
) {
    val pieceCount: Int get() = pieceHashes.size

    fun pieceOffset(index: Int): Long = index.toLong() * pieceSize

    fun pieceLength(index: Int): Int = minOf(
        pieceSize.toLong(),
        size - pieceOffset(index)
    ).toInt()

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as TransferManifest
        if (fileName != other.fileName) return false
        if (mimeType != other.mimeType) return false
        if (size != other.size) return false
        if (pieceSize != other.pieceSize) return false
        if (pieceHashes != other.pieceHashes) return false
        if (!MessageDigest.isEqual(fileHash, other.fileHash)) return false
        if (!MessageDigest.isEqual(manifestHash, other.manifestHash)) return false
        return true
    }

    override fun hashCode(): Int {
        var result = fileName.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + size.hashCode()
        result = 31 * result + pieceSize
        result = 31 * result + pieceHashes.hashCode()
        result = 31 * result + fileHash.contentHashCode()
        result = 31 * result + manifestHash.contentHashCode()
        return result
    }
}

internal data class TransferOffer(
    val transferId: UUID,
    var sessionId: String,
    var peerId: String,
    val manifest: TransferManifest,
)

internal data class TransferFrame(val type: Int, val payload: ByteArray)

internal class IncomingTransfer(
    val offer: TransferOffer,
    val tempFile: File,
    val metadataFile: File,
    val receivedPieces: BitSet = BitSet(16384),
    var approved: Boolean = false,
    var output: RandomAccessFile? = null,
    var verifiedBytes: Long = 0,
)

internal data class OutgoingTransfer(
    val transferId: String,
    val peerId: String,
    val sourceUri: Uri,
    val fileName: String,
    val mimeType: String,
    val manifest: TransferManifest,
    val metadataFile: File,
)

interface TransferListener {
    fun onIncomingOffer(offer: OfferProjection)
    fun onStarted(transferId: String, sessionId: String, peerId: String, fileName: String, mimeType: String, size: Long)
    fun onProgress(transferId: String, sessionId: String, peerId: String, direction: String, verifiedBytes: Long, totalBytes: Long)
    fun onCompleted(
        transferId: String,
        sessionId: String,
        peerId: String,
        fileName: String,
        size: Long,
        direction: String,
        localFilePath: String?
    )
    fun onFailed(transferId: String, sessionId: String, peerId: String, reason: String, direction: String)
}

data class OfferProjection(
    val transferId: String,
    val sessionId: String,
    val peerId: String,
    val fileName: String,
    val mimeType: String,
    val size: Long,
)
