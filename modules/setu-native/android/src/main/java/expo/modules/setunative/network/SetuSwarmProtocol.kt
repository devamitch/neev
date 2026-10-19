package expo.modules.setunative.network

import java.util.BitSet

/**
 * Setu swarm protocol facade.
 * Delegates to specialized builders, parsers, and constants.
 *
 * This is the entry point for all swarm protocol operations.
 * Use the individual components directly for more control.
 */
object SetuSwarmProtocol {

    // ====================================================
    // Constants delegation
    // ====================================================

    const val FRAME_HAVE = SetuSwarmConstants.FRAME_HAVE
    const val FRAME_WANT = SetuSwarmConstants.FRAME_WANT
    const val FRAME_PROVIDER_MAP = SetuSwarmConstants.FRAME_PROVIDER_MAP
    const val FRAME_PIECE_REQUEST = SetuSwarmConstants.FRAME_PIECE_REQUEST
    const val FRAME_PIECE_DATA = SetuSwarmConstants.FRAME_PIECE_DATA
    const val FRAME_REPLICATION_REQUEST = SetuSwarmConstants.FRAME_REPLICATION_REQUEST
    const val FRAME_DEPARTURE_ANNOUNCE = SetuSwarmConstants.FRAME_DEPARTURE_ANNOUNCE
    const val FRAME_REPAIR_REQUEST = SetuSwarmConstants.FRAME_REPAIR_REQUEST
    const val FRAME_SCHEDULE_UPDATE = SetuSwarmConstants.FRAME_SCHEDULE_UPDATE
    const val FRAME_MESSAGE = PeerTransportConstants.FRAME_MESSAGE
    const val FRAME_ACK = PeerTransportConstants.FRAME_ACK
    const val FRAME_EMERGENCY_MESSAGE = PeerTransportConstants.FRAME_EMERGENCY_MESSAGE

    // ====================================================
    // Builder delegation
    // ====================================================

    fun createHaveMessage(manifestId: String, availablePieces: BitSet): ByteArray =
        SetuSwarmMessageBuilders.buildHaveMessage(manifestId, availablePieces)

    fun createWantMessage(manifestId: String, wantedPieces: Set<Int>, priority: Int = 0): ByteArray =
        SetuSwarmMessageBuilders.buildWantMessage(manifestId, wantedPieces, priority)

    fun createPieceRequest(manifestId: String, pieceIndex: Int, requestId: String): ByteArray =
        SetuSwarmMessageBuilders.buildPieceRequest(manifestId, pieceIndex, requestId)

    fun createPieceDataResponse(
        requestId: String,
        manifestId: String,
        pieceIndex: Int,
        pieceData: ByteArray,
        pieceHash: ByteArray
    ): ByteArray =
        SetuSwarmMessageBuilders.buildPieceDataResponse(requestId, manifestId, pieceIndex, pieceData, pieceHash)

    fun createProviderMapUpdate(manifestId: String, providerMap: Map<Int, Set<String>>): ByteArray =
        SetuSwarmMessageBuilders.buildProviderMapUpdate(manifestId, providerMap)

    fun createReplicationRequest(manifestId: String, rarePieces: Set<Int>, targetReplication: Int = 2): ByteArray =
        SetuSwarmMessageBuilders.buildReplicationRequest(manifestId, rarePieces, targetReplication)

    fun createDepartureAnnouncement(
        peerId: String,
        sessionId: String,
        manifestId: String,
        rarePieces: Set<Int>
    ): ByteArray =
        SetuSwarmMessageBuilders.buildDepartureAnnouncement(peerId, sessionId, manifestId, rarePieces)

    fun createRepairRequest(
        manifestId: String,
        missingPieces: Set<Int>,
        urgency: Int = 0
    ): ByteArray =
        SetuSwarmMessageBuilders.buildRepairRequest(manifestId, missingPieces, urgency)

    // ====================================================
    // Parser delegation
    // ====================================================

    fun parseHaveMessage(payload: ByteArray): HaveMessage =
        SetuSwarmMessageParsers.parseHaveMessage(payload)

    fun parseWantMessage(payload: ByteArray): WantMessage =
        SetuSwarmMessageParsers.parseWantMessage(payload)

    fun parsePieceRequest(payload: ByteArray): PieceRequest =
        SetuSwarmMessageParsers.parsePieceRequest(payload)

    fun parsePieceDataResponse(payload: ByteArray): PieceDataResponse =
        SetuSwarmMessageParsers.parsePieceDataResponse(payload)

    fun parseProviderMapUpdate(payload: ByteArray): ProviderMapUpdate =
        SetuSwarmMessageParsers.parseProviderMapUpdate(payload)

    fun parseReplicationRequest(payload: ByteArray): ReplicationRequest =
        SetuSwarmMessageParsers.parseReplicationRequest(payload)

    fun parseDepartureAnnouncement(payload: ByteArray): DepartureAnnouncement =
        SetuSwarmMessageParsers.parseDepartureAnnouncement(payload)

    fun parseRepairRequest(payload: ByteArray): RepairRequest =
        SetuSwarmMessageParsers.parseRepairRequest(payload)

    // ====================================================
    // Utility delegation
    // ====================================================

    fun validatePayloadSize(payload: ByteArray, maxSize: Int): Boolean =
        SetuSwarmMessageParsers.validatePayloadSize(payload, maxSize)

    fun createBitfield(availablePieces: Set<Int>, totalPieces: Int): BitSet =
        SetuSwarmMessageParsers.createBitfield(availablePieces, totalPieces)

    fun getPieceIndicesFromBitfield(bitfield: BitSet, totalPieces: Int): Set<Int> =
        SetuSwarmMessageParsers.getPieceIndicesFromBitfield(bitfield, totalPieces)

    // ====================================================
    // Frame type utilities
    // ====================================================

    fun isSwarmFrame(frameType: Int): Boolean =
        SetuSwarmConstants.isSwarmFrame(frameType)

    fun getFrameTypeName(frameType: Int): String =
        SetuSwarmConstants.getFrameTypeName(frameType)
}
