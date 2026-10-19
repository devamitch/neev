package expo.modules.setunative.media

import expo.modules.setunative.models.PieceState
import expo.modules.setunative.models.SetuManifest
import expo.modules.setunative.persistence.PieceRepository
import expo.modules.setunative.swarm.PieceByteSource
import expo.modules.setunative.swarm.PieceStore
import expo.modules.setunative.swarm.SetuSwarmEngine

/**
 * Reads Setu content for Media3, one piece at a time, in content order.
 *
 * A piece is a byte range inside something, and which something depends on how this device came to
 * hold it: its own small file under `swarm_pieces/` when it arrived from the swarm, or a range of
 * one complete file when this device received the whole thing in a single transfer. [PieceStore] is
 * the only place that knows which, so this class never opens a path itself — it asks for a location
 * and reads at that location's offset.
 *
 * Consecutive pieces of a received file share one backing object, so the open handle is kept across
 * pieces and reopened only when the backing object actually changes.
 */
internal class PieceDataManager(
    private val manifest: SetuManifest,
    private val pieceRepository: PieceRepository,
    private val swarmEngine: SetuSwarmEngine
) {

    private val availabilityWaiter = PieceAvailabilityWaiter(manifest, pieceRepository, swarmEngine)

    private var source: PieceByteSource? = null
    private var sourceKey: String? = null
    private var current: PieceStore.PieceLocation? = null
    /** Where in the content the open piece is positioned. */
    private var contentPosition: Long = 0
    private var pieceRemaining: Int = 0

    /**
     * Reads into [buffer] from [position] in the content.
     *
     * Returns the number of bytes read, or -1 at the real end of the content and nowhere else. A
     * piece that has not arrived yet is waited for and then read; a piece that cannot be read
     * throws. Reporting either of those as end-of-input is what makes Media3 treat a slow swarm as
     * a short file and stop playback for good.
     */
    fun read(buffer: ByteArray, offset: Int, length: Int, position: Long): Int {
        if (length == 0) return 0
        if (position >= manifest.size) return -1

        if (current == null || pieceRemaining <= 0 || contentPosition != position) {
            if (!moveTo(position)) return -1
        }

        val location = current ?: return -1
        val reader = source ?: return -1
        val wanted = minOf(length, pieceRemaining)
        val offsetInPiece = location.length - pieceRemaining
        val read = reader.readAt(location.offset + offsetInPiece, buffer, offset, wanted)
        if (read <= 0) throw DataSourceException("PIECE_READ_FAILED:${location.index}")

        pieceRemaining -= read
        contentPosition += read
        return read
    }

    fun close() {
        runCatching { source?.close() }
        source = null
        sourceKey = null
        current = null
        pieceRemaining = 0
    }

    /** Drops the open piece so the next read resolves the piece holding the new position. */
    fun seekToPosition(targetPosition: Long) {
        current = null
        pieceRemaining = 0
        contentPosition = targetPosition
    }

    /**
     * Positions on the piece holding [position], waiting for it to arrive if necessary. Only an
     * actual end of content returns false; everything else throws.
     */
    private fun moveTo(position: Long): Boolean {
        if (position >= manifest.size) return false
        val index = (position / manifest.pieceSize.toLong()).toInt()
        if (index >= manifest.pieceCount) return false

        val location = availabilityWaiter.await(index)
        if (location.sourceKey != sourceKey || source == null) {
            runCatching { source?.close() }
            source = location.open()
            sourceKey = location.sourceKey
        }

        val offsetInPiece = (position - manifest.pieceOffset(index)).toInt()
        current = location
        pieceRemaining = location.length - offsetInPiece
        contentPosition = position
        return pieceRemaining > 0
    }

    /** True when every piece covering the range is verified and locatable right now. */
    fun isRangeAvailable(start: Long, length: Long): Boolean {
        if (start < 0 || length <= 0 || start > Long.MAX_VALUE - length) return false
        val end = start + length
        if (end > manifest.size) return false

        val startPiece = (start / manifest.pieceSize).toInt()
        val endPiece = ((end - 1) / manifest.pieceSize).toInt()
        return (startPiece..endPiece).all { it < manifest.pieceCount && isPieceReadable(it) }
    }

    /** The contiguous byte ranges readable without waiting, for the buffered indicator. */
    fun getAvailableRanges(): List<Pair<Long, Long>> {
        val ranges = mutableListOf<Pair<Long, Long>>()
        var rangeStart: Long? = null
        for (index in 0 until manifest.pieceCount) {
            val pieceStart = manifest.pieceOffset(index)
            if (isPieceReadable(index)) {
                if (rangeStart == null) rangeStart = pieceStart
            } else if (rangeStart != null) {
                ranges.add(rangeStart to pieceStart)
                rangeStart = null
            }
        }
        rangeStart?.let { ranges.add(it to manifest.size) }
        return ranges
    }

    private fun isPieceReadable(index: Int): Boolean {
        val piece = pieceRepository.get("${manifest.manifestId}_$index") ?: return false
        if (piece.state != PieceState.AVAILABLE) return false
        return swarmEngine.pieceStore.locate(manifest, index, piece.storagePath) != null
    }
}
