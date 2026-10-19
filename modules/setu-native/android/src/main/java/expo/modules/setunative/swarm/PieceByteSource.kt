package expo.modules.setunative.swarm

import android.content.ContentResolver
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.channels.FileChannel

/**
 * A positional reader over the bytes that physically back a piece.
 *
 * A piece is a byte range, not a file. It may be a whole small file under `swarm_pieces/`, a range
 * of a complete file under `library/`, or a range of the copy the phone itself now owns behind a
 * `content://` URI. All three are the same operation - read `length` bytes at an absolute offset -
 * so they read through one type instead of three code paths that each have to remember the offset.
 *
 * Reads are positional: the channel's own cursor is never used, so one open source can serve
 * several pieces of the same file, and two readers of one source cannot move each other's position.
 */
internal class PieceByteSource private constructor(
    private val channel: FileChannel,
    private val closeables: List<Closeable>,
    val length: Long,
) : Closeable {

    /** Reads up to [length] bytes starting at absolute [position]. -1 at the end of the source. */
    fun readAt(position: Long, buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        require(position >= 0L) { "PIECE_READ_POSITION_INVALID" }
        if (position >= this.length) return -1
        val bounded = minOf(length.toLong(), this.length - position).toInt()
        return channel.read(ByteBuffer.wrap(buffer, offset, bounded), position)
    }

    /** Reads exactly [length] bytes, or throws. Used by the verified whole-piece reads. */
    fun readFullyAt(position: Long, buffer: ByteArray, offset: Int, length: Int) {
        var read = 0
        while (read < length) {
            val count = readAt(position + read, buffer, offset + read, length - read)
            if (count <= 0) throw IOException("PIECE_READ_TRUNCATED")
            read += count
        }
    }

    override fun close() {
        for (closeable in closeables) runCatching { closeable.close() }
    }

    companion object {
        fun open(file: File): PieceByteSource {
            val stream = FileInputStream(file)
            return PieceByteSource(stream.channel, listOf(stream), file.length())
        }

        /**
         * MediaStore hands out a seekable descriptor for a file it owns, which is what makes a
         * published copy usable as piece storage instead of needing a second private copy.
         */
        fun open(resolver: ContentResolver, uri: Uri): PieceByteSource {
            val descriptor = resolver.openFileDescriptor(uri, "r")
                ?: throw IOException("PIECE_URI_UNREADABLE")
            return try {
                val stream = FileInputStream(descriptor.fileDescriptor)
                PieceByteSource(stream.channel, listOf(stream, descriptor), descriptor.statSize)
            } catch (error: Exception) {
                runCatching { descriptor.close() }
                throw error
            }
        }

        fun lengthOf(resolver: ContentResolver, uri: Uri): Long =
            runCatching {
                resolver.openFileDescriptor(uri, "r")?.use(ParcelFileDescriptor::getStatSize) ?: -1L
            }.getOrDefault(-1L)
    }
}
