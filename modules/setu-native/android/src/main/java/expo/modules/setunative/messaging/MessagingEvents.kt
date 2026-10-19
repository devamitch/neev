package expo.modules.setunative.messaging

import expo.modules.setunative.shared.SetuEvents

/** Maps message-service callbacks to JS events, independent of any module instance. */
internal object MessagingEvents {
    fun messageToMap(m: SetuMessage): Map<String, Any> = mapOf(
        "messageId" to m.messageId,
        "conversationId" to m.conversationId,
        "senderId" to m.senderId,
        "recipientId" to m.recipientId,
        "content" to m.content,
        "type" to m.type,
        "state" to m.state,
        "timestamp" to m.timestamp,
        "isRead" to m.isRead,
        "hopCount" to m.hopCount,
        "expiresAt" to m.expiresAt,
        "attachmentIds" to (m.attachmentIds ?: emptyList<String>()),
    )

    fun listener() = object : MessageService.MessageListener {
        private fun emit(event: String, body: Map<String, Any?>) =
            SetuEvents.emit(SetuEvents.MESSAGING, event, body)

        override fun onMessageReceived(message: SetuMessage) = emit("onMessageReceived", messageToMap(message))

        override fun onMessageSent(messageId: String, conversationId: String) {}

        override fun onMessageDelivered(messageId: String, conversationId: String) =
            emit("onMessageDelivered", mapOf("messageId" to messageId, "conversationId" to conversationId))

        override fun onMessageRead(messageId: String, conversationId: String) =
            emit("onMessageRead", mapOf("messageId" to messageId, "conversationId" to conversationId))

        override fun onMessageFailed(messageId: String, conversationId: String, reason: String) = emit(
            "onMessageFailed",
            mapOf("messageId" to messageId, "conversationId" to conversationId, "reason" to reason),
        )

        override fun onConversationCreated(conversation: Conversation) = emit(
            "onConversationCreated",
            mapOf(
                "conversationId" to conversation.conversationId,
                "isGroup" to conversation.isGroup,
                "name" to (conversation.name ?: ""),
            ),
        )

        override fun onEmergencyReceived(emergency: EmergencyMessage) = emit(
            "onEmergencyReceived",
            mapOf(
                "broadcastId" to emergency.broadcastId,
                "originId" to emergency.originId,
                "content" to emergency.content,
                "category" to emergency.category,
                "createdAt" to emergency.createdAt,
                "expiresAt" to emergency.expiresAt,
            ),
        )
    }
}
