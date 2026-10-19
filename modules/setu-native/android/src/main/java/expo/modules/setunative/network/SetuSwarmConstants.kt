package expo.modules.setunative.network

/**
 * Constants for the Setu swarm protocol.
 * Frame types 32-40 are reserved for swarm coordination.
 */
object SetuSwarmConstants {

    // Swarm-specific frame types (must not conflict with existing types)
    const val FRAME_HAVE = 32          // Piece availability advertisement
    const val FRAME_WANT = 33          // Request for specific pieces
    const val FRAME_PROVIDER_MAP = 34  // Full provider map update
    const val FRAME_PIECE_REQUEST = 35 // Request for a specific piece
    const val FRAME_PIECE_DATA = 36    // Piece data response
    const val FRAME_REPLICATION_REQUEST = 37 // Request to replicate rare pieces
    const val FRAME_DEPARTURE_ANNOUNCE = 38 // Announce departure with rare pieces
    const val FRAME_REPAIR_REQUEST = 39 // Request to repair missing pieces
    const val FRAME_SCHEDULE_UPDATE = 40 // Scheduler state update

    // Maximum sizes for swarm messages
    const val MAX_HAVE_PIECES = 8192       // Max pieces in a single HAVE message
    const val MAX_PROVIDER_MAP_SIZE = 64 * 1024 // Max provider map payload
    const val MAX_PIECE_REQUEST_COUNT = 64   // Max pieces per request

    // Bounds applied while parsing an inbound payload, before any allocation sized by its own
    // length fields. The outer frame is already bounded, but a short payload can still claim a
    // multi-gigabyte field, so every parsed length and count is checked against these.
    const val MAX_ID_TEXT_BYTES = 512          // Max bytes of any id/string field in a payload
    const val MAX_PIECE_DATA_BYTES = 4 * 1024 * 1024 // Max bytes of piece data in one response
    const val MAX_PROVIDER_MAP_ENTRIES = 4096  // Max entries in a provider map update

    // Swarm message type range
    val SWARM_FRAME_RANGE = FRAME_HAVE..FRAME_SCHEDULE_UPDATE

    // All swarm frame types as a set for quick lookup
    val SWARM_FRAME_TYPES = setOf(
        FRAME_HAVE,
        FRAME_WANT,
        FRAME_PROVIDER_MAP,
        FRAME_PIECE_REQUEST,
        FRAME_PIECE_DATA,
        FRAME_REPLICATION_REQUEST,
        FRAME_DEPARTURE_ANNOUNCE,
        FRAME_REPAIR_REQUEST,
        FRAME_SCHEDULE_UPDATE
    )

    /**
     * Check if a frame type is a swarm frame type.
     */
    fun isSwarmFrame(frameType: Int): Boolean {
        return SWARM_FRAME_TYPES.contains(frameType)
    }

    /**
     * Get frame type name for debugging.
     */
    fun getFrameTypeName(frameType: Int): String {
        return when (frameType) {
            FRAME_HAVE -> "HAVE"
            FRAME_WANT -> "WANT"
            FRAME_PROVIDER_MAP -> "PROVIDER_MAP"
            FRAME_PIECE_REQUEST -> "PIECE_REQUEST"
            FRAME_PIECE_DATA -> "PIECE_DATA"
            FRAME_REPLICATION_REQUEST -> "REPLICATION_REQUEST"
            FRAME_DEPARTURE_ANNOUNCE -> "DEPARTURE_ANNOUNCE"
            FRAME_REPAIR_REQUEST -> "REPAIR_REQUEST"
            FRAME_SCHEDULE_UPDATE -> "SCHEDULE_UPDATE"
            else -> "UNKNOWN"
        }
    }
}
