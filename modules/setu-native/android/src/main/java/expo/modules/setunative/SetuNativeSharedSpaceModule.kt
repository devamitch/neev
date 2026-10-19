package expo.modules.setunative

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.bootstrap.SetuRuntime
import expo.modules.setunative.shared.SetuEvents
import expo.modules.setunative.sharedspace.SharedSpace
import expo.modules.setunative.sharedspace.SharedSpaceEvents
import expo.modules.setunative.sharedspace.SharedSpaceService

/**
 * Bridge module for Setu Shared Spaces.
 * Thin shim: all logic stays in SharedSpaceService.
 */
class SetuNativeSharedSpaceModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("SetuNativeSharedSpace")
        Events(
            "onSpaceCreated", "onSpaceInvitationReceived", "onSpaceInvitationAccepted",
            "onContentAddedToSpace", "onContentRemovedFromSpace", "onSpaceUpdated",
            "onSpaceSyncProgress", "onSpaceSyncComplete", "onSpaceOperationFailed"
        )

        OnCreate { SetuEvents.attach(SetuEvents.SHARED_SPACE, this@SetuNativeSharedSpaceModule) }

        OnDestroy { SetuEvents.detach(SetuEvents.SHARED_SPACE, this@SetuNativeSharedSpaceModule) }

        // ── Space CRUD ────────────────────────────────────────────────────────

        AsyncFunction("createSpace") { name: String, ownerId: String, encrypted: Boolean ->
            svc().createSpace(name, ownerId, encrypted)?.let { spaceToMap(it) }
        }

        AsyncFunction("getSpacesByOwner") { ownerId: String ->
            svc().getSpacesByOwner(ownerId).map { spaceToMap(it) }
        }

        AsyncFunction("getSpacesByMember") { memberId: String ->
            svc().getSpacesByMember(memberId).map { spaceToMap(it) }
        }

        AsyncFunction("getSpace") { spaceId: String ->
            svc().getSpace(spaceId)?.let { spaceToMap(it) }
        }

        AsyncFunction("deleteSpace") { spaceId: String, ownerId: String ->
            svc().deleteSpace(spaceId, ownerId)
        }

        // ── Membership ────────────────────────────────────────────────────────

        AsyncFunction("inviteToSpace") { spaceId: String, inviterId: String, inviteeId: String ->
            svc().inviteToSpace(spaceId, inviterId, inviteeId)
        }

        AsyncFunction("acceptSpaceInvitation") { spaceId: String, memberId: String ->
            svc().acceptInvitation(spaceId, memberId)
        }

        AsyncFunction("declineSpaceInvitation") { spaceId: String, memberId: String ->
            // SharedSpaceService has no explicit decline; treat as leave for pending invite
            svc().leaveSpace(spaceId, memberId)
        }

        AsyncFunction("leaveSpace") { spaceId: String, memberId: String ->
            svc().leaveSpace(spaceId, memberId)
        }

        // ── Content ───────────────────────────────────────────────────────────

        AsyncFunction("addContentToSpace") { spaceId: String, contentId: String, memberId: String ->
            svc().addContentToSpace(spaceId, contentId, memberId)
        }

        AsyncFunction("removeContentFromSpace") { spaceId: String, contentId: String, memberId: String, deleteForBoth: Boolean ->
            svc().removeContentFromSpace(spaceId, contentId, memberId, deleteForBoth)
        }

        AsyncFunction("getSpaceContent") { spaceId: String ->
            svc().getSpaceContent(spaceId).map { contentToMap(it) }
        }

        AsyncFunction("syncSpace") { spaceId: String, peerId: String ->
            svc().syncSpace(spaceId, peerId)
        }

        AsyncFunction("getSpaceStats") { svc().getStats() }
    }

    private fun getContext(): Context =
        appContext.reactContext?.applicationContext
            ?: throw IllegalStateException("React context unavailable")

    private fun svc(): SharedSpaceService = SetuRuntime.spaces(getContext())

    private fun spaceToMap(s: SharedSpace): Map<String, Any?> = SharedSpaceEvents.spaceToMap(s)

    private fun contentToMap(c: expo.modules.setunative.models.SetuContent): Map<String, Any?> =
        expo.modules.setunative.content.ContentEvents.contentToMap(c)

}
