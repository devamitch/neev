package expo.modules.setunative.persistence

import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*

internal class TransferRepositoryDelete(private val repository: TransferRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()

    fun delete(transferId: String): Boolean {
        val db = getWritableDb()
        return try {
            db.delete("setu_transfers", "transfer_id = ?", arrayOf(transferId)) > 0
        } catch (error: Exception) {
            false
        }
    }

    fun clearCompleted(): Int {
        val db = getWritableDb()
        return try {
            db.delete("setu_transfers", "state = ?", arrayOf(TransferState.COMPLETED.name))
        } catch (error: Exception) {
            0
        }
    }

    fun clearAll(): Int {
        val db = getWritableDb()
        return try {
            db.delete("setu_transfers", null, null)
        } catch (error: Exception) {
            0
        }
    }

    fun clearExpired() {
        val db = getWritableDb()
        try {
            val whereClause = "state != ? AND created_at < ?"
            val whereArgs = arrayOf("COMPLETED", (System.currentTimeMillis() - (24 * 60 * 60 * 1000)).toString())
            db.delete("setu_transfers", whereClause, whereArgs)
        } catch (_: Exception) {
            // Ignore errors during cleanup
        }
    }
}
