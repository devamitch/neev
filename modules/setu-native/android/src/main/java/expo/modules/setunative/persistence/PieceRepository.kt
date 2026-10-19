package expo.modules.setunative.persistence

import android.content.Context
import expo.modules.setunative.models.*
import java.util.*

class PieceRepository(private val dbHelper: SetuDatabase) {

    companion object {
        private const val TAG = "SETU_PIECE_REPO"
        
        fun create(context: Context): PieceRepository {
            return PieceRepository(SetuDatabase.getInstance(context))
        }
    }

    private val upsertHandler = PieceRepositoryUpsert(this)
    private val queryHandler = PieceRepositoryQuery(this)
    private val updateHandler = PieceRepositoryUpdate(this)
    private val deleteHandler = PieceRepositoryDelete(this)

    // CRUD operations
    fun upsert(piece: SetuPiece): Boolean = upsertHandler.upsert(piece)
    fun get(pieceId: String): SetuPiece? = queryHandler.get(pieceId)
    fun getByManifest(manifestId: String): List<SetuPiece> = queryHandler.getByManifest(manifestId)
    fun getByState(manifestId: String, state: PieceState): List<SetuPiece> = queryHandler.getByState(manifestId, state)
    fun getAvailablePieces(manifestId: String): List<SetuPiece> = queryHandler.getAvailablePieces(manifestId)
    fun getMissingPieces(manifestId: String, totalPieces: Int): List<Int> = queryHandler.getMissingPieces(manifestId, totalPieces)
    fun updateState(pieceId: String, state: PieceState): Boolean = updateHandler.updateState(pieceId, state)
    fun updateStoragePath(pieceId: String, storagePath: String): Boolean = updateHandler.updateStoragePath(pieceId, storagePath)
    fun addProvider(pieceId: String, peerId: String): Boolean = updateHandler.addProvider(pieceId, peerId)
    fun removeProvider(pieceId: String, peerId: String): Boolean = updateHandler.removeProvider(pieceId, peerId)
    fun getByContent(contentId: String): List<SetuPiece> = queryHandler.getByContent(contentId)
    fun deleteByManifest(manifestId: String): Int = deleteHandler.deleteByManifest(manifestId)
    fun getBitfield(manifestId: String, totalPieces: Int): BitSet = queryHandler.getBitfield(manifestId, totalPieces)
    fun getCountByState(manifestId: String, state: PieceState): Int = queryHandler.getCountByState(manifestId, state)

    internal fun getDb() = dbHelper.readableDatabase
    internal fun getWritableDb() = dbHelper.writableDatabase
    internal fun getDbHelper() = dbHelper
}