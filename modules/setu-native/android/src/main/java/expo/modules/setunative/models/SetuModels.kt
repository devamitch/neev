package expo.modules.setunative.models

import java.util.UUID

/**
 * Canonical content model for Setu.
 * Represents any content that can be shared or stored in the Setu ecosystem.
 */
data class SetuContent(
    val contentId: String,
    val type: ContentType,
    val name: String,
    val mimeType: String,
    val size: Long,
    val createdAt: Long,
    val modifiedAt: Long,
    val source: ContentSource,
    val sourceUri: String?,
    val storageMode: StorageMode,
    val encryptionMode: EncryptionMode,
    val manifestId: String?,
    val ownerId: String,
    val visibility: Visibility,
    val availability: Availability,
    val state: ContentState,
    val thumbnailUri: String? = null,
    val metadata: Map<String, String> = emptyMap()
)

enum class ContentType {
    IMAGE, VIDEO, AUDIO, DOCUMENT, OTHER
}

enum class ContentSource {
    MEDIASTORE, SAF, CAMERA, VAULT, SETU_MANAGED, SHARED_SPACE, EXTERNAL
}

enum class StorageMode {
    EXTERNAL, SETU_MANAGED, VAULT, SHARED_SPACE
}

enum class EncryptionMode {
    NONE, AES_GCM, CHACHA20_POLY1305
}

enum class Visibility {
    PRIVATE, PAIRED, CONTACTS, NEARBY, PUBLIC
}

enum class Availability {
    FULL, PARTIAL, PENDING, UNAVAILABLE
}

enum class ContentState {
    ACTIVE, ARCHIVED, DELETED, CORRUPTED, TRANSFERRING
}

/**
 * Canonical peer model for Setu.
 * Represents a nearby device that can participate in the swarm.
 */
data class SetuPeer(
    val peerId: String,
    val deviceId: String,
    val displayName: String,
    val deviceModel: String?,
    val platform: String,
    val capabilities: Set<Capability> = emptySet(),
    val trustState: TrustState = TrustState.DISCOVERED,
    val isBlocked: Boolean = false,
    val quarantineLevel: Int = 0,
    val lastSeenAt: Long = System.currentTimeMillis(),
    val sessionId: String? = null,
    val publicKey: String? = null,
    val verificationCode: String? = null,
    val endpoint: String? = null,
    val port: Int? = null,
    val blockedAt: Long? = null,
    val reason: String? = null,
    val blockedUntil: Long? = null
)

enum class Capability {
    FILE_TRANSFER, MESSAGING, SHARED_SPACES, EMERGENCY, CAMERA, NFC, AUDIO, VIDEO
}

enum class TrustState {
    DISCOVERED, INTRODUCED, AUTHENTICATING, AUTHENTICATED, PENDING_AUTHORIZATION, AUTHORIZED, CONNECTED, DISCONNECTED, BLOCKED, QUARANTINED
}

/**
 * Canonical manifest model for Setu.
 * Represents a file broken into pieces with cryptographic hashes.
 */
data class SetuManifest(
    val manifestId: String,
    val contentId: String,
    val version: Int = 1,
    val fileName: String,
    val mimeType: String,
    val size: Long,
    val pieceSize: Int,
    val pieceHashes: List<ByteArray>,
    val fileHash: ByteArray,
    val manifestHash: ByteArray,
    val createdAt: Long = System.currentTimeMillis(),
    val ownerId: String,
    val isPublic: Boolean = false
) {
    val pieceCount: Int get() = pieceHashes.size

    fun pieceOffset(index: Int): Long = index.toLong() * pieceSize

    fun pieceLength(index: Int): Int =
        if (index == pieceCount - 1 && size % pieceSize != 0L)
            (size % pieceSize).toInt()
        else
            pieceSize
}

/**
 * Canonical piece model for Setu.
 * Represents a single piece of a file with its verification status.
 */
data class SetuPiece(
    val pieceId: String,
    val manifestId: String,
    val contentId: String,
    val index: Int,
    val hash: ByteArray,
    val length: Int,
    val state: PieceState = PieceState.UNKNOWN,
    val storagePath: String? = null,
    val verifiedAt: Long? = null,
    val providerPeerIds: Set<String> = emptySet()
)

enum class PieceState {
    UNKNOWN, REQUESTED, DOWNLOADING, VERIFYING, AVAILABLE, CORRUPTED, PROTECTED, EVICTABLE
}

/**
 * Canonical transfer model for Setu.
 * Represents a file transfer operation between peers.
 */
