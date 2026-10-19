package expo.modules.setunative.persistence

import android.content.Context
import expo.modules.setunative.models.*

class TransferRepository(private val dbHelper: SetuDatabase) {

    companion object {
        private const val TAG = "SETU_TRANSFER_REPO"

        fun create(context: Context): TransferRepository {
            val database = SetuDatabase.getInstance(context)
            TransferSchemaMigration.ensureColumns(database.writableDatabase)
            return TransferRepository(database)
        }
    }

    private val upsertHandler = TransferRepositoryUpsert(this)
    private val queryHandler = TransferRepositoryQuery(this)
    private val updateHandler = TransferRepositoryUpdate(this)
    private val deleteHandler = TransferRepositoryDelete(this)

    // CRUD operations
    fun upsert(transfer: SetuTransfer): Boolean = upsertHandler.upsert(transfer)
    fun get(transferId: String): SetuTransfer? = queryHandler.get(transferId)
    fun getAll(): List<SetuTransfer> = queryHandler.getAll()
    fun getByState(state: TransferState): List<SetuTransfer> = queryHandler.getByState(state)
    fun getByManifest(manifestId: String): List<SetuTransfer> = queryHandler.getByManifest(manifestId)
    fun getByPeer(peerId: String): List<SetuTransfer> = queryHandler.getByPeer(peerId)
    fun updateState(transferId: String, state: TransferState): Boolean = updateHandler.updateState(transferId, state)
    fun updateProgress(transferId: String, bytesTransferred: Long, pieceCount: Int): Boolean = updateHandler.updateProgress(transferId, bytesTransferred, pieceCount)
    fun updateError(transferId: String, error: String): Boolean = updateHandler.updateError(transferId, error)
    fun delete(transferId: String): Boolean = deleteHandler.delete(transferId)
    fun clearCompleted(): Int = deleteHandler.clearCompleted()
    fun clearAll(): Int = deleteHandler.clearAll()

    internal fun getDb() = dbHelper.readableDatabase
    internal fun getWritableDb() = dbHelper.writableDatabase
    internal fun getDbHelper() = dbHelper
}
