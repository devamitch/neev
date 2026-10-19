package expo.modules.setunative.persistence

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import expo.modules.setunative.messaging.Conversation
import expo.modules.setunative.messaging.SetuMessage
import expo.modules.setunative.models.Capability
import expo.modules.setunative.models.SetuPeer
import expo.modules.setunative.models.TrustState
import expo.modules.setunative.sharedspace.SharedSpace
import org.json.JSONObject

/** Copies any legacy SQLite messaging rows before removing their plaintext tables. */
internal object MessageStoreMigration {
    private const val MARKER_ID = "migration:sensitive-metadata-v2"
    private const val MESSAGE_PREFIX = "message:"
    private const val CONVERSATION_PREFIX = "conversation:"
    private const val SPACE_PREFIX = "space:"

    fun migrate(context: Context, store: SetuStore) {
        val database = SetuDatabase.getInstance(context).writableDatabase
        val marker = store.read("ledger", MARKER_ID)
        val complete = marker != null
        marker?.fill(0)

        if (!complete) {
            if (tableExists(database, "setu_conversations")) migrateConversations(database, store)
            if (tableExists(database, "setu_messages")) migrateMessages(database, store)
            PeerStoreMigration.migrate(database, store)
            migrateSharedSpaces(database, store)
            TombstoneStoreMigration.migrate(database, store)
            store.write("ledger", MARKER_ID, byteArrayOf(1))
        }

        dropLegacyTables(database)
    }

    private fun migrateSharedSpaces(database: SQLiteDatabase, store: SetuStore) {
        if (!tableExists(database, "setu_shared_spaces")) return
        database.query("setu_shared_spaces", null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val space = SharedSpace(
                    spaceId = cursor.requiredString("space_id"),
                    name = cursor.requiredString("name"),
                    ownerId = cursor.requiredString("owner_id"),
                    createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
                    updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow("updated_at")),
                    members = cursor.string("members")?.split(",")?.filter { it.isNotEmpty() }?.toSet().orEmpty(),
                    invitedMembers = cursor.string("invited_members")?.split(",")?.filter { it.isNotEmpty() }?.toSet().orEmpty(),
                    isEncrypted = cursor.int("is_encrypted") == 1,
                    sizeLimit = cursor.long("size_limit") ?: 0L,
                    contentLimit = cursor.int("content_limit") ?: 0,
                    contentCount = cursor.int("content_count") ?: 0,
                    totalSize = cursor.long("total_size") ?: 0L,
                    version = cursor.long("version") ?: 1L,
                    encryptionKeyId = cursor.string("encryption_key_id"),
                    isActive = cursor.int("is_active") != 0
                )
                val encoded = SharedSpaceRecordCodec.encode(space)
                try { store.write("spaces", SPACE_PREFIX + space.spaceId, encoded) } finally { encoded.fill(0) }
            }
        }
    }

    private fun migrateMessages(database: SQLiteDatabase, store: SetuStore) {
        database.query("setu_messages", null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val message = SetuMessage(
                    messageId = cursor.requiredString("message_id"),
                    conversationId = cursor.requiredString("conversation_id"),
                    senderId = cursor.requiredString("sender_id"),
                    recipientId = cursor.requiredString("recipient_id"),
                    content = cursor.requiredString("content"),
                    type = cursor.requiredString("type"),
                    state = cursor.requiredString("state"),
                    timestamp = cursor.getLong(cursor.getColumnIndexOrThrow("timestamp")),
                    isEncrypted = cursor.getInt(cursor.getColumnIndexOrThrow("is_encrypted")) == 1,
                    isRead = cursor.getInt(cursor.getColumnIndexOrThrow("is_read")) == 1,
                    attachmentIds = cursor.getString(cursor.getColumnIndexOrThrow("attachment_ids"))
                        ?.split(",")?.filter { it.isNotEmpty() },
                    hopCount = cursor.getInt(cursor.getColumnIndexOrThrow("hop_count")),
                    expiresAt = cursor.getLong(cursor.getColumnIndexOrThrow("expires_at"))
                )
                val encoded = MessageRecordCodec.encodeMessage(message)
                try {
                    store.write("messages", MESSAGE_PREFIX + message.messageId, encoded)
                } finally {
                    encoded.fill(0)
                }
            }
        }
    }
    private fun migrateConversations(database: SQLiteDatabase, store: SetuStore) {
        database.query("setu_conversations", null, null, null, null, null, null).use { cursor ->
            while (cursor.moveToNext()) {
                val conversation = Conversation(
                    conversationId = cursor.requiredString("conversation_id"),
                    participants = cursor.requiredString("participants").split(",").filter { it.isNotEmpty() }.toSet(),
                    createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
                    lastMessageAt = cursor.getLong(cursor.getColumnIndexOrThrow("last_message_at")),
                    lastMessageContent = cursor.getString(cursor.getColumnIndexOrThrow("last_message_content")),
                    isGroup = cursor.getInt(cursor.getColumnIndexOrThrow("is_group")) == 1,
                    name = cursor.getString(cursor.getColumnIndexOrThrow("name")),
                    ownerId = cursor.getString(cursor.getColumnIndexOrThrow("owner_id"))
                )
                val encoded = MessageRecordCodec.encodeConversation(conversation)
                try {
                    store.write("messages", CONVERSATION_PREFIX + conversation.conversationId, encoded)
                } finally {
                    encoded.fill(0)
                }
            }
        }
    }
    private fun dropLegacyTables(database: SQLiteDatabase) {
        database.beginTransaction()
        try {
            if (tableExists(database, "setu_messages")) database.execSQL("DROP TABLE setu_messages")
            if (tableExists(database, "setu_conversations")) database.execSQL("DROP TABLE setu_conversations")
            if (tableExists(database, "peers")) database.execSQL("DROP TABLE peers")
            if (tableExists(database, "setu_peers")) database.execSQL("DROP TABLE setu_peers")
            if (tableExists(database, "setu_blocked_peers")) database.execSQL("DROP TABLE setu_blocked_peers")
            if (tableExists(database, "setu_quarantined_peers")) database.execSQL("DROP TABLE setu_quarantined_peers")
            if (tableExists(database, "setu_content_access")) database.execSQL("DROP TABLE setu_content_access")
            if (tableExists(database, "setu_shared_spaces")) database.execSQL("DROP TABLE setu_shared_spaces")
            if (tableExists(database, "setu_tombstones")) database.execSQL("DROP TABLE setu_tombstones")
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
    }

    private fun tableExists(database: SQLiteDatabase, table: String): Boolean =
        database.rawQuery("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", arrayOf(table))
            .use { it.moveToFirst() }

    private fun Cursor.requiredString(column: String): String =
        getString(getColumnIndexOrThrow(column)) ?: error("Legacy messaging row has null $column")

    private fun Cursor.string(column: String): String? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getString(index)
    }

    private fun Cursor.int(column: String): Int? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getInt(index)
    }

    private fun Cursor.long(column: String): Long? {
        val index = getColumnIndex(column)
        return if (index < 0 || isNull(index)) null else getLong(index)
    }
}
