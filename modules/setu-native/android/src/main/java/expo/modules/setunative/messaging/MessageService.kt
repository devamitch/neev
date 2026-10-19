package expo.modules.setunative.messaging

import android.content.Context
import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.notifications.SetuNotificationManager
import expo.modules.setunative.persistence.MessageRepository
import expo.modules.setunative.persistence.PeerRepository
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.network.SetuSwarmProtocol
import expo.modules.setunative.security.CryptoIdentityManager
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Message Service for handling Setu messaging.
 * Supports 1:1 messaging, groups, offline queue, delivery states, and emergency broadcasts.
 */
class MessageService(
    private val context: Context
) {

    companion object {
        private const val TAG = "SETU_MSG_SVC"
        private const val MAX_MESSAGE_SIZE = 1024 * 1024 // 1MB
        private const val MAX_QUEUE_SIZE = 1000
        private const val MAX_HOP_COUNT = 5
        private const val MESSAGE_EXPIRY_HOURS = 72L // 3 days
        private const val EMERGENCY_EXPIRY_HOURS = 24L // 24 hours
        private const val MESSAGE_EXPIRY_MS = MESSAGE_EXPIRY_HOURS * 60 * 60 * 1000
        private const val EMERGENCY_EXPIRY_MS = EMERGENCY_EXPIRY_HOURS * 60 * 60 * 1000
        private const val MIN_EMERGENCY_TTL_MS = 60 * 1000L
        private const val MAX_EMERGENCY_TTL_MS = EMERGENCY_EXPIRY_MS
        private const val MAX_EMERGENCY_HOP_LIMIT = 5
        private const val RETENTION_PRUNE_INTERVAL_MS = 6L * 60 * 60 * 1000
    }

    private val executor = Executors.newCachedThreadPool()
    private val processorExecutor = Executors.newSingleThreadScheduledExecutor()
    private val messageRepository: MessageRepository by lazy { MessageRepository.create(context) }
    private val isServiceRunning = AtomicBoolean(false)
    private val messageQueue = ConcurrentHashMap<String, MessageQueueItem>()
    private val incomingMessageLock = Any()
    private val incomingEmergencyLock = Any()
    private val activeConversations = ConcurrentHashMap<String, ConversationState>()
    private val deliveryAwaiting = ConcurrentHashMap<String, DeliveryAwaitingInfo>()
    private val rateLimiter = RateLimiter(maxRequests = 5, windowMs = 60_000L)
    private val relayRateLimiter = RateLimiter(maxRequests = 30, windowMs = 60_000L)
    @Volatile private var lastRetentionPruneAt = 0L

    data class MessageQueueItem(
        val messageId: String,
        val conversationId: String,
        val recipientId: String,
        val attachmentIds: List<String> = emptyList(),
        val timestamp: Long = System.currentTimeMillis(),
        val attempts: Int = 0,
        val nextAttemptAt: Long = System.currentTimeMillis()
    )

    data class ConversationState(
        val conversationId: String,
        val participants: Set<String>,
        val lastMessageTime: Long = System.currentTimeMillis(),
        val isActive: Boolean = true
    )

    data class DeliveryAwaitingInfo(
        val messageId: String,
        val conversationId: String,
        val peerId: String,
        val sentAt: Long = System.currentTimeMillis(),
        val ackTimeout: Long = 30000L // 30 seconds
    )

    enum class MessageType {
        TEXT, IMAGE, VIDEO, AUDIO, FILE, EMERGENCY, SYSTEM
    }

    enum class MessageState {
        CREATED, QUEUED, SENDING, SENT, DELIVERED, READ, FAILED, EXPIRED
    }

    interface MessageListener {
        fun onMessageReceived(message: SetuMessage)
        fun onMessageSent(messageId: String, conversationId: String)
        fun onMessageDelivered(messageId: String, conversationId: String)
        fun onMessageRead(messageId: String, conversationId: String)
        fun onMessageFailed(messageId: String, conversationId: String, reason: String)
        fun onConversationCreated(conversation: Conversation)
        fun onEmergencyReceived(emergency: EmergencyMessage)
    }

    private val listeners = mutableListOf<MessageListener>()

    fun addListener(listener: MessageListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: MessageListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    fun start() {
        if (isServiceRunning.compareAndSet(false, true)) {
            Log.i(TAG, "Message service started")
            loadQueuedMessages()
            startMessageProcessor()
        }
    }

    fun stop() {
        if (isServiceRunning.compareAndSet(true, false)) {
            Log.i(TAG, "Message service stopped")
            executor.shutdown()
            processorExecutor.shutdown()
        }
    }

    private fun loadQueuedMessages() {
        executor.execute {
            try {
                val pendingMessages = messageRepository.getPendingMessages()
                for (message in pendingMessages) {
                    queueMessageInternal(message)
                }
                Log.d(TAG, "Loaded ${pendingMessages.size} queued messages")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load queued messages", e)
            }
        }
    }

    private fun startMessageProcessor() {
        processorExecutor.scheduleWithFixedDelay({
            if (isServiceRunning.get()) {
                try {
                    processMessageQueue()
                } catch (e: Exception) {
                    Log.e(TAG, "Message processor error", e)
                }
            }
        }, 0L, 1L, TimeUnit.SECONDS)
    }

    private fun processMessageQueue() {
        val now = System.currentTimeMillis()

        for ((messageId, item) in messageQueue) {
            if (item.nextAttemptAt <= now && rateLimiter.allowSend()) {
                if (sendMessageInternal(item)) {
                    messageQueue.remove(messageId)
                } else {
                    // Update retry timing
                    val newAttempts = item.attempts + 1
                    val delayMs = calculateRetryDelay(newAttempts)
                    messageQueue[messageId] = item.copy(
                        attempts = newAttempts,
                        nextAttemptAt = now + delayMs
                    )
                }
            }
        }

        // Clean up expired messages
        cleanupExpiredMessages()
    }

    private fun calculateRetryDelay(attempts: Int): Long {
        return when {
            attempts <= 3 -> 1000L * attempts // 1, 2, 3 seconds
            attempts <= 6 -> 10000L * (attempts - 2) // 10, 20, 30 seconds
            else -> 60000L * 5 // 5 minutes max
        }
    }

    /**
     * Send a text message
     */
    fun sendTextMessage(
        conversationId: String,
        recipientId: String,
        text: String
    ): String {
        if (text.length > MAX_MESSAGE_SIZE) {
            throw IllegalArgumentException("Message too large")
        }

        val messageId = generateMessageId()
        val message = SetuMessage(
            messageId = messageId,
            conversationId = conversationId,
            senderId = CryptoIdentityManager.getOrCreate().deviceId,
            recipientId = recipientId,
            content = text,
            type = MessageType.TEXT.name,
            state = MessageState.CREATED.name,
            timestamp = System.currentTimeMillis(),
            isEncrypted = false,
            isRead = false,
            hopCount = 0,
            expiresAt = System.currentTimeMillis() + MESSAGE_EXPIRY_MS
        )

        return sendMessage(message)
    }

    /**
     * Send a message with attachments
     */
    fun sendMessageWithAttachments(
        conversationId: String,
        recipientId: String,
        text: String,
        attachmentContentIds: List<String>
    ): String {
        val messageId = generateMessageId()
        val message = SetuMessage(
            messageId = messageId,
            conversationId = conversationId,
            senderId = CryptoIdentityManager.getOrCreate().deviceId,
            recipientId = recipientId,
            content = text,
            type = if (attachmentContentIds.isNotEmpty()) MessageType.FILE.name else MessageType.TEXT.name,
            state = MessageState.CREATED.name,
            timestamp = System.currentTimeMillis(),
            isEncrypted = false,
            isRead = false,
            attachmentIds = attachmentContentIds,
            hopCount = 0,
            expiresAt = System.currentTimeMillis() + MESSAGE_EXPIRY_MS
        )

        return sendMessage(message)
    }

    private fun sendMessage(message: SetuMessage): String {
        // Save to repository
        messageRepository.upsert(message)

        // Queue for sending
        queueMessageInternal(message)

        return message.messageId
    }

    private fun queueMessageInternal(message: SetuMessage) {
        if (messageQueue.size >= MAX_QUEUE_SIZE) {
            // Remove oldest messages if queue is full
            val oldest = messageQueue.entries.minByOrNull { it.value.timestamp }
            oldest?.let { messageQueue.remove(it.key) }
        }

        val queueItem = MessageQueueItem(
            messageId = message.messageId,
            conversationId = message.conversationId,
            recipientId = message.recipientId,
            attachmentIds = message.attachmentIds ?: emptyList(),
            timestamp = message.timestamp,
            attempts = 0,
            nextAttemptAt = System.currentTimeMillis()
        )

        messageQueue[message.messageId] = queueItem

        // Update message state
        messageRepository.updateState(message.messageId, MessageState.QUEUED.name)
    }

    private fun sendMessageInternal(item: MessageQueueItem): Boolean {
        try {
            // Check if we have an active session with the recipient
            val session = getSessionForPeer(item.recipientId)
            if (session == null) {
                Log.d(TAG, "No active session for ${item.recipientId}, deferring message")
                return false
            }

            // Build message payload
            val message = messageRepository.get(item.messageId) ?: error("MESSAGE_NOT_FOUND")
            val payload = buildMessagePayload(item, message)

            // Send via transport
            SetuPeerTransport.sendFrame(session, SetuSwarmProtocol.FRAME_MESSAGE, payload)

            // Update message state
            messageRepository.updateState(item.messageId, MessageState.SENT.name)

            // Start delivery tracking
            startDeliveryTracking(item.messageId, item.conversationId, item.recipientId)

            // Notify listeners
            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onMessageSent(item.messageId, item.conversationId)
                }
            }

            Log.d(TAG, "Message sent: ${item.messageId} to ${item.recipientId}")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message: ${item.messageId}", e)
            messageRepository.updateState(item.messageId, MessageState.QUEUED.name)
            return false
        }
    }

    private fun getSessionForPeer(peerId: String): String? {
        return SetuPeerTransport.sessionIdForPeer(peerId)
    }

    private fun buildMessagePayload(item: MessageQueueItem, message: SetuMessage): ByteArray {
        // Build a simple message payload
        val builder = StringBuilder()
        builder.append("MSG:${item.messageId}")
        builder.append("|CNV:${item.conversationId}")
        builder.append("|TO:${item.recipientId}")
        builder.append("|TYP:TEXT")
        builder.append("|TIME:${item.timestamp}")
        builder.append("|CONTENT:${message.content}")

        if (item.attachmentIds.isNotEmpty()) {
            builder.append("|ATTS:${item.attachmentIds.joinToString(",")}")
        }

        return builder.toString().toByteArray()
    }

    /**
     * Handle incoming message from peer
     */
    fun handleIncomingMessage(sessionId: String, peerId: String, payload: ByteArray) {
        val emergency = EmergencyMessageCodec.decode(payload)
        if (emergency != null) {
            executor.execute { processIncomingEmergency(sessionId, peerId, emergency) }
            return
        }
        executor.execute {
            try {
                val message = parseMessagePayload(peerId, payload)
                if (message != null) {
                    processIncomingMessage(message)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle incoming message from $peerId", e)
            }
        }
    }

    private fun parseMessagePayload(peerId: String, payload: ByteArray): SetuMessage? {
        try {
            val content = String(payload)
            val parts = content.split("|")

            var messageId: String? = null
            var conversationId: String? = null
            var messageType: String = "TEXT"
            var messageContent: String = ""
            var attachmentIds: List<String> = emptyList()
            var timestamp: Long = System.currentTimeMillis()
            var isEmergency = false

            for (part in parts) {
                when {
                    part.startsWith("MSG:") -> messageId = part.substring(4)
                    part.startsWith("CNV:") -> conversationId = part.substring(4)
                    part.startsWith("TYP:") -> messageType = part.substring(4)
                    part.startsWith("TIME:") -> timestamp = part.substring(5).toLongOrNull() ?: System.currentTimeMillis()
                    part.startsWith("CONTENT:") -> messageContent = part.substring(8)
                    part.startsWith("ATTS:") -> attachmentIds = part.substring(5).split(",")
                    part.contains("EMERGENCY") -> isEmergency = true
                }
            }

            if (messageId == null || conversationId == null) return null

            // Create conversation if it doesn't exist
            ensureConversationExists(conversationId, peerId)

            val message = SetuMessage(
                messageId = messageId,
                conversationId = conversationId,
                senderId = peerId,
                recipientId = "", // Will be set to current user
                content = messageContent,
                type = messageType,
                state = MessageState.DELIVERED.name,
                timestamp = timestamp,
                isEncrypted = false,
                isRead = false,
                attachmentIds = attachmentIds,
                hopCount = if (isEmergency) 0 else 1, // Emergency messages have 0 hop count initially
                expiresAt = System.currentTimeMillis() + if (isEmergency) EMERGENCY_EXPIRY_MS else MESSAGE_EXPIRY_MS
            )

            return message

        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse message payload", e)
            return null
        }
    }

    private fun ensureConversationExists(conversationId: String, peerId: String) {
        if (!activeConversations.containsKey(conversationId)) {
            val conversation = Conversation(
                conversationId = conversationId,
                participants = setOf(peerId), // Add current user later
                createdAt = System.currentTimeMillis(),
                lastMessageAt = System.currentTimeMillis(),
                isGroup = false
            )

            activeConversations[conversationId] = ConversationState(
                conversationId = conversationId,
                participants = conversation.participants
            )

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onConversationCreated(conversation)
                }
            }
        }
    }

    private fun updateConversationState(conversationId: String, peerId: String) {
        activeConversations.compute(conversationId) { _, current ->
            val state = current ?: ConversationState(conversationId, emptySet())
            state.copy(
                participants = state.participants + peerId,
                lastMessageTime = System.currentTimeMillis(),
                isActive = true,
            )
        }
    }

    private fun processIncomingMessage(message: SetuMessage) {
        val existing = synchronized(incomingMessageLock) {
            val stored = messageRepository.get(message.messageId)
            if (stored == null) messageRepository.upsert(message)
            stored
        }
        if (existing != null) {
            if (existing.senderId == message.senderId && existing.conversationId == message.conversationId) {
                sendDeliveryAcknowledgment(
                    message.messageId,
                    message.conversationId,
                    message.senderId,
                    markDelivered = false
                )
            } else {
                Log.w(TAG, "Conflicting duplicate message ID: ${message.messageId}")
            }
            return
        }

        // Update conversation state
        updateConversationState(message.conversationId, message.senderId)

        // Check if this is an emergency message
        if (message.type == MessageType.EMERGENCY.name) {
            val emergency = EmergencyMessage(
                broadcastId = message.messageId,
                originId = message.senderId,
                content = message.content,
                createdAt = message.timestamp,
                expiresAt = message.expiresAt,
                hopLimit = MAX_HOP_COUNT,
                category = "GENERAL"
            )
            runCatching { SetuNotificationManager.showEmergency(context, emergency) }

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onEmergencyReceived(emergency)
                }
            }

            // Handle emergency propagation
            if (message.hopCount < MAX_HOP_COUNT) {
                propagateEmergency(message)
            }

            return
        }

        // Send delivery acknowledgment
        sendDeliveryAcknowledgment(message.messageId, message.conversationId, message.senderId)
        runCatching {
            // The sender's own display name, not their id: a message notification saying only
            // "a1b2c3d4" is unreadable, and nothing here had ever looked the name up.
            val senderName = PeerRepository.create(context).get(message.senderId)?.displayName
            SetuNotificationManager.showMessage(
                context,
                message.conversationId,
                message.senderId,
                message.content,
                message.timestamp,
                senderName
            )
        }

        // Notify listeners
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onMessageReceived(message)
            }
        }

        Log.d(TAG, "Message received: ${message.messageId} from ${message.senderId}")
    }

    private fun sendDeliveryAcknowledgment(
        messageId: String,
        conversationId: String,
        peerId: String,
        markDelivered: Boolean = true
    ) {
        try {
            val ackPayload = "ACK:$messageId|CNV:$conversationId".toByteArray()
            val session = getSessionForPeer(peerId) ?: return

            SetuPeerTransport.sendFrame(session, SetuSwarmProtocol.FRAME_ACK, ackPayload)

            if (markDelivered) {
                messageRepository.updateState(messageId, MessageState.DELIVERED.name)
                synchronized(listeners) {
                    for (listener in listeners) {
                        listener.onMessageDelivered(messageId, conversationId)
                    }
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to send delivery acknowledgment for $messageId", e)
        }
    }

    fun handleDeliveryAcknowledgment(sessionId: String, peerId: String, payload: ByteArray): Boolean {
        if (!SetuPeerTransport.isSessionAuthorized(sessionId) ||
            SetuPeerTransport.peerIdForSession(sessionId) != peerId) return false

        val fields = payload.toString(Charsets.UTF_8).split('|')
        val messageId = fields.firstOrNull { it.startsWith("ACK:") }?.removePrefix("ACK:") ?: return false
        val conversationId = fields.firstOrNull { it.startsWith("CNV:") }?.removePrefix("CNV:") ?: return false
        val awaiting = deliveryAwaiting[messageId] ?: return false
        if (awaiting.peerId != peerId || awaiting.conversationId != conversationId ||
            !deliveryAwaiting.remove(messageId, awaiting)) return false

        messageRepository.updateState(messageId, MessageState.DELIVERED.name)
        synchronized(listeners) {
            listeners.forEach { it.onMessageDelivered(messageId, conversationId) }
        }
        return true
    }

    private fun startDeliveryTracking(messageId: String, conversationId: String, peerId: String) {
        val now = System.currentTimeMillis()
        val awaitingInfo = DeliveryAwaitingInfo(
            messageId = messageId,
            conversationId = conversationId,
            peerId = peerId,
            sentAt = now,
            ackTimeout = 30000L // 30 seconds
        )

        deliveryAwaiting[messageId] = awaitingInfo

        // The ack deadline is scheduled, never slept through: one waiting message must not hold a
        // pool thread for 30 s. handleDeliveryAcknowledgment removes the entry when the ack lands.
        processorExecutor.schedule({
            if (deliveryAwaiting.remove(messageId, awaitingInfo)) {
                messageRepository.get(messageId)?.let(::queueMessageInternal)
            }
        }, awaitingInfo.ackTimeout, TimeUnit.MILLISECONDS)
    }

    /**
     * Propagate emergency message to other peers
     */
    private fun propagateEmergency(message: SetuMessage) {
        if (message.hopCount >= MAX_HOP_COUNT) return

        executor.execute {
            try {
                // Get connected peers (excluding the sender)
                val connectedPeers = getConnectedPeers().filter { it != message.senderId }

                for (peerId in connectedPeers) {
                    val session = getSessionForPeer(peerId) ?: continue

                    // Increment hop count
                    val newHopCount = message.hopCount + 1

                    // Rebuild message payload with new hop count
                    val emergencyPayload = buildEmergencyPayload(message, newHopCount)

                    // Send to peer
                    SetuPeerTransport.sendFrame(
                        session,
                        SetuSwarmProtocol.FRAME_EMERGENCY_MESSAGE,
                        emergencyPayload
                    )
                }

                Log.d(TAG, "Emergency propagated to ${connectedPeers.size} peers")

            } catch (e: Exception) {
                Log.e(TAG, "Failed to propagate emergency", e)
            }
        }
    }

    private fun buildEmergencyPayload(message: SetuMessage, hopCount: Int): ByteArray {
        return EmergencyMessageCodec.encode(
            EmergencyMessage(
                broadcastId = message.messageId,
                originId = message.senderId,
                content = message.content,
                createdAt = message.timestamp,
                expiresAt = message.expiresAt,
                hopLimit = MAX_HOP_COUNT,
                hopCount = hopCount
            )
        )
    }

    private fun processIncomingEmergency(sessionId: String, peerId: String, emergency: EmergencyMessage) {
        val localId = CryptoIdentityManager.getOrCreate().deviceId
        val conversationId = "emergency_${emergency.broadcastId}"
        val inserted = synchronized(incomingEmergencyLock) {
            if (!SetuPeerTransport.isSessionAuthorized(sessionId) ||
                SetuPeerTransport.peerIdForSession(sessionId) != peerId ||
                emergency.expiresAt <= System.currentTimeMillis() ||
                messageRepository.get(emergency.broadcastId) != null
            ) return@synchronized false

            messageRepository.upsertConversation(
                Conversation(conversationId, setOf(emergency.originId, localId),
                    createdAt = emergency.createdAt, lastMessageAt = emergency.createdAt,
                    lastMessageContent = emergency.content, isGroup = true, name = "Emergency")
            )
            messageRepository.upsert(
                SetuMessage(
                    messageId = emergency.broadcastId,
                    conversationId = conversationId,
                    senderId = emergency.originId,
                    recipientId = localId,
                    content = emergency.content,
                    type = MessageType.EMERGENCY.name,
                    state = MessageState.DELIVERED.name,
                    timestamp = emergency.createdAt,
                    isEncrypted = false,
                    hopCount = emergency.hopCount,
                    expiresAt = emergency.expiresAt,
                )
            )
        }
        if (!inserted) return

        val received = emergency.copy(originId = emergency.originId)
        synchronized(listeners) {
            listeners.forEach { it.onEmergencyReceived(received) }
        }

        if (emergency.hopCount >= emergency.hopLimit) return
        val relayPayload = EmergencyMessageCodec.encode(emergency.copy(hopCount = emergency.hopCount + 1))
        for (targetSessionId in SetuPeerTransport.authorizedSessionIds()) {
            val targetPeerId = SetuPeerTransport.peerIdForSession(targetSessionId) ?: continue
            if (targetSessionId == sessionId || targetPeerId == emergency.originId || targetPeerId == localId) continue
            if (emergency.expiresAt <= System.currentTimeMillis() || !relayRateLimiter.allowSend()) break
            try {
                SetuPeerTransport.sendFrame(targetSessionId, SetuSwarmProtocol.FRAME_EMERGENCY_MESSAGE, relayPayload)
            } catch (error: Exception) {
                Log.w(TAG, "Emergency relay failed for $targetPeerId", error)
            }
        }
    }

    /**
     * Send emergency broadcast
     */
    fun sendEmergencyBroadcast(
        content: String,
        category: String = "GENERAL",
        ttlMs: Long = EMERGENCY_EXPIRY_MS,
        hopLimit: Int = MAX_EMERGENCY_HOP_LIMIT,
    ): String {
        require(content.isNotBlank() && content.length <= 8 * 1024 &&
            content.toByteArray(Charsets.UTF_8).size <= 8 * 1024) { "EMERGENCY_CONTENT_INVALID" }
        require(category in setOf("SAFETY", "MEDICAL", "FIRE", "FLOOD", "GENERAL")) { "EMERGENCY_CATEGORY_INVALID" }
        require(ttlMs in MIN_EMERGENCY_TTL_MS..MAX_EMERGENCY_TTL_MS) { "EMERGENCY_TTL_INVALID" }
        require(hopLimit in 1..MAX_EMERGENCY_HOP_LIMIT) { "EMERGENCY_HOPS_INVALID" }
        if (!rateLimiter.allowSend()) throw IllegalStateException("EMERGENCY_RATE_LIMITED")
        val messageId = generateMessageId()
        val originId = CryptoIdentityManager.getOrCreate().deviceId
        val now = System.currentTimeMillis()
        val emergency = EmergencyMessage(
            broadcastId = messageId,
            originId = originId,
            content = content,
            createdAt = now,
            expiresAt = now + ttlMs,
            hopLimit = hopLimit,
            category = category
        )
        val conversationId = "emergency_$messageId"
        messageRepository.upsertConversation(
            Conversation(conversationId, setOf(originId), now, now, content, true, "Emergency")
        )
        check(messageRepository.upsert(
            SetuMessage(messageId, conversationId, originId, "*", content,
                MessageType.EMERGENCY.name, MessageState.CREATED.name, now,
                isEncrypted = false, hopCount = 0, expiresAt = emergency.expiresAt)
        )) { "EMERGENCY_PERSIST_FAILED" }

        val payload = EmergencyMessageCodec.encode(emergency)
        var sentCount = 0
        for (sessionId in SetuPeerTransport.authorizedSessionIds()) {
            val peerId = SetuPeerTransport.peerIdForSession(sessionId) ?: continue
            if (peerId == originId) continue
            try {
                SetuPeerTransport.sendFrame(sessionId, SetuSwarmProtocol.FRAME_EMERGENCY_MESSAGE, payload)
                sentCount++
            } catch (error: Exception) {
                Log.w(TAG, "Emergency send failed for $peerId", error)
            }
        }
        messageRepository.updateState(
            messageId,
            if (sentCount > 0) MessageState.SENT.name else MessageState.FAILED.name,
            if (sentCount > 0) null else "NO_AUTHORIZED_PEERS"
        )
        Log.i(TAG, "Emergency payload written to $sentCount authorized sessions")
        return messageId
    }

    private fun getConnectedPeers(): List<String> {
        return SetuPeerTransport.authorizedSessionIds()
            .mapNotNull(SetuPeerTransport::peerIdForSession)
            .distinct()
    }

    /**
     * Mark message as read
     */
    fun markAsRead(messageId: String): Boolean {
        return try {
            val message = messageRepository.get(messageId) ?: return false
            messageRepository.updateState(messageId, MessageState.READ.name)

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onMessageRead(messageId, message.conversationId)
                }
            }

            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to mark message as read", e)
            false
        }
    }

    /**
     * Get conversation messages
     */
    fun getConversationMessages(conversationId: String, limit: Int = 50): List<SetuMessage> {
        return messageRepository.getByConversation(conversationId, limit)
    }

    /**
     * Get all conversations for a user
     */
    fun getConversations(userId: String): List<Conversation> {
        return messageRepository.getConversations(userId)
    }

    fun pruneRetention(policy: String): Int = messageRepository.pruneRetention(policy)

    fun getRetentionPolicy(): String = context
        .getSharedPreferences("setu_message_settings", Context.MODE_PRIVATE)
        .getString("retention_policy", "KEEP") ?: "KEEP"

    fun setRetentionPolicy(policy: String): Int {
        val normalized = policy.uppercase()
        require(normalized in setOf("KEEP", "7D", "30D")) { "RETENTION_POLICY_INVALID" }
        context.getSharedPreferences("setu_message_settings", Context.MODE_PRIVATE)
            .edit()
            .putString("retention_policy", normalized)
            .apply()
        lastRetentionPruneAt = System.currentTimeMillis()
        return messageRepository.pruneRetention(normalized)
    }

    /**
     * Clean up expired messages
     */
    private fun cleanupExpiredMessages() {
        executor.execute {
            try {
                val now = System.currentTimeMillis()
                val expiredMessages = messageRepository.getExpired(now)

                for (message in expiredMessages) {
                    messageRepository.updateState(message.messageId, MessageState.EXPIRED.name)

                    // Remove from queue if still there
                    messageQueue.remove(message.messageId)
                    deliveryAwaiting.remove(message.messageId)
                }

                val retentionPolicy = getRetentionPolicy()
                val currentTime = System.currentTimeMillis()
                if (retentionPolicy != "KEEP" && currentTime - lastRetentionPruneAt >= RETENTION_PRUNE_INTERVAL_MS) {
                    messageRepository.pruneRetention(retentionPolicy, currentTime)
                    lastRetentionPruneAt = currentTime
                }

                if (expiredMessages.isNotEmpty()) {
                    Log.d(TAG, "Cleaned up ${expiredMessages.size} expired messages")
                }

            } catch (e: Exception) {
                Log.e(TAG, "Failed to cleanup expired messages", e)
            }
        }
    }

    /**
     * Generate unique message ID
     */
    private fun generateMessageId(): String {
        return "msg_${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
    }

    /**
     * Simple rate limiter for message sending
     */
    private class RateLimiter(private val maxRequests: Int, private val windowMs: Long) {
        private var windowStartedAt = 0L
        private var requestCount = 0

        @Synchronized
        fun allowSend(): Boolean {
            val now = System.currentTimeMillis()

            if (windowStartedAt == 0L || now < windowStartedAt || now - windowStartedAt >= windowMs) {
                requestCount = 0
                windowStartedAt = now
            }
            if (requestCount >= maxRequests) return false
            requestCount++
            return true
        }
    }

    /**
     * Get message statistics
     */
    fun getStats(): Map<String, Any> {
        return mapOf(
            "queue_size" to messageQueue.size,
            "pending_ack" to deliveryAwaiting.size,
            "active_conversations" to activeConversations.size
        )
    }
}

// Data classes for messaging
data class SetuMessage(
    val messageId: String,
    val conversationId: String,
    val senderId: String,
    val recipientId: String,
    val content: String,
    val type: String = "TEXT",
    val state: String = "CREATED",
    val timestamp: Long = System.currentTimeMillis(),
    val isEncrypted: Boolean = false,
    val isRead: Boolean = false,
    val attachmentIds: List<String>? = null,
    val hopCount: Int = 0,
    val expiresAt: Long = System.currentTimeMillis() + (24 * 60 * 60 * 1000) // 24 hours
)

data class Conversation(
    val conversationId: String,
    val participants: Set<String>,
    val createdAt: Long = System.currentTimeMillis(),
    val lastMessageAt: Long = System.currentTimeMillis(),
    val lastMessageContent: String? = null,
    val isGroup: Boolean = false,
    val name: String? = null,
    val ownerId: String? = null,
)

data class EmergencyMessage(
    val broadcastId: String,
    val originId: String,
    val content: String,
    val category: String = "GENERAL",
    val createdAt: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (24 * 60 * 60 * 1000),
    val hopLimit: Int = 5,
    val hopCount: Int = 0
)
