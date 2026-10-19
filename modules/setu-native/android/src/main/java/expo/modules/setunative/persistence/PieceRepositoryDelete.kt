package expo.modules.setunative.persistence

import android.database.sqlite.SQLiteDatabase

internal class PieceRepositoryDelete(private val repository: PieceRepository) {

    private fun getWritableDb(): SQLiteDatabase = repository.getWritableDb()

    fun deleteByManifest(manifestId: String): Int {
        val db = getWritableDb()
        return try {
            db.delete("setu_pieces", "manifest_id = ?", arrayOf(manifestId))
        } catch (error: Exception) {
            0
        }
    }

    fun deleteExpired() {
        val db = getWritableDb()
        try {
            // Delete pieces that are not verified and older than 24 hours
            val whereClause = "state != ? AND verified_at < ?"
            val whereArgs = arrayOf("VERIFIED", (System.currentTimeMillis() - (24 * 60 * 60 * 1000)).toString())
            db.delete("setu_pieces", whereClause, whereArgs)
        } catch (_: Exception) {
            // Ignore errors during cleanup
        }
    }
}