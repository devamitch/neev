package expo.modules.setunative.network

import android.content.Context
import android.net.Uri
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.util.BitSet
import java.util.UUID

internal object TransferManifestParser {

    fun encodeManifest(manifest: TransferManifest): ByteArray {
        val body = encodeManifestBody(manifest)
        return body + manifest.manifestHash
    }

    fun encodeManifestBody(manifest: TransferManifest): ByteArray = ByteArrayOutputStream().also { bytes ->
        DataOutputStream(bytes).use { output ->
            output.writeByte(TransferConstants.MANIFEST_VERSION)
            TransferUtils.writeBoundedString(output, manifest.fileName, 255)
            TransferUtils.writeBoundedString(output, manifest.mimeType, 255)
            output.writeLong(manifest.size)
            output.writeInt(manifest.pieceSize)
            output.writeInt(manifest.pieceCount)
            output.write(manifest.fileHash)
            manifest.pieceHashes.forEach(output::write)
        }
    }.toByteArray()

    fun decodeManifest(bytes: ByteArray): TransferManifest {
        if (bytes.size !in 33..TransferConstants.MAX_MANIFEST_BYTES) {
            throw SecurityException("INVALID_MANIFEST_SIZE")
        }
        val input = DataInputStream(ByteArrayInputStream(bytes))
        if (input.readUnsignedByte() != TransferConstants.MANIFEST_VERSION) {
            throw SecurityException("MANIFEST_VERSION_UNSUPPORTED")
        }
        val fileName = TransferUtils.sanitizeFileName(
            TransferUtils.readBoundedString(input, 255)
        )
        val mimeType = TransferUtils.sanitizeMimeType(
            TransferUtils.readBoundedString(input, 255)
        )
        val size = input.readLong()
        val pieceSize = input.readInt()
        val pieceCount = input.readInt()

        if (size !in 0..TransferConstants.MAX_FILE_SIZE ||
            pieceSize != TransferConstants.PIECE_SIZE ||
            pieceCount !in 0..TransferConstants.MAX_PIECES
        ) {
            throw SecurityException("INVALID_MANIFEST_FIELDS")
        }

        val expectedCount = if (size == 0L) 0 else ((size - 1) / pieceSize + 1).toInt()
        if (pieceCount != expectedCount ||
            input.available() != 64 + pieceCount * 32
        ) {
            throw SecurityException("INVALID_MANIFEST_PIECE_COUNT")
        }

        val fileHash = ByteArray(32).also(input::readFully)
        val pieceHashes = ArrayList<ByteArray>(pieceCount)
        repeat(pieceCount) { pieceHashes.add(ByteArray(32).also(input::readFully)) }
        val manifestHash = ByteArray(32).also(input::readFully)

        val manifest = TransferManifest(
            fileName, mimeType, size, pieceSize, pieceHashes, fileHash, manifestHash
        )

        if (!MessageDigest.isEqual(
                TransferUtils.sha256(encodeManifestBody(manifest)),
                manifestHash
            )
        ) {
            throw SecurityException("MANIFEST_HASH_MISMATCH")
        }
        return manifest
    }

    fun createManifest(
        appContext: Context,
        uri: Uri,
        fileName: String,
        mimeType: String,
        size: Long,
    ): TransferManifest {
        val sanitizedName = TransferUtils.sanitizeFileName(fileName)
        val sanitizedMimeType = TransferUtils.sanitizeMimeType(mimeType)
        val count = if (size == 0L) 0 else ((size - 1) / TransferConstants.PIECE_SIZE + 1).toInt()

        if (count > TransferConstants.MAX_PIECES) {
            throw IllegalArgumentException("FILE_TOO_LARGE")
        }

        val overallDigest = MessageDigest.getInstance("SHA-256")
        val pieceHashes = ArrayList<ByteArray>(count)
        var processed = 0L

        appContext.contentResolver.openInputStream(uri)?.use { input ->
            repeat(count) { index ->
                val length = minOf(
                    TransferConstants.PIECE_SIZE.toLong(),
                    size - processed
                ).toInt()
                val bytes = TransferUtils.readExactly(input, length)
                overallDigest.update(bytes)
                pieceHashes.add(TransferUtils.sha256(bytes))
                processed += length
            }
            if (input.read() != -1) throw IllegalStateException("SOURCE_SIZE_CHANGED")
        } ?: throw IllegalStateException("CONTENT_SOURCE_UNAVAILABLE")

        if (processed != size) throw IllegalStateException("SOURCE_SIZE_CHANGED")

        val fileHash = overallDigest.digest()
        val provisional = TransferManifest(
            sanitizedName,
            sanitizedMimeType,
            size,
            TransferConstants.PIECE_SIZE,
            pieceHashes,
            fileHash,
            ByteArray(32)
        )
        val manifestHash = TransferUtils.sha256(encodeManifestBody(provisional))
        return provisional.copy(manifestHash = manifestHash)
    }

    fun decodeAcceptedPieces(
        payload: ByteArray,
        transferId: UUID,
        pieceCount: Int
    ): BitSet {
        if (payload.size < 16) throw SecurityException("INVALID_TRANSFER_ACCEPT")
        val input = DataInputStream(ByteArrayInputStream(payload))
        if (TransferUtils.readTransferId(input) != transferId) {
            throw SecurityException("TRANSFER_ID_MISMATCH")
        }
        val bytes = ByteArray(input.available()).also(input::readFully)
        if (bytes.size > (pieceCount + 7) / 8) {
            throw SecurityException("INVALID_TRANSFER_BITMAP")
        }
        return BitSet.valueOf(bytes).also {
            if (it.nextSetBit(pieceCount) >= 0) {
                throw SecurityException("INVALID_TRANSFER_BITMAP")
            }
        }
    }
}
