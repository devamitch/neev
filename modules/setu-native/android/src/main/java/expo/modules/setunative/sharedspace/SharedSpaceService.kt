package expo.modules.setunative.sharedspace

import android.content.Context
import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.persistence.SharedSpaceRepository
import expo.modules.setunative.security.CryptoIdentityManager
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Shared Space Service for managing private shared spaces between peers.
 * Handles space creation, invitation, content sharing, and synchronization.
 */
class SharedSpaceService(
    private val context: Context,
    private val sharedSpaceRepository: SharedSpaceRepository,
    private val contentRepository: ContentRepository
) {

    companion object {
        private const val TAG = "SETU_SHARED_SPACE"
        private const val DEFAULT_SPACE_SIZE_LIMIT = 10L * 1024 * 1024 * 1024 // 10GB
        private const val DEFAULT_CONTENT_LIMIT = 10000 // 10k items
        private const val MAX_SPACES_PER_USER = 50
        private const val MAX_OPERATION_FRAME_BYTES = 64 * 1024
        private val OPERATION_ORDER = compareBy<SharedSpaceOperation> { it.version }
            .thenBy { if (it.type == SharedSpaceOperationType.REMOVE_CONTENT) 1 else 0 }
            .thenBy { it.actorId }
            .thenBy { it.operationId }
    }

    private val executor = Executors.newCachedThreadPool()
    private val isServiceRunning = AtomicBoolean(false)
    private val spaceCache = ConcurrentHashMap<String, SharedSpace>()
    private val spaceMemberCache = ConcurrentHashMap<String, Set<String>>()

    interface SharedSpaceListener {
        fun onSpaceCreated(space: SharedSpace)
        fun onSpaceInvitationReceived(spaceId: String, inviterId: String)
        fun onSpaceInvitationAccepted(spaceId: String, memberId: String)
        fun onContentAddedToSpace(spaceId: String, contentId: String)
        fun onContentRemovedFromSpace(spaceId: String, contentId: String)
        fun onSpaceUpdated(space: SharedSpace)
        fun onSpaceSyncProgress(spaceId: String, progress: Int, total: Int)
        fun onSpaceSyncComplete(spaceId: String)
        fun onSpaceOperationFailed(spaceId: String, operation: String, reason: String)
    }

    private val listeners = mutableListOf<SharedSpaceListener>()

    fun addListener(listener: SharedSpaceListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: SharedSpaceListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    fun start() {
        if (isServiceRunning.compareAndSet(false, true)) {
            Log.i(TAG, "Shared space service started")
            loadSharedSpaces()
        }
    }

    fun stop() {
        if (isServiceRunning.compareAndSet(true, false)) {
            Log.i(TAG, "Shared space service stopped")
            executor.shutdown()
        }
    }

    private fun loadSharedSpaces() {
        executor.execute {
            try {
                val spaces = sharedSpaceRepository.getAll()
                for (space in spaces) {
                    spaceCache[space.spaceId] = space
                    spaceMemberCache[space.spaceId] = space.members.toSet()
                }
                replayUnappliedOperations(spaces)
                Log.d(TAG, "Loaded ${spaces.size} shared spaces")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load shared spaces", e)
            }
        }
    }

    private fun replayUnappliedOperations(spaces: List<SharedSpace>) {
        for (space in spaces) {
            val operations = sharedSpaceRepository.getOperations(space.spaceId)
            for (operation in operations.filterNot { it.applied }) {
                if (operation.actorId !in space.members || operation.epochId != space.encryptionKeyId) continue
                val latest = operations
                    .filter { it.contentId == operation.contentId }
                    .maxWithOrNull(OPERATION_ORDER)
                if (latest?.operationId == operation.operationId) {
                    applyOperation(operation)
                } else {
                    sharedSpaceRepository.markOperationApplied(space.spaceId, operation.operationId)
                }
            }
        }
    }

    /**
     * Create a new shared space
     */
    fun createSpace(name: String, ownerId: String, isEncrypted: Boolean = true): SharedSpace? {
        if (!isLocalActor(ownerId)) {
            emitOperationFailed("", "CREATE", "Access denied")
            return null
        }
        if (getSpacesByOwner(ownerId).size >= MAX_SPACES_PER_USER) {
            emitOperationFailed("", "CREATE", "Maximum spaces limit reached")
            return null
        }

        return try {
            val spaceId = generateSpaceId()
            val now = System.currentTimeMillis()

            val space = SharedSpace(
                spaceId = spaceId,
                name = name,
                ownerId = ownerId,
                createdAt = now,
                updatedAt = now,
                members = setOf(ownerId),
                invitedMembers = emptySet(),
                isEncrypted = isEncrypted,
                sizeLimit = DEFAULT_SPACE_SIZE_LIMIT,
                contentLimit = DEFAULT_CONTENT_LIMIT,
                contentCount = 0,
                totalSize = 0L,
                version = 1L,
                encryptionKeyId = if (isEncrypted) generateKeyId() else null,
                isActive = true
            )

            // Save to repository
            sharedSpaceRepository.upsert(space)

            // Update cache
            spaceCache[spaceId] = space
            spaceMemberCache[spaceId] = space.members.toSet()

            emitSpaceCreated(space)

            Log.i(TAG, "Shared space created: $spaceId")
            space

        } catch (e: Exception) {
            Log.e(TAG, "Failed to create shared space", e)
            emitOperationFailed("", "CREATE", "Creation failed: ${e.message}")
            null
        }
    }

    /**
     * Invite a peer to join a shared space
     */
    fun inviteToSpace(spaceId: String, inviterId: String, inviteeId: String): Boolean {
        if (!validateSpaceAccess(spaceId, inviterId, requireOwnership = false)) {
            emitOperationFailed(spaceId, "INVITE", "Access denied")
            return false
        }

        return try {
            val space = sharedSpaceRepository.get(spaceId) ?: run {
                emitOperationFailed(spaceId, "INVITE", "Space not found")
                return false
            }

            // Check if already a member
            if (space.members.contains(inviteeId)) {
                emitOperationFailed(spaceId, "INVITE", "Already a member")
                return false
            }

            // Check if already invited
            if (space.invitedMembers.contains(inviteeId)) {
                emitOperationFailed(spaceId, "INVITE", "Already invited")
                return false
            }

            // Add to invited members
            val updatedSpace = space.copy(
                invitedMembers = space.invitedMembers + inviteeId,
                updatedAt = System.currentTimeMillis(),
                version = space.version + 1
            )

            sharedSpaceRepository.upsert(updatedSpace)
            spaceCache[spaceId] = updatedSpace

            emitInvitationReceived(spaceId, inviterId)

            val sessionId = SetuPeerTransport.sessionIdForPeer(inviteeId)
            if (sessionId != null && SetuPeerTransport.isSessionAuthorized(sessionId)) {
                val payload = JSONObject()
                    .put("kind", "invite")
                    .put("spaceId", updatedSpace.spaceId)
                    .put("name", updatedSpace.name)
                    .put("ownerId", updatedSpace.ownerId)
                    .put("isEncrypted", updatedSpace.isEncrypted)
                    .put("epochId", updatedSpace.encryptionKeyId ?: JSONObject.NULL)
                SetuPeerTransport.sendFrame(sessionId, SetuPeerTransport.FRAME_SHARED_SPACE, payload.toString().toByteArray(Charsets.UTF_8))
            }

            Log.i(TAG, "Invitation sent: $inviteeId to space $spaceId")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to send invitation", e)
            emitOperationFailed(spaceId, "INVITE", "Invitation failed: ${e.message}")
            false
        }
    }

    /**
     * Accept an invitation to join a shared space
     */
    fun acceptInvitation(spaceId: String, memberId: String): Boolean {
        if (!isLocalActor(memberId)) {
            emitOperationFailed(spaceId, "ACCEPT", "Access denied")
            return false
        }
        return try {
            val space = sharedSpaceRepository.get(spaceId) ?: run {
                emitOperationFailed(spaceId, "ACCEPT", "Space not found")
                return false
            }

            // Check if invitation exists
            if (!space.invitedMembers.contains(memberId)) {
                emitOperationFailed(spaceId, "ACCEPT", "No invitation found")
                return false
            }

            // Check if already a member
            if (space.members.contains(memberId)) {
                emitOperationFailed(spaceId, "ACCEPT", "Already a member")
                return false
            }

            // Add to members, remove from invited
            val updatedSpace = space.copy(
                members = space.members + memberId,
                invitedMembers = space.invitedMembers - memberId,
                updatedAt = System.currentTimeMillis(),
                version = space.version + 1,
                encryptionKeyId = if (space.isEncrypted) generateKeyId() else null,
            )

            sharedSpaceRepository.upsert(updatedSpace)
            spaceCache[spaceId] = updatedSpace
            spaceMemberCache[spaceId] = updatedSpace.members.toSet()

            emitInvitationAccepted(spaceId, memberId)

            val sessionId = SetuPeerTransport.sessionIdForPeer(space.ownerId)
            if (sessionId != null && SetuPeerTransport.isSessionAuthorized(sessionId)) {
                val payload = JSONObject().put("kind", "accept_invite")
                    .put("spaceId", spaceId)
                SetuPeerTransport.sendFrame(sessionId, SetuPeerTransport.FRAME_SHARED_SPACE, payload.toString().toByteArray(Charsets.UTF_8))
            }

            Log.i(TAG, "Invitation accepted: $memberId joined space $spaceId")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to accept invitation", e)
            emitOperationFailed(spaceId, "ACCEPT", "Acceptance failed: ${e.message}")
            false
        }
    }

    /**
     * Add content to a shared space
     */
    fun addContentToSpace(
        spaceId: String,
        contentId: String,
        memberId: String
    ): Boolean {
        if (!validateSpaceAccess(spaceId, memberId)) {
            emitOperationFailed(spaceId, "ADD_CONTENT", "Access denied")
            return false
        }

        return try {
            val content = contentRepository.get(contentId) ?: run {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Content not found")
                return false
            }

            val space = sharedSpaceRepository.get(spaceId) ?: run {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Space not found")
                return false
            }

            // Check limits
            if (space.contentCount >= space.contentLimit) {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Content limit reached")
                return false
            }

            if (space.totalSize + content.size > space.sizeLimit) {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Size limit reached")
                return false
            }

            // Update content to reference the shared space
            val updatedContent = content.copy(
                storageMode = StorageMode.SHARED_SPACE,
                visibility = Visibility.PAIRED,
                metadata = content.metadata + mapOf("shared_space_id" to spaceId)
            )

            val operation = content.toOperation(
                space = space.copy(version = space.version + 1),
                actorId = memberId,
                type = SharedSpaceOperationType.ADD_CONTENT,
            )
            if (!sharedSpaceRepository.saveOperation(operation)) {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Operation could not be saved")
                return false
            }

            if (!contentRepository.upsert(updatedContent)) {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Content reference could not be saved")
                return false
            }

            // Update space
            val updatedSpace = space.copy(
                contentCount = space.contentCount + 1,
                totalSize = space.totalSize + content.size,
                updatedAt = System.currentTimeMillis(),
                version = space.version + 1
            )

            if (!sharedSpaceRepository.upsert(updatedSpace)) {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Space state could not be saved")
                return false
            }
            spaceCache[spaceId] = updatedSpace
            if (!sharedSpaceRepository.markOperationApplied(spaceId, operation.operationId)) {
                emitOperationFailed(spaceId, "ADD_CONTENT", "Operation state could not be saved")
                return false
            }

            emitContentAdded(spaceId, contentId)

            Log.i(TAG, "Content added to space: $contentId to $spaceId")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to add content to space", e)
            emitOperationFailed(spaceId, "ADD_CONTENT", "Add failed: ${e.message}")
            false
        }
    }

    /**
     * Remove content from a shared space
     */
    fun removeContentFromSpace(
        spaceId: String,
        contentId: String,
        memberId: String,
        deleteForBoth: Boolean = false
    ): Boolean {
        if (!validateSpaceAccess(spaceId, memberId)) {
            emitOperationFailed(spaceId, "REMOVE_CONTENT", "Access denied")
            return false
        }

        return try {
            val content = contentRepository.get(contentId) ?: run {
                emitOperationFailed(spaceId, "REMOVE_CONTENT", "Content not found")
                return false
            }

            val space = sharedSpaceRepository.get(spaceId) ?: run {
                emitOperationFailed(spaceId, "REMOVE_CONTENT", "Space not found")
                return false
            }

            val updatedSpace = space.copy(
                contentCount = (space.contentCount - 1).coerceAtLeast(0),
                totalSize = (space.totalSize - content.size).coerceAtLeast(0),
                updatedAt = System.currentTimeMillis(),
                version = space.version + 1,
            )

            val operationId = if (deleteForBoth) generateOperationId() else null
            if (operationId != null) {
                if (!createTombstone(spaceId, contentId, memberId, OperationType.DELETE_FOR_BOTH, operationId, updatedSpace.version)) {
                    emitOperationFailed(spaceId, "REMOVE_CONTENT", "Delete tombstone could not be saved")
                    return false
                }
                if (!sharedSpaceRepository.saveOperation(content.toOperation(
                        space = updatedSpace,
                        actorId = memberId,
                        type = SharedSpaceOperationType.REMOVE_CONTENT,
                        operationId = operationId,
                    ))) {
                    emitOperationFailed(spaceId, "REMOVE_CONTENT", "Operation could not be saved")
                    return false
                }
            }

            if (!sharedSpaceRepository.upsert(updatedSpace)) {
                emitOperationFailed(spaceId, "REMOVE_CONTENT", "Space state could not be saved")
                return false
            }
            spaceCache[spaceId] = updatedSpace

            // Update content
            val updatedContent = content.copy(
                storageMode = StorageMode.SETU_MANAGED,
                visibility = Visibility.PRIVATE,
                metadata = content.metadata - "shared_space_id"
            )

            if (!contentRepository.upsert(updatedContent)) {
                emitOperationFailed(spaceId, "REMOVE_CONTENT", "Content reference could not be saved")
                return false
            }
            if (operationId != null && !sharedSpaceRepository.markOperationApplied(spaceId, operationId)) {
                emitOperationFailed(spaceId, "REMOVE_CONTENT", "Operation state could not be saved")
                return false
            }

            emitContentRemoved(spaceId, contentId)

            Log.i(TAG, "Content removed from space: $contentId from $spaceId")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove content from space", e)
            emitOperationFailed(spaceId, "REMOVE_CONTENT", "Remove failed: ${e.message}")
            false
        }
    }

    /**
     * Rename a shared space
     */
    fun renameSpace(spaceId: String, newName: String, memberId: String): Boolean {
        if (!validateSpaceAccess(spaceId, memberId, requireOwnership = true)) {
            emitOperationFailed(spaceId, "RENAME", "Access denied")
            return false
        }

        return try {
            val space = sharedSpaceRepository.get(spaceId) ?: run {
                emitOperationFailed(spaceId, "RENAME", "Space not found")
                return false
            }

            val updatedSpace = space.copy(
                name = newName,
                updatedAt = System.currentTimeMillis(),
                version = space.version + 1
            )

            sharedSpaceRepository.upsert(updatedSpace)
            spaceCache[spaceId] = updatedSpace

            emitSpaceUpdated(updatedSpace)

            Log.i(TAG, "Space renamed: $spaceId to $newName")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to rename space", e)
            emitOperationFailed(spaceId, "RENAME", "Rename failed: ${e.message}")
            false
        }
    }

    /**
     * Leave a shared space
     */
    fun leaveSpace(spaceId: String, memberId: String): Boolean {
        if (!isLocalActor(memberId)) {
            emitOperationFailed(spaceId, "LEAVE", "Access denied")
            return false
        }
        return try {
            val space = sharedSpaceRepository.get(spaceId) ?: run {
                emitOperationFailed(spaceId, "LEAVE", "Space not found")
                return false
            }

            // Cannot leave if you're the owner (should delete or transfer ownership instead)
            if (space.ownerId == memberId) {
                emitOperationFailed(spaceId, "LEAVE", "Owner cannot leave, delete space instead")
                return false
            }

            // Remove from members
            val updatedSpace = space.copy(
                members = space.members - memberId,
                updatedAt = System.currentTimeMillis(),
                version = space.version + 1,
                encryptionKeyId = if (space.isEncrypted) generateKeyId() else null,
            )

            sharedSpaceRepository.upsert(updatedSpace)
            spaceCache[spaceId] = updatedSpace
            spaceMemberCache[spaceId] = updatedSpace.members.toSet()

            // Update all content owned by this member in the space
            updateContentOnMemberLeave(spaceId, memberId)

            emitSpaceUpdated(updatedSpace)

            Log.i(TAG, "Member left space: $memberId left $spaceId")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to leave space", e)
            emitOperationFailed(spaceId, "LEAVE", "Leave failed: ${e.message}")
            false
        }
    }

    /**
     * Delete a shared space
     */
    fun deleteSpace(spaceId: String, ownerId: String): Boolean {
        if (!validateSpaceAccess(spaceId, ownerId, requireOwnership = true)) {
            emitOperationFailed(spaceId, "DELETE", "Access denied")
            return false
        }

        return try {
            val space = sharedSpaceRepository.get(spaceId) ?: run {
                emitOperationFailed(spaceId, "DELETE", "Space not found")
                return false
            }

            // Mark space as inactive
            val updatedSpace = space.copy(
                isActive = false,
                updatedAt = System.currentTimeMillis(),
                version = space.version + 1
            )

            sharedSpaceRepository.upsert(updatedSpace)

            // Update all content in the space
            val spaceContent = getSpaceContent(spaceId)
            for (content in spaceContent) {
                val updatedContent = content.copy(
                    storageMode = StorageMode.SETU_MANAGED,
                    visibility = Visibility.PRIVATE,
                    metadata = content.metadata - "shared_space_id"
                )
                contentRepository.upsert(updatedContent)
            }

            spaceCache.remove(spaceId)
            spaceMemberCache.remove(spaceId)

            emitSpaceUpdated(updatedSpace)

            Log.i(TAG, "Space deleted: $spaceId")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete space", e)
            emitOperationFailed(spaceId, "DELETE", "Delete failed: ${e.message}")
            false
        }
    }

    /**
     * Synchronize shared space with a peer
     */
    fun syncSpace(spaceId: String, peerId: String): Boolean {
        val space = sharedSpaceRepository.get(spaceId)
        if (space == null) {
            emitOperationFailed(spaceId, "SYNC", "Space not found")
            return false
        }
        if (!space.members.contains(peerId)) {
            emitOperationFailed(spaceId, "SYNC", "Peer is not a member")
            return false
        }
        val sessionId = SetuPeerTransport.sessionIdForPeer(peerId)
        if (sessionId == null || !SetuPeerTransport.isSessionAuthorized(sessionId)) {
            emitOperationFailed(spaceId, "SYNC", "Peer has no authorized session")
            return false
        }
        return runCatching {
            val request = JSONObject()
                .put("kind", "request")
                .put("spaceId", spaceId)
                .put("epochId", space.encryptionKeyId ?: JSONObject.NULL)
                .toString()
                .toByteArray(Charsets.UTF_8)
            SetuPeerTransport.sendFrame(sessionId, SetuPeerTransport.FRAME_SHARED_SPACE, request)
            val pending = sharedSpaceRepository.getUnacknowledgedOperations(spaceId, peerId)
            pending.forEach { sendOperation(sessionId, it) }
            emitSyncProgress(spaceId, pending.size, pending.size)
            true
        }.getOrElse {
            emitOperationFailed(spaceId, "SYNC", "Operation exchange failed")
            false
        }
    }

    fun handleFrame(sessionId: String, peerId: String, payload: ByteArray) {
        if (!SetuPeerTransport.isSessionAuthorized(sessionId) ||
            SetuPeerTransport.peerIdForSession(sessionId) != peerId ||
            payload.size > MAX_OPERATION_FRAME_BYTES
        ) return

        runCatching {
            val packet = JSONObject(payload.toString(Charsets.UTF_8))
            when (packet.getString("kind")) {
                "request" -> handleSyncRequest(sessionId, peerId, packet)
                "operation" -> handleIncomingOperation(sessionId, peerId, packet)
                "ack" -> handleOperationAck(peerId, packet)
                "invite" -> handleIncomingInvite(sessionId, peerId, packet)
                "accept_invite" -> handleIncomingAcceptInvite(sessionId, peerId, packet)
            }
        }.onFailure {
            Log.w(TAG, "Rejected malformed shared-space frame", it)
        }
    }

    private fun handleSyncRequest(sessionId: String, peerId: String, packet: JSONObject) {
        val spaceId = packet.getString("spaceId")
        val space = sharedSpaceRepository.get(spaceId) ?: return
        val epochId = packet.stringOrNull("epochId")
        if (!space.isActive || peerId !in space.members || epochId != space.encryptionKeyId) return
        sharedSpaceRepository.getOperations(spaceId).filter { it.applied }.forEach { sendOperation(sessionId, it) }
    }

    private fun handleIncomingInvite(sessionId: String, peerId: String, packet: JSONObject) {
        val spaceId = packet.getString("spaceId")
        if (sharedSpaceRepository.get(spaceId) != null) return
        
        val localPeerId = CryptoIdentityManager.getOrCreate().deviceId
        val space = SharedSpace(
            spaceId = spaceId,
            name = packet.getString("name"),
            ownerId = packet.getString("ownerId"),
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            members = setOf(packet.getString("ownerId")),
            invitedMembers = setOf(localPeerId),
            isEncrypted = packet.getBoolean("isEncrypted"),
            encryptionKeyId = packet.stringOrNull("epochId")
        )
        sharedSpaceRepository.upsert(space)
        spaceCache[spaceId] = space
        spaceMemberCache[spaceId] = space.members.toSet()
        emitInvitationReceived(spaceId, peerId)
    }

    private fun handleIncomingAcceptInvite(sessionId: String, peerId: String, packet: JSONObject) {
        val spaceId = packet.getString("spaceId")
        val space = sharedSpaceRepository.get(spaceId) ?: return
        if (!space.invitedMembers.contains(peerId)) return
        
        val updatedSpace = space.copy(
            members = space.members + peerId,
            invitedMembers = space.invitedMembers - peerId,
            updatedAt = System.currentTimeMillis(),
            version = space.version + 1
        )
        sharedSpaceRepository.upsert(updatedSpace)
        spaceCache[spaceId] = updatedSpace
        spaceMemberCache[spaceId] = updatedSpace.members.toSet()
    }

    private fun handleIncomingOperation(sessionId: String, peerId: String, packet: JSONObject) {
        val decodedOperation = SharedSpaceOperationCodec.decode(
            packet.getJSONObject("operation").toString().toByteArray(Charsets.UTF_8)
        )
        val operation = decodedOperation.copy(acknowledgedBy = emptySet(), applied = false)
        val space = sharedSpaceRepository.get(operation.spaceId) ?: return
        if (!space.isActive || peerId !in space.members || operation.actorId != peerId ||
            operation.epochId != space.encryptionKeyId || operation.version < 1L || operation.size < 0L
        ) return

        val operations = sharedSpaceRepository.getOperations(operation.spaceId)
        val storedOperation = operations.firstOrNull { it.operationId == operation.operationId }
        if (storedOperation?.applied == true) {
            acknowledgeIncomingOperation(sessionId, operation, space.encryptionKeyId)
            return
        }
        if (storedOperation == null && !sharedSpaceRepository.saveOperation(operation)) return

        if (operation.type == SharedSpaceOperationType.REMOVE_CONTENT &&
            sharedSpaceRepository.getTombstone(operation.operationId) == null &&
            !sharedSpaceRepository.saveTombstone(
                Tombstone(
                    tombstoneId = operation.operationId,
                    spaceId = operation.spaceId,
                    contentId = operation.contentId,
                    creatorId = operation.actorId,
                    operationType = OperationType.DELETE_FOR_BOTH,
                    createdAt = operation.createdAt,
                    version = operation.version,
                )
            )
        ) return

        val previous = operations
            .filter { it.contentId == operation.contentId && it.operationId != operation.operationId }
            .maxWithOrNull(OPERATION_ORDER)
        if (previous == null || OPERATION_ORDER.compare(operation, previous) > 0) {
            if (!applyOperation(operation)) return
        } else if (!sharedSpaceRepository.markOperationApplied(operation.spaceId, operation.operationId)) {
            return
        }

        acknowledgeIncomingOperation(sessionId, operation, space.encryptionKeyId)
    }

    private fun acknowledgeIncomingOperation(sessionId: String, operation: SharedSpaceOperation, epochId: String?) {
        val ack = JSONObject()
            .put("kind", "ack")
            .put("spaceId", operation.spaceId)
            .put("operationId", operation.operationId)
            .put("epochId", epochId ?: JSONObject.NULL)
            .toString()
            .toByteArray(Charsets.UTF_8)
        SetuPeerTransport.sendFrame(sessionId, SetuPeerTransport.FRAME_SHARED_SPACE, ack)
    }

    private fun handleOperationAck(peerId: String, packet: JSONObject) {
        val spaceId = packet.getString("spaceId")
        val space = sharedSpaceRepository.get(spaceId) ?: return
        if (peerId !in space.members || packet.stringOrNull("epochId") != space.encryptionKeyId) return
        sharedSpaceRepository.acknowledgeOperation(spaceId, packet.getString("operationId"), peerId)
    }

    private fun applyOperation(operation: SharedSpaceOperation): Boolean {
        val existing = contentRepository.get(operation.contentId)
        when (operation.type) {
            SharedSpaceOperationType.ADD_CONTENT -> {
                val updated = if (existing != null) {
                    existing.copy(
                        storageMode = StorageMode.SHARED_SPACE,
                        visibility = Visibility.PAIRED,
                        availability = if (existing.sourceUri == null) Availability.PENDING else existing.availability,
                        metadata = existing.metadata + mapOf("shared_space_id" to operation.spaceId),
                    )
                } else {
                    SetuContent(
                        contentId = operation.contentId,
                        type = runCatching { ContentType.valueOf(operation.contentType) }.getOrDefault(ContentType.OTHER),
                        name = operation.name,
                        mimeType = operation.mimeType,
                        size = operation.size,
                        createdAt = operation.contentCreatedAt,
                        modifiedAt = operation.contentModifiedAt,
                        source = ContentSource.SHARED_SPACE,
                        sourceUri = null,
                        storageMode = StorageMode.SHARED_SPACE,
                        encryptionMode = EncryptionMode.NONE,
                        manifestId = operation.manifestId,
                        ownerId = operation.contentOwnerId,
                        visibility = Visibility.PAIRED,
                        availability = Availability.PENDING,
                        state = ContentState.ACTIVE,
                        metadata = mapOf("shared_space_id" to operation.spaceId),
                    )
                }
                if (!contentRepository.upsert(updated)) return false
                emitContentAdded(operation.spaceId, operation.contentId)
            }
            SharedSpaceOperationType.REMOVE_CONTENT -> {
                if (existing != null && !contentRepository.upsert(
                        existing.copy(
                            storageMode = StorageMode.SETU_MANAGED,
                            visibility = Visibility.PRIVATE,
                            metadata = existing.metadata - "shared_space_id",
                        )
                    )) return false
                sharedSpaceRepository.markTombstoneProcessed(operation.operationId)
                emitContentRemoved(operation.spaceId, operation.contentId)
            }
        }
        val space = sharedSpaceRepository.get(operation.spaceId) ?: return false
        val items = contentRepository.getBySharedSpace(operation.spaceId)
        val updatedSpace = space.copy(
            contentCount = items.size,
            totalSize = items.sumOf { it.size },
            updatedAt = maxOf(space.updatedAt, operation.createdAt),
            version = maxOf(space.version, operation.version),
        )
        if (!sharedSpaceRepository.upsert(updatedSpace)) return false
        spaceCache[operation.spaceId] = updatedSpace
        emitSpaceUpdated(updatedSpace)
        return sharedSpaceRepository.markOperationApplied(operation.spaceId, operation.operationId)
    }

    private fun sendOperation(sessionId: String, operation: SharedSpaceOperation) {
        val encoded = SharedSpaceOperationCodec.encode(operation.copy(acknowledgedBy = emptySet(), applied = false))
        try {
            val packet = JSONObject()
                .put("kind", "operation")
                .put("operation", JSONObject(encoded.toString(Charsets.UTF_8)))
                .toString()
                .toByteArray(Charsets.UTF_8)
            SetuPeerTransport.sendFrame(sessionId, SetuPeerTransport.FRAME_SHARED_SPACE, packet)
        } finally {
            encoded.fill(0)
        }
    }

    private fun SetuContent.toOperation(
        space: SharedSpace,
        actorId: String,
        type: SharedSpaceOperationType,
        operationId: String = generateOperationId(),
    ) = SharedSpaceOperation(
        operationId = operationId,
        spaceId = space.spaceId,
        contentId = contentId,
        actorId = actorId,
        type = type,
        version = space.version,
        createdAt = System.currentTimeMillis(),
        epochId = space.encryptionKeyId,
        contentType = this.type.name,
        name = name,
        mimeType = mimeType,
        size = size,
        contentCreatedAt = createdAt,
        contentModifiedAt = modifiedAt,
        contentOwnerId = ownerId,
        manifestId = manifestId,
    )

    /**
     * Handle delete-for-both operation
     */
    fun handleDeleteForBoth(spaceId: String, contentId: String, tombstone: Tombstone): Boolean {
        return try {
            // Verify the tombstone
            val space = sharedSpaceRepository.get(spaceId) ?: return false

            // Check if the tombstone creator is the owner or has permission
            if (!space.members.contains(tombstone.creatorId)) {
                return false
            }

            // Delete the content from all members
            val content = contentRepository.get(contentId) ?: return false

            // Update content state
            val updatedContent = content.copy(
                state = ContentState.DELETED,
                availability = Availability.UNAVAILABLE
            )

            contentRepository.upsert(updatedContent)

            // Remove from space
            val updatedSpace = space.copy(
                contentCount = (space.contentCount - 1).coerceAtLeast(0),
                totalSize = (space.totalSize - content.size).coerceAtLeast(0),
                version = space.version + 1
            )

            sharedSpaceRepository.upsert(updatedSpace)

            emitContentRemoved(spaceId, contentId)

            Log.i(TAG, "Delete-for-both processed: $contentId from $spaceId")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to process delete-for-both", e)
            false
        }
    }

    /**
     * Get shared space by ID
     */
    fun getSpace(spaceId: String): SharedSpace? {
        return spaceCache[spaceId] ?: sharedSpaceRepository.get(spaceId)
    }

    /**
     * Get spaces by owner
     */
    fun getSpacesByOwner(ownerId: String): List<SharedSpace> {
        return sharedSpaceRepository.getByOwner(ownerId)
    }

    /**
     * Get spaces a user is member of
     */
    fun getSpacesByMember(memberId: String): List<SharedSpace> {
        return sharedSpaceRepository.getByMember(memberId)
    }

    /**
     * Get content in a shared space
     */
    fun getSpaceContent(spaceId: String): List<SetuContent> {
        val localId = CryptoIdentityManager.getOrCreate().deviceId
        val space = sharedSpaceRepository.get(spaceId) ?: return emptyList()
        if (localId !in space.members) return emptyList()
        return contentRepository.getBySharedSpace(spaceId)
    }

    /**
     * Get members of a shared space
     */
    fun getSpaceMembers(spaceId: String): Set<String> {
        return spaceMemberCache[spaceId] ?: sharedSpaceRepository.get(spaceId)?.members ?: emptySet()
    }

    /**
     * Check if user is a member of a space
     */
    fun isMemberOfSpace(spaceId: String, userId: String): Boolean {
        return getSpaceMembers(spaceId).contains(userId)
    }

    /**
     * Validate space access
     */
    private fun validateSpaceAccess(spaceId: String, userId: String, requireOwnership: Boolean = false): Boolean {
        if (!isLocalActor(userId)) return false
        val space = spaceCache[spaceId] ?: sharedSpaceRepository.get(spaceId) ?: return false

        if (requireOwnership) {
            return space.ownerId == userId
        }

        return space.members.contains(userId) || space.ownerId == userId
    }

    /**
     * Update content when member leaves space
     */
    private fun updateContentOnMemberLeave(spaceId: String, memberId: String) {
        val spaceContent = getSpaceContent(spaceId)

        for (content in spaceContent.filter { it.ownerId == memberId }) {
            val updatedContent = content.copy(
                storageMode = StorageMode.SETU_MANAGED,
                visibility = Visibility.PRIVATE
            )
            contentRepository.upsert(updatedContent)
        }
    }

    /**
     * Create tombstone for shared space operations
     */
    private fun createTombstone(
        spaceId: String,
        contentId: String,
        creatorId: String,
        operationType: OperationType,
        operationId: String = generateOperationId(),
        version: Long = 1L,
    ): Boolean {
        val tombstone = Tombstone(
            tombstoneId = operationId,
            spaceId = spaceId,
            contentId = contentId,
            creatorId = creatorId,
            operationType = operationType,
            createdAt = System.currentTimeMillis(),
            version = version
        )

        val saved = sharedSpaceRepository.saveTombstone(tombstone)
        if (saved) {
            Log.d(TAG, "Tombstone saved: ${tombstone.tombstoneId} for $operationType")
        }
        return saved
    }

    /**
     * Generate unique space ID
     */
    private fun generateSpaceId(): String {
        return "space_${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
    }

    /**
     * Generate unique key ID
     */
    private fun generateKeyId(): String {
        return "key_${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
    }

    /**
     * Generate unique tombstone ID
     */
    private fun generateOperationId(): String = "op_${java.util.UUID.randomUUID()}"

    private fun isLocalActor(userId: String): Boolean =
        userId == CryptoIdentityManager.getOrCreate().deviceId

    private fun JSONObject.stringOrNull(name: String): String? =
        if (!has(name) || isNull(name)) null else getString(name)

    private fun emitSpaceCreated(space: SharedSpace) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSpaceCreated(space)
            }
        }
    }

    private fun emitInvitationReceived(spaceId: String, inviterId: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSpaceInvitationReceived(spaceId, inviterId)
            }
        }
    }

    private fun emitInvitationAccepted(spaceId: String, memberId: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSpaceInvitationAccepted(spaceId, memberId)
            }
        }
    }

    private fun emitContentAdded(spaceId: String, contentId: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onContentAddedToSpace(spaceId, contentId)
            }
        }
    }

    private fun emitContentRemoved(spaceId: String, contentId: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onContentRemovedFromSpace(spaceId, contentId)
            }
        }
    }

    private fun emitSpaceUpdated(space: SharedSpace) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSpaceUpdated(space)
            }
        }
    }

    private fun emitSyncProgress(spaceId: String, progress: Int, total: Int) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSpaceSyncProgress(spaceId, progress, total)
            }
        }
    }

    private fun emitSyncComplete(spaceId: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSpaceSyncComplete(spaceId)
            }
        }
    }

    private fun emitOperationFailed(spaceId: String, operation: String, reason: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSpaceOperationFailed(spaceId, operation, reason)
            }
        }
    }

    /**
     * Get shared space statistics
     */
    fun getStats(): Map<String, Any> {
        return mapOf(
            "total_spaces" to spaceCache.size,
            "total_members" to spaceMemberCache.values.sumOf { it.size },
            "total_content" to spaceCache.values.sumOf { it.contentCount }
        )
    }
}

// Data classes for shared spaces
data class SharedSpace(
    val spaceId: String,
    val name: String,
    val ownerId: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val members: Set<String> = emptySet(),
    val invitedMembers: Set<String> = emptySet(),
    val isEncrypted: Boolean = true,
    val sizeLimit: Long = 10L * 1024 * 1024 * 1024, // 10GB
    val contentLimit: Int = 10000,
    val contentCount: Int = 0,
    val totalSize: Long = 0L,
    val version: Long = 1L,
    val encryptionKeyId: String? = null,
    val isActive: Boolean = true
)

data class Tombstone(
    val tombstoneId: String,
    val spaceId: String,
    val contentId: String,
    val creatorId: String,
    val operationType: OperationType,
    val createdAt: Long = System.currentTimeMillis(),
    val version: Long = 1L
)

enum class OperationType {
    CREATE,
    INVITE,
    ACCEPT,
    ADD_CONTENT,
    REMOVE_CONTENT,
    RENAME,
    DELETE_FOR_SELF,
    DELETE_FOR_BOTH,
    LEAVE,
    DELETE_SPACE
}


