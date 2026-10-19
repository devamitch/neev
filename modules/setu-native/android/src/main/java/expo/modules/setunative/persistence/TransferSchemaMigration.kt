package expo.modules.setunative.persistence

import android.database.sqlite.SQLiteDatabase

internal object TransferSchemaMigration {
    fun ensureColumns(database: SQLiteDatabase) {
        val tableExists = database.rawQuery(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            arrayOf("setu_transfers")
        ).use { it.moveToFirst() }
        if (!tableExists) return

        val columns = database.rawQuery("PRAGMA table_info(setu_transfers)", null).use { cursor ->
            val nameIndex = cursor.getColumnIndexOrThrow("name")
            buildSet {
                while (cursor.moveToNext()) add(cursor.getString(nameIndex))
            }
        }
        if ("error_message" !in columns) database.execSQL("ALTER TABLE setu_transfers ADD COLUMN error_message TEXT")
        if ("completed_at" !in columns) database.execSQL("ALTER TABLE setu_transfers ADD COLUMN completed_at INTEGER")
    }
}
