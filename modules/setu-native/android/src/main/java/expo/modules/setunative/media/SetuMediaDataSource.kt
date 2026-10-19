package expo.modules.setunative.media

import android.net.Uri
import android.util.Log
import androidx.media3.common.C
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSpec
import expo.modules.setunative.models.SetuManifest
import expo.modules.setunative.persistence.PieceRepository
import expo.modules.setunative.swarm.SetuSwarmEngine
import java.io.IOException

/**
 * Media3 DataSource backed by Setu pieces, so a video plays from the pieces this device already
 * holds while the rest is still arriving. Piece access itself belongs to [PieceDataManager].
 *
 * The end-of-input contract is the delicate part: Media3 treats end-of-input as "the content is
 * over", permanently. So -1 is returned only when the requested range has actually been read to
 * its end. A piece that has not arrived is waited for, and a piece that cannot be read throws, so
 * temporary swarm unavailability can never be mistaken for a truncated file.
 */
class SetuMediaDataSource(
    private val manifestId: String,
    private val pieceRepository: PieceRepository,
    private val swarmEngine: SetuSwarmEngine
) : BaseDataSource(false) {

    companion object {
        private const val TAG = "SETU_MEDIA_DS"
    }

    private var dataSpec: DataSpec? = null
    private var opened: Boolean = false
    private var position: Long = 0
    /** Bytes still owed for this open range, or null when the range runs to the end of content. */
    private var remaining: Long? = null

    private var manifest: SetuManifest? = null
    private var pieceManager: PieceDataManager? = null

    override fun open(dataSpec: DataSpec): Long {
        transferInitializing(dataSpec)
        this.dataSpec = dataSpec
        this.opened = false

        val manifest = swarmEngine.manifestRepository.get(manifestId)
            ?: throw DataSourceException("MANIFEST_UNAVAILABLE:$manifestId")
        this.manifest = manifest
        if (dataSpec.position > manifest.size) {
            throw IOException("Requested position exceeds content length")
        }

        this.position = dataSpec.position
        val toEnd = manifest.size - dataSpec.position
        val length = if (dataSpec.length == C.LENGTH_UNSET.toLong()) toEnd else minOf(dataSpec.length, toEnd)
        this.remaining = length

        this.pieceManager = PieceDataManager(manifest, pieceRepository, swarmEngine).also {
            if (dataSpec.position > 0) it.seekToPosition(dataSpec.position)
        }

        this.opened = true
        transferStarted(dataSpec)
        Log.d(TAG, "DataSource opened for $manifestId at ${dataSpec.position}, $length bytes")
        return length
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (!opened) throw IOException("DataSource not opened")
        if (length == 0) return 0

        val left = remaining ?: throw IOException("DataSource not initialized")
        // The requested range is fully served: this, and only this, is end of input.
        if (left <= 0L) return C.RESULT_END_OF_INPUT

        val manager = pieceManager ?: throw IOException("DataSource not initialized")
        val wanted = minOf(length.toLong(), left).toInt()
        val read = manager.read(buffer, offset, wanted, position)
        if (read <= 0) return C.RESULT_END_OF_INPUT

        position += read
        remaining = left - read
        bytesTransferred(read)
        return read
    }

    override fun close() {
        if (opened) transferEnded()
        pieceManager?.close()
        pieceManager = null
        opened = false
        remaining = null
        Log.d(TAG, "DataSource closed for $manifestId")
    }

    override fun getUri(): Uri? = dataSpec?.uri

    fun isRangeAvailable(start: Long, length: Long): Boolean =
        pieceManager?.isRangeAvailable(start, length) == true

    fun getAvailableRanges(): List<Pair<Long, Long>> = pieceManager?.getAvailableRanges() ?: emptyList()
}
