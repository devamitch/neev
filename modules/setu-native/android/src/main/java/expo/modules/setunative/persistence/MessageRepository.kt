package expo.modules.setunative.persistence

import android.content.Context
import expo.modules.setunative.messaging.Conversation
import expo.modules.setunative.messaging.SetuMessage
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** Persists message and conversation records only through encrypted SetuStore. */
class MessageRepository private constructor(private val store: SetuStore) {
    private val lock = ReentrantLock()

    fun upsert(message: SetuMessage): Boolean = lock.withLock {
        val encoded = MessageRecordCodec.encodeMessage(message)
        try {
            store.write(MESSAGE_DOMAIN, messageKey(message.messageId), encoded)
            true
        } finally {
            encoded.fill(0)
        }
    }

    fun get(messageId: String): SetuMessage? = lock.withLock { readMessage(messageId) }

    fun getByConversation(conversationId: String, limit: Int = 50): List<SetuMessage> = lock.withLock {
        boundedMessages().asSequence()
            .filter { it.conversationId == conversationId }
            .sortedByDescending { it.timestamp }
            .take(limit.coerceIn(0, MAX_RESULTS))
            .toList()
    }

    fun getByState(state: String): List<SetuMessage> = lock.withLock {
        boundedMessages().filter { it.state == state }
    }

    fun getPendingMessages(): List<SetuMessage> =
        getByState("QUEUED") + getByState("SENDING") + getByState("SENT")

    fun getExpired(now: Long): List<SetuMessage> = lock.withLock {
        boundedMessages().filter { it.expiresAt < now && it.state != "EXPIRED" }
    }

    fun pruneRetention(policy: String, now: Long = System.currentTimeMillis()): Int = lock.withLock {
        val cutoff = when (policy.uppercase()) {
            "KEEP" -> return@withLock 0
            "7D" -> now - 7L * 24 * 60 * 60 * 1000
            "30D" -> now - 30L * 24 * 60 * 60 * 1000
            else -> throw IllegalArgumentException("RETENTION_POLICY_INVALID")
        }
        val removable = boundedMessages().filter {
            it.timestamp < cutoff && it.state !in setOf("QUEUED", "SENDING")
        }
        removable.forEach { store.delete(MESSAGE_DOMAIN, messageKey(it.messageId)) }
        removable.size
    }

    fun updateState(messageId: String, state: String, errorMessage: String? = null): Boolean = lock.withLock {
        val current = readMessage(messageId) ?: return false
        upsert(current.copy(state = state, timestamp = System.currentTimeMillis()))
    }

    fun markAsRead(messageId: String): Boolean = lock.withLock {
        val current = readMessage(messageId) ?: return false
        upsert(current.copy(isRead = true))
    }

    fun delete(messageId: String): Boolean = lock.withLock {
        if (readMessage(messageId) == null) return false
        store.delete(MESSAGE_DOMAIN, messageKey(messageId))
        true
    }

    fun getConversations(userId: String): List<Conversation> = lock.withLock {
        allConversations().filter { userId in it.participants }
            .sortedByDescending { it.lastMessageAt }.take(MAX_RESULTS)
    }

    fun getConversation(conversationId: String): Conversation? = lock.withLock {
        readConversation(conversationId)
    }

    fun upsertConversation(conversation: Conversation): Boolean = lock.withLock {
        val encoded = MessageRecordCodec.encodeConversation(conversation)
        try {
            store.write(MESSAGE_DOMAIN, conversationKey(conversation.conversationId), encoded)
            true
        } finally {
            encoded.fill(0)
        }
    }

    fun getUnreadCount(conversationId: String, userId: String): Int = lock.withLock {
        boundedMessages().count {
            it.conversationId == conversationId && it.recipientId == userId && !it.isRead
        }
    }

    fun getTotalUnreadCount(userId: String): Int = lock.withLock {
        boundedMessages().count { it.recipientId == userId && !it.isRead }
    }

    fun getRecentConversations(userId: String, limit: Int = 20): List<Conversation> =
        getConversations(userId).take(limit.coerceIn(0, MAX_RESULTS))

    fun getMessageCountByConversation(conversationId: String): Int = lock.withLock {
        boundedMessages().count { it.conversationId == conversationId }
    }

    fun deleteConversationMessages(conversationId: String): Boolean = lock.withLock {
        val matching = boundedMessages().filter { it.conversationId == conversationId }
        matching.forEach { store.delete(MESSAGE_DOMAIN, messageKey(it.messageId)) }
        matching.isNotEmpty()
    }

    fun deleteConversation(conversationId: String): Boolean = lock.withLock {
        val messagesDeleted = deleteConversationMessages(conversationId)
        val conversationDeleted = readConversation(conversationId) != null
        if (conversationDeleted) store.delete(MESSAGE_DOMAIN, conversationKey(conversationId))
        messagesDeleted || conversationDeleted
    }

    fun searchMessages(query: String, userId: String, limit: Int = 20): List<SetuMessage> = lock.withLock {
        boundedMessages().filter {
            (it.senderId == userId || it.recipientId == userId) && it.content.contains(query, ignoreCase = true)
        }.sortedByDescending { it.timestamp }.take(limit.coerceIn(0, MAX_RESULTS))
    }

    fun getStats(): Map<String, Any> = lock.withLock {
        val messages = boundedMessages()
        mapOf(
            "total_messages" to messages.size,
            "total_conversations" to allConversations().size,
            "unread_messages" to messages.count { !it.isRead }
        )
    }

    private fun boundedMessages(): List<SetuMessage> =
        store.ids(MESSAGE_DOMAIN).asSequence()
            .filter { it.startsWith(MESSAGE_PREFIX) }
            .take(MAX_RESULTS)
            .mapNotNull { readMessage(it.removePrefix(MESSAGE_PREFIX)) }
            .toList()

    private fun allConversations(): List<Conversation> =
        store.ids(MESSAGE_DOMAIN).asSequence()
            .filter { it.startsWith(CONVERSATION_PREFIX) }
            .take(MAX_RESULTS)
            .mapNotNull { readConversation(it.removePrefix(CONVERSATION_PREFIX)) }
            .toList()

    private fun readMessage(messageId: String): SetuMessage? {
        val encoded = store.read(MESSAGE_DOMAIN, messageKey(messageId)) ?: return null
        return try {
            MessageRecordCodec.decodeMessage(encoded)
        } finally {
            encoded.fill(0)
        }
    }

    private fun readConversation(conversationId: String): Conversation? {
        val encoded = store.read(MESSAGE_DOMAIN, conversationKey(conversationId)) ?: return null
        return try {
            MessageRecordCodec.decodeConversation(encoded)
        } finally {
            encoded.fill(0)
        }
    }

    companion object {
        private const val MESSAGE_DOMAIN = "messages"
        private const val MESSAGE_PREFIX = "message:"
        private const val CONVERSATION_PREFIX = "conversation:"
        private const val MAX_RESULTS = 1000

        fun create(context: Context): MessageRepository {
            val store = SetuStore.getInstance(context)
            MessageStoreMigration.migrate(context, store)
            return MessageRepository(store)
        }

        private fun messageKey(messageId: String) = MESSAGE_PREFIX + messageId
        private fun conversationKey(conversationId: String) = CONVERSATION_PREFIX + conversationId
    }
}
