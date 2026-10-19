package expo.modules.setunative.persistence

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.TransferState

internal class TransferRepositoryUpdate(private val repository: TransferRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()

    fun updateState(transferId: String, state: TransferState): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("state", state.name)
                put("updated_at", System.currentTimeMillis())
                if (state == TransferState.COMPLETED) {
                    put("completed_at", System.currentTimeMillis())
                }
            }
            db.update("setu_transfers", values, "transfer_id = ?", arrayOf(transferId)) > 0
        } catch (error: Exception) {
            false
        }
    }

    fun updateProgress(transferId: String, bytesTransferred: Long, piecesTransferred: Int): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("verified_bytes", bytesTransferred)
                put("updated_at", System.currentTimeMillis())
            }
            db.update("setu_transfers", values, "transfer_id = ?", arrayOf(transferId)) > 0
        } catch (error: Exception) {
            false
        }
    }

    fun updateError(transferId: String, error: String): Boolean {
        val db = getWritableDb()
        return try {
            val values = ContentValues().apply {
                put("state", "FAILED")
                put("error_message", error)
                put("updated_at", System.currentTimeMillis())
            }
            db.update("setu_transfers", values, "transfer_id = ?", arrayOf(transferId)) > 0
        } catch (error: Exception) {
            false
        }
    }
}
