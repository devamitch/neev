package expo.modules.setunative.swarm

import android.content.Context
import android.net.Uri
import android.util.AtomicFile
import expo.modules.setunative.models.SetuManifest
import expo.modules.setunative.network.TransferConstants
import java.io.File
import java.security.MessageDigest

/**
 * Verified piece storage.
 *
 * A piece lives in one of three layouts and all of them are read through the same verified path:
 *
 *  - **piece file** - one file per piece under `swarm_pieces/`, written by [writeVerified] when a
 *    piece arrives from the swarm before the whole file exists.
 *  - **range of a complete file** - a finished file under `library/`, where piece *i* is the byte
 *    range `[manifest.pieceOffset(i), + manifest.pieceLength(i))`. A device that completed a 1:1
 *    transfer already holds every byte; re-splitting it into piece files would duplicate the whole
 *    file on disk for nothing.
 *  - **range of the phone's own copy** - the same thing once the file has been handed to MediaStore
 *    and is reachable only as `content://...`. Publishing moves the file, so without this layout a
 *    receiver loses every piece it just verified and can never serve the content it holds.
 *
 * Every read re-hashes the bytes against the manifest before returning them, so a piece can never
 * be served or advertised on the strength of its path alone.
 *
 * Nothing outside this class is allowed to know which layout a piece is in. [locate] is the one way
 * to ask where a piece's bytes are; a caller that opens `storagePath` itself and reads from offset
 * zero silently reads the wrong bytes for every piece after the first.
 */
class PieceStore(context: Context) {
    private val appContext = context.applicationContext
    private val root = File(appContext.filesDir, "swarm_pieces").canonicalFile
    private val libraryRoot = File(appContext.filesDir, TransferConstants.LIBRARY_DIR).canonicalFile

    /**
     * Where piece [PieceLocation.index] physically is: a byte range inside one backing object.
     * [open] is the only way to read it, so the offset can never be dropped on the way.
     */
    internal inner class PieceLocation(
        val index: Int,
        private val file: File?,
        private val uri: Uri?,
        val offset: Long,
        val length: Int,
    ) {
        /** A stable identity for the backing object, so consecutive pieces can reuse one handle. */
        val sourceKey: String = file?.path ?: uri.toString()

        fun open(): PieceByteSource =
            if (file != null) {
                PieceByteSource.open(file)
            } else {
                PieceByteSource.open(appContext.contentResolver, requireNotNull(uri))
            }
    }

    fun writeVerified(manifest: SetuManifest, index: Int, data: ByteArray): File {
        validate(manifest, index, data.size)
        val expectedHash = manifest.pieceHashes[index]
        require(MessageDigest.isEqual(sha256(data), expectedHash)) { "PIECE_HASH_MISMATCH" }
        check(root.exists() || root.mkdirs()) { "PIECE_STORAGE_UNAVAILABLE" }

        val destination = pieceFile(manifest.manifestId, index)
        val atomicFile = AtomicFile(destination)
        val output = atomicFile.startWrite()
        try {
            output.write(data)
            atomicFile.finishWrite(output)
        } catch (error: Exception) {
            atomicFile.failWrite(output)
            throw error
        }
        return destination
    }

    fun readVerified(
        manifest: SetuManifest,
        index: Int,
        expectedHash: ByteArray,
        storagePath: String? = null
    ): ByteArray {
        validate(manifest, index, manifest.pieceLength(index))
        require(MessageDigest.isEqual(expectedHash, manifest.pieceHashes[index])) { "MANIFEST_HASH_MISMATCH" }
        val location = resolve(manifest, index, storagePath)

        val bytes = ByteArray(location.length)
        location.open().use { source -> source.readFullyAt(location.offset, bytes, 0, location.length) }
        require(MessageDigest.isEqual(sha256(bytes), expectedHash)) { "PIECE_HASH_MISMATCH" }
        return bytes
    }

    fun verifyFile(manifest: SetuManifest, index: Int, expectedHash: ByteArray, storagePath: String?): Boolean {
        return try {
            validate(manifest, index, manifest.pieceLength(index))
            if (!MessageDigest.isEqual(expectedHash, manifest.pieceHashes[index])) return false
            val location = resolve(manifest, index, storagePath)
            val digest = MessageDigest.getInstance("SHA-256")
            location.open().use { source ->
                val buffer = ByteArray(64 * 1024)
                var read = 0
                while (read < location.length) {
                    val count = source.readAt(
                        location.offset + read,
                        buffer,
                        0,
                        minOf(buffer.size, location.length - read),
                    )
                    if (count <= 0) return false
                    digest.update(buffer, 0, count)
                    read += count
                }
            }
            MessageDigest.isEqual(digest.digest(), expectedHash)
        } catch (_: Exception) {
            false
        }
    }

    /**
     * The byte range backing piece [index], or null when it is not readable right now. Unlike
     * [verifyFile] this does not re-hash: a reader that streams a piece verifies as it goes, and
     * re-hashing every piece on the way to playback would read the whole file twice.
     */
    internal fun locate(manifest: SetuManifest, index: Int, storagePath: String?): PieceLocation? =
        try {
            validate(manifest, index, manifest.pieceLength(index))
            resolve(manifest, index, storagePath)
        } catch (_: Exception) {
            null
        }

    /**
     * Resolves where piece [index] physically lives. The backing object's kind decides the layout,
     * and its length must match that layout exactly - a piece file holds one piece, a complete file
     * holds the whole manifest.
     */
    private fun resolve(manifest: SetuManifest, index: Int, storagePath: String?): PieceLocation {
        val expectedLength = manifest.pieceLength(index)
        val raw = storagePath ?: pieceFile(manifest.manifestId, index).path

        if (raw.startsWith("content://")) {
            val uri = Uri.parse(raw)
            require(PieceByteSource.lengthOf(appContext.contentResolver, uri) == manifest.size) {
                "PIECE_FILE_UNAVAILABLE"
            }
            return PieceLocation(index, null, uri, manifest.pieceOffset(index), expectedLength)
        }

        val file = File(raw).canonicalFile
        require(file.isFile) { "PIECE_FILE_UNAVAILABLE" }
        return when (file.parentFile) {
            root -> {
                require(file.length() == expectedLength.toLong()) { "PIECE_FILE_UNAVAILABLE" }
                PieceLocation(index, file, null, 0L, expectedLength)
            }
            libraryRoot -> {
                require(file.length() == manifest.size) { "PIECE_FILE_UNAVAILABLE" }
                PieceLocation(index, file, null, manifest.pieceOffset(index), expectedLength)
            }
            else -> throw IllegalArgumentException("PIECE_PATH_INVALID")
        }
    }

    private fun validate(manifest: SetuManifest, index: Int, length: Int): Int {
        require(manifest.manifestId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "MANIFEST_ID_INVALID" }
        require(index in 0 until manifest.pieceCount) { "PIECE_INDEX_INVALID" }
        val expectedLength = manifest.pieceLength(index)
        require(expectedLength in 1..MAX_PIECE_BYTES && length == expectedLength) { "PIECE_LENGTH_INVALID" }
        require(manifest.pieceHashes[index].size == SHA256_BYTES) { "PIECE_HASH_INVALID" }
        return expectedLength
    }

    private fun pieceFile(manifestId: String, index: Int) = File(root, "${manifestId}_$index")

    private fun sha256(data: ByteArray) = MessageDigest.getInstance("SHA-256").digest(data)

    companion object {
        private const val MAX_PIECE_BYTES = 4 * 1024 * 1024
        private const val SHA256_BYTES = 32
    }
}