data class SetuTransfer(
    val transferId: String,
    val contentId: String,
    val manifestId: String,
    val direction: TransferDirection,
    val peerId: String,
    val sessionId: String,
    val state: TransferState = TransferState.INITIALIZING,
    val totalBytes: Long,
    val verifiedBytes: Long = 0,
    val pieceBitfield: BitSetWrapper = BitSetWrapper(),
    val requestedPieces: Set<Int> = emptySet(),
    val failedPieces: Set<Int> = emptySet(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val destination: TransferDestination = TransferDestination.LIBRARY,
    val batchId: String? = null
)

enum class TransferDirection {
    UPLOAD, DOWNLOAD
}

enum class TransferState {
    INITIALIZING, PREPARING, WAITING, TRANSFERRING, VERIFYING, COMPLETED, FAILED, PAUSED, CANCELLED
}

enum class TransferDestination {
    LIBRARY, VAULT, SHARED_SPACE, STREAM_ONLY
}

/**
 * Wrapper for BitSet to make it serializable for SQLite.
 * This is used for piece availability tracking.
 */
class BitSetWrapper(private val bitSet: java.util.BitSet = java.util.BitSet()) {

    fun getBitSet(): java.util.BitSet = bitSet.clone() as java.util.BitSet

    fun set(index: Int) = bitSet.set(index)
    fun clear(index: Int) = bitSet.clear(index)
    fun get(index: Int): Boolean = bitSet.get(index)
    fun cardinality(): Int = bitSet.cardinality()
    fun nextSetBit(fromIndex: Int): Int = bitSet.nextSetBit(fromIndex)
    fun nextClearBit(fromIndex: Int): Int = bitSet.nextClearBit(fromIndex)

    fun toByteArray(): ByteArray = bitSet.toByteArray()

    companion object {
        fun fromByteArray(bytes: ByteArray): BitSetWrapper {
            return BitSetWrapper(java.util.BitSet.valueOf(bytes))
        }
    }
}

/**
 * Provider map entry for tracking which peers have which pieces.
 */
data class ProviderMapEntry(
    val manifestId: String,
    val pieceIndex: Int,
    val providerPeerId: String,
    val lastAdvertisedAt: Long = System.currentTimeMillis(),
    val isVerified: Boolean = false
)

/**
 * Swarm state for tracking replication and rarity.
 */
data class SwarmState(
    val manifestId: String,
    val totalPieces: Int,
    val availablePieces: Int,
    val replicationFactor: Int,
    val rarePieces: Set<Int> = emptySet(),
    val atRiskPieces: Set<Int> = emptySet(),
    val providerMap: Map<Int, Set<String>> = emptyMap()
)

/**
 * Canonical session model. Tracks an authenticated peer connection.
 */
data class SetuSession(
    val sessionId: String,
    val peerId: String,
    val publicKey: String,
    val verificationCode: String,
    val openedAt: Long = System.currentTimeMillis(),
    val isAuthorized: Boolean = false
)

/**
 * Canonical message model for Setu 1:1 and group messaging.
 */
data class SetuMessage(
    val messageId: String,
    val conversationId: String,
    val senderId: String,
    val recipientId: String?,
    val groupId: String?,
    val type: MessageType,
    val encryptedPayload: ByteArray,
    val state: MessageState = MessageState.CREATED,
    val createdAt: Long = System.currentTimeMillis(),
    val deliveredAt: Long? = null,
    val readAt: Long? = null,
    val expiresAt: Long? = null,
    val hopCount: Int = 0,
    val attachmentContentId: String? = null
)

enum class MessageType {
    TEXT, IMAGE, VIDEO, AUDIO, VOICE_NOTE, FILE, SYSTEM
}

enum class MessageState {
    CREATED, QUEUED, SENDING, SENT, DELIVERED, READ, FAILED, EXPIRED
}

/**
 * Canonical conversation model.
 */
data class SetuConversation(
    val conversationId: String,
    val type: ConversationType,
    val peerId: String?,
    val groupId: String?,
    val lastMessageId: String?,
    val lastMessageAt: Long?,
    val unreadCount: Int = 0,
    val retentionDays: Int? = null,
    val createdAt: Long = System.currentTimeMillis()
)

enum class ConversationType { DIRECT, GROUP }

/**
 * Canonical shared space model.
 */
data class SetuSharedSpace(
    val spaceId: String,
    val name: String,
    val members: List<String>,
    val permissions: Map<String, Set<String>>,
    val version: Long = 0,
    val memberEpoch: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val state: SharedSpaceState = SharedSpaceState.ACTIVE
)

enum class SharedSpaceState { PENDING_INVITE, ACTIVE, LEFT, DELETED }

/**
 * Emergency broadcast model.
 */
data class EmergencyBroadcast(
    val broadcastId: String,
    val originId: String,
    val createdAt: Long,
    val expiresAt: Long,
    val hopLimit: Int,
    val hopCount: Int = 0,
    val category: EmergencyCategory,
    val encryptedPayload: ByteArray,
    val seenByPeerIds: MutableSet<String> = mutableSetOf()
)

enum class EmergencyCategory { SAFETY, MEDICAL, FIRE, FLOOD, GENERAL }

/**
 * Bootstrap state for app lifecycle.
 */
enum class BootstrapState {
    BOOTING, FIRST_INSTALL, ONBOARDING, INITIALIZING,
    VAULT_LOCKED, AUTHENTICATING, READY, CORRUPTED, RESET_REQUIRED
}

data class QuarantinedPeerInfo(
    val peerId: String,
    val level: Int,
    val reason: String?,
    val quarantinedAt: Long?,
    val expiresAt: Long?
)
