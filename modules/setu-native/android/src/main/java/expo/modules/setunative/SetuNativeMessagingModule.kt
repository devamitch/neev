package expo.modules.setunative

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.messaging.Conversation
import expo.modules.setunative.messaging.GroupService
import expo.modules.setunative.bootstrap.SetuRuntime
import expo.modules.setunative.messaging.MessageService
import expo.modules.setunative.messaging.MessagingEvents
import expo.modules.setunative.notifications.SetuNotificationPreferences
import expo.modules.setunative.messaging.SetuMessage
import expo.modules.setunative.persistence.MessageRepository
import expo.modules.setunative.shared.SetuEvents

/**
 * Bridge module for Setu messaging, groups, emergency broadcasts.
 * Thin shim: all heavy logic stays in MessageService.
 */
class SetuNativeMessagingModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("SetuNativeMessaging")
        Events(
            "onMessageReceived", "onMessageDelivered", "onMessageRead", "onMessageFailed",
            "onConversationCreated", "onEmergencyReceived", "onGroupUpdated"
        )

        OnCreate { SetuEvents.attach(SetuEvents.MESSAGING, this@SetuNativeMessagingModule) }

        OnDestroy { SetuEvents.detach(SetuEvents.MESSAGING, this@SetuNativeMessagingModule) }

        // ── Messaging ─────────────────────────────────────────────────────────

        AsyncFunction("sendMessage") { conversationId: String, recipientId: String, text: String ->
            svc().sendTextMessage(conversationId, recipientId, text)
        }

        AsyncFunction("sendMessageWithAttachments") {
            conversationId: String, recipientId: String, text: String, contentIds: List<String> ->
            svc().sendMessageWithAttachments(conversationId, recipientId, text, contentIds)
        }

        AsyncFunction("getConversations") { userId: String ->
            svc().getConversations(userId).map { c ->
                mapOf(
                    "conversationId" to c.conversationId,
                    "participants" to c.participants.toList(),
                    "createdAt" to c.createdAt,
                    "lastMessageAt" to c.lastMessageAt,
                    "lastMessageContent" to (c.lastMessageContent ?: ""),
                    "isGroup" to c.isGroup,
                    "name" to (c.name ?: "")
                )
            }
        }

        AsyncFunction("getConversationMessages") { conversationId: String, limit: Int ->
            svc().getConversationMessages(conversationId, limit).map { m -> messageToMap(m) }
        }

        AsyncFunction("markMessageRead") { messageId: String ->
            svc().markAsRead(messageId)
        }

        AsyncFunction("getMessageStats") {
            svc().getStats()
        }

        AsyncFunction("pruneMessageRetention") { policy: String ->
            svc().pruneRetention(policy)
        }

        // Settings contract: setMessageRetentionPolicy(policy: KEEP|7D|30D) persists and prunes;
        // notification preview getters/setters persist the native lock-screen disclosure preference.
        Function("getMessageRetentionPolicy") { svc().getRetentionPolicy() }
        AsyncFunction("setMessageRetentionPolicy") { policy: String ->
            svc().setRetentionPolicy(policy)
        }
        Function("getNotificationPreviewsEnabled") {
            SetuNotificationPreferences.arePreviewsEnabled(getContext())
        }
        AsyncFunction("setNotificationPreviewsEnabled") { enabled: Boolean ->
            SetuNotificationPreferences.setPreviewsEnabled(getContext(), enabled)
        }

        AsyncFunction("createGroup") { groupId: String, ownerId: String, name: String, members: List<String> ->
            groupToMap(GroupService(getContext()).create(groupId, ownerId, name, members))
        }

        AsyncFunction("updateGroupMembers") { groupId: String, actorId: String, members: List<String> ->
            val group = GroupService(getContext()).updateMembers(groupId, actorId, members)
            sendEvent("onGroupUpdated", groupToMap(group))
            groupToMap(group)
        }

        AsyncFunction("getGroupEpoch") { groupId: String ->
            GroupService(getContext()).epoch(groupId)
        }

        // ── Emergency ─────────────────────────────────────────────────────────

        AsyncFunction("sendEmergencyBroadcast") { content: String, category: String, ttlMs: Long, hopLimit: Int ->
            svc().sendEmergencyBroadcast(content, category, ttlMs, hopLimit)
        }

    }

    private fun getContext(): Context =
        appContext.reactContext?.applicationContext
            ?: throw IllegalStateException("React context unavailable")

    private fun svc(): MessageService = SetuRuntime.messages(getContext())

    private fun groupToMap(group: Conversation): Map<String, Any> = mapOf(
        "conversationId" to group.conversationId,
        "participants" to group.participants.toList(),
        "isGroup" to group.isGroup,
        "name" to (group.name ?: ""),
        "ownerId" to (group.ownerId ?: "")
    )

    private fun messageToMap(m: SetuMessage): Map<String, Any> = MessagingEvents.messageToMap(m)

}
