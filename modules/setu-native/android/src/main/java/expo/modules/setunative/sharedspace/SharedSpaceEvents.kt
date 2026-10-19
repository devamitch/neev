package expo.modules.setunative.sharedspace

import expo.modules.setunative.shared.SetuEvents

/** Maps shared-space service callbacks to JS events, independent of any module instance. */
internal object SharedSpaceEvents {
    fun spaceToMap(s: SharedSpace): Map<String, Any?> = mapOf(
        "spaceId" to s.spaceId,
        "name" to s.name,
        "ownerId" to s.ownerId,
        "members" to s.members.toList(),
        "invitedMembers" to s.invitedMembers.toList(),
        "isEncrypted" to s.isEncrypted,
        "contentCount" to s.contentCount,
        "totalSize" to s.totalSize,
        "version" to s.version,
        "createdAt" to s.createdAt,
        "updatedAt" to s.updatedAt,
        "isActive" to s.isActive,
    )

    fun listener() = object : SharedSpaceService.SharedSpaceListener {
        private fun emit(event: String, body: Map<String, Any?>) =
            SetuEvents.emit(SetuEvents.SHARED_SPACE, event, body)

        override fun onSpaceCreated(space: SharedSpace) = emit("onSpaceCreated", spaceToMap(space))

        override fun onSpaceInvitationReceived(spaceId: String, inviterId: String) =
            emit("onSpaceInvitationReceived", mapOf("spaceId" to spaceId, "inviterId" to inviterId))

        override fun onSpaceInvitationAccepted(spaceId: String, memberId: String) =
            emit("onSpaceInvitationAccepted", mapOf("spaceId" to spaceId, "memberId" to memberId))

        override fun onContentAddedToSpace(spaceId: String, contentId: String) =
            emit("onContentAddedToSpace", mapOf("spaceId" to spaceId, "contentId" to contentId))

        override fun onContentRemovedFromSpace(spaceId: String, contentId: String) =
            emit("onContentRemovedFromSpace", mapOf("spaceId" to spaceId, "contentId" to contentId))

        override fun onSpaceUpdated(space: SharedSpace) = emit("onSpaceUpdated", spaceToMap(space))

        override fun onSpaceSyncProgress(spaceId: String, progress: Int, total: Int) = emit(
            "onSpaceSyncProgress",
            mapOf("spaceId" to spaceId, "progress" to progress, "total" to total),
        )

        override fun onSpaceSyncComplete(spaceId: String) =
            emit("onSpaceSyncComplete", mapOf("spaceId" to spaceId))

        override fun onSpaceOperationFailed(spaceId: String, operation: String, reason: String) = emit(
            "onSpaceOperationFailed",
            mapOf("spaceId" to spaceId, "operation" to operation, "reason" to reason),
        )
    }
}
