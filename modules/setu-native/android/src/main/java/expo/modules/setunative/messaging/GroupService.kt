package expo.modules.setunative.messaging

import android.content.Context
import expo.modules.setunative.persistence.MessageRepository
import expo.modules.setunative.persistence.SetuStore
import org.json.JSONObject
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

internal class GroupService(context: Context) {
    private val repository = MessageRepository.create(context)
    private val store = SetuStore.getInstance(context)
    private val lock = ReentrantLock()

    fun create(groupId: String, ownerId: String, name: String, members: List<String>): Conversation = lock.withLock {
        require(groupId.isNotBlank() && ownerId.isNotBlank() && name.isNotBlank()) { "GROUP_ARGUMENT_INVALID" }
        val participants = (members + ownerId).toSet()
        require(participants.size >= 2) { "GROUP_REQUIRES_MEMBERS" }
        val conversation = Conversation(
            conversationId = groupId,
            participants = participants,
            isGroup = true,
            name = name,
            ownerId = ownerId
        )
        repository.upsertConversation(conversation)
        writeEpoch(groupId, 1L)
        conversation
    }

    fun updateMembers(groupId: String, actorId: String, members: List<String>): Conversation = lock.withLock {
        val current = repository.getConversation(groupId) ?: error("GROUP_NOT_FOUND")
        require(current.isGroup && current.ownerId == actorId) { "GROUP_NOT_AUTHORIZED" }
        val participants = members.toSet() + actorId
        require(participants.size >= 2) { "GROUP_REQUIRES_MEMBERS" }
        val updated = current.copy(participants = participants, lastMessageAt = System.currentTimeMillis())
        repository.upsertConversation(updated)
        writeEpoch(groupId, epoch(groupId) + 1L)
        updated
    }

    fun epoch(groupId: String): Long {
        val bytes = store.read(DOMAIN, key(groupId)) ?: return 0L
        return try { JSONObject(bytes.toString(Charsets.UTF_8)).getLong("epoch") } finally { bytes.fill(0) }
    }

    private fun writeEpoch(groupId: String, value: Long) {
        val bytes = JSONObject().put("epoch", value).toString().toByteArray(Charsets.UTF_8)
        try { store.write(DOMAIN, key(groupId), bytes) } finally { bytes.fill(0) }
    }

    private fun key(groupId: String) = PREFIX + groupId

    companion object {
        private const val DOMAIN = "messages"
        private const val PREFIX = "group-epoch:"
    }
}
