package expo.modules.setunative.persistence

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject

internal object TombstoneStoreMigration {
    fun migrate(database: SQLiteDatabase, store: SetuStore) {
        if (!tableExists(database)) return
        database.query("setu_tombstones", null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val tombstoneId = cursor.requiredString("tombstone_id")
                val record = JSONObject()
                    .put("tombstoneId", tombstoneId)
                    .put("spaceId", cursor.requiredString("space_id"))
                    .put("contentId", cursor.requiredString("content_id"))
                    .put("creatorId", cursor.requiredString("creator_id"))
                    .put("operationType", cursor.requiredString("operation_type"))
                    .put("createdAt", cursor.getLong(cursor.getColumnIndexOrThrow("created_at")))
                    .put("version", cursor.getLong(cursor.getColumnIndexOrThrow("version")))
                    .put("processed", cursor.getInt(cursor.getColumnIndexOrThrow("processed")) != 0)
                    .put("processedAt", cursor.nullableLong("processed_at"))
                    .toString()
                    .toByteArray(Charsets.UTF_8)
                try {
                    store.write("spaces", "tombstone:$tombstoneId", record)
                } finally {
                    record.fill(0)
                }
            }
        }
    }

    private fun tableExists(database: SQLiteDatabase): Boolean =
        database.rawQuery("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", arrayOf("setu_tombstones"))
            .use { it.moveToFirst() }

    private fun Cursor.requiredString(column: String): String =
        getString(getColumnIndexOrThrow(column)) ?: error("Legacy tombstone has null $column")

    private fun Cursor.nullableLong(column: String): Any =
        if (isNull(getColumnIndexOrThrow(column))) JSONObject.NULL else getLong(getColumnIndexOrThrow(column))
}
