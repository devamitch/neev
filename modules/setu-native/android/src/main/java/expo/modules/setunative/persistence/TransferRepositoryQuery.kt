package expo.modules.setunative.persistence

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.models.*

internal class TransferRepositoryQuery(private val repository: TransferRepository) {

    private fun getDb(): SQLiteDatabase = repository.getDb()
    private fun getDbHelper(): SetuDatabase = repository.getDbHelper()

    fun get(transferId: String): SetuTransfer? {
        val db = getDb()
        val selection = "transfer_id = ?"
        val selectionArgs = arrayOf(transferId)

        return db.query("setu_transfers", null, selection, selectionArgs, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                TransferRepositoryMappings.mapTransfer(cursor, getDbHelper())
            } else {
                null
            }
        }
    }

    fun getAll(): List<SetuTransfer> {
        val db = getDb()
        return db.query("setu_transfers", null, null, null, null, null, "updated_at DESC")?.use { cursor ->
            val transfers = mutableListOf<SetuTransfer>()
            while (cursor.moveToNext()) {
                transfers.add(TransferRepositoryMappings.mapTransfer(cursor, getDbHelper()))
            }
            transfers
        } ?: emptyList()
    }

    fun getByState(state: TransferState): List<SetuTransfer> {
        val db = getDb()
        val selection = "state = ?"
        val selectionArgs = arrayOf(state.name)

        return db.query("setu_transfers", null, selection, selectionArgs, null, null, "updated_at DESC")?.use { cursor ->
            val transfers = mutableListOf<SetuTransfer>()
            while (cursor.moveToNext()) {
                transfers.add(TransferRepositoryMappings.mapTransfer(cursor, getDbHelper()))
            }
            transfers
        } ?: emptyList()
    }

    fun getByManifest(manifestId: String): List<SetuTransfer> {
        val db = getDb()
        val selection = "manifest_id = ?"
        val selectionArgs = arrayOf(manifestId)

        return db.query("setu_transfers", null, selection, selectionArgs, null, null, "updated_at DESC")?.use { cursor ->
            val transfers = mutableListOf<SetuTransfer>()
            while (cursor.moveToNext()) {
                transfers.add(TransferRepositoryMappings.mapTransfer(cursor, getDbHelper()))
            }
            transfers
        } ?: emptyList()
    }

    fun getByPeer(peerId: String): List<SetuTransfer> {
        val db = getDb()
        val selection = "peer_id = ?"
        val selectionArgs = arrayOf(peerId)

        return db.query("setu_transfers", null, selection, selectionArgs, null, null, "updated_at DESC")?.use { cursor ->
            val transfers = mutableListOf<SetuTransfer>()
            while (cursor.moveToNext()) {
                transfers.add(TransferRepositoryMappings.mapTransfer(cursor, getDbHelper()))
            }
            transfers
        } ?: emptyList()
    }
}
