package expo.modules.setunative.network

import java.io.ByteArrayInputStream
import java.io.DataInputStream
import java.util.BitSet

/**
 * Parsers for Setu swarm protocol messages.
 * Deserializes byte arrays into message objects.
 */
object SetuSwarmMessageParsers {

    private const val TAG = "SETU_SWARM_PARSER"

    /**
     * Reads a length-prefixed string. Every inbound frame is untrusted, so the length is checked
     * before the array is allocated: a short payload must not be able to claim a huge field.
     */
    private fun DataInputStream.readString(
        maxBytes: Int = SetuSwarmConstants.MAX_ID_TEXT_BYTES
    ): String {
        val length = readInt()
        if (length < 0 || length > maxBytes) throw SecurityException("FRAME_FIELD_TOO_LARGE")
        val bytes = ByteArray(length)
        readFully(bytes)
        return String(bytes, Charsets.UTF_8)
    }

    /** Reads a count that drives a loop or an allocation, bounded before it is used. */
    private fun DataInputStream.readCount(maxCount: Int): Int {
        val count = readInt()
        if (count < 0 || count > maxCount) throw SecurityException("FRAME_COUNT_TOO_LARGE")
        return count
    }

    private fun <T> parseMessage(payload: ByteArray, parser: DataInputStream.() -> T): T {
        return DataInputStream(ByteArrayInputStream(payload)).use { input -> input.parser() }
    }

    fun parseHaveMessage(payload: ByteArray): HaveMessage = parseMessage(payload) {
        val manifestId = readString()
        val pieceCount = readCount(SetuSwarmConstants.MAX_HAVE_PIECES)
        val pieceIndices = mutableListOf<Int>()
        for (i in 0 until pieceCount) pieceIndices.add(readInt())
        HaveMessage(manifestId, pieceIndices)
    }

    fun parseWantMessage(payload: ByteArray): WantMessage = parseMessage(payload) {
        val manifestId = readString()
        val priority = readUnsignedByte()
        val pieceCount = readCount(SetuSwarmConstants.MAX_HAVE_PIECES)
        val pieceIndices = mutableSetOf<Int>()
        for (i in 0 until pieceCount) pieceIndices.add(readInt())
        WantMessage(manifestId, pieceIndices, priority)
    }

    fun parsePieceRequest(payload: ByteArray): PieceRequest = parseMessage(payload) {
        val requestId = readString()
        val manifestId = readString()
        val pieceIndex = readInt()
        PieceRequest(requestId, manifestId, pieceIndex)
    }

    fun parsePieceDataResponse(payload: ByteArray): PieceDataResponse = parseMessage(payload) {
        val requestId = readString()
        val manifestId = readString()
        val pieceIndex = readInt()
        val pieceDataLength = readInt()
        if (pieceDataLength < 0 || pieceDataLength > SetuSwarmConstants.MAX_PIECE_DATA_BYTES) {
            throw SecurityException("PIECE_DATA_TOO_LARGE")
        }
        val pieceData = ByteArray(pieceDataLength)
        readFully(pieceData)
        val pieceHash = ByteArray(32)
        readFully(pieceHash)
        PieceDataResponse(requestId, manifestId, pieceIndex, pieceData, pieceHash)
    }

    fun parseProviderMapUpdate(payload: ByteArray): ProviderMapUpdate = parseMessage(payload) {
        val manifestId = readString()
        val entryCount = readCount(SetuSwarmConstants.MAX_PROVIDER_MAP_ENTRIES)
        val providerMap = mutableMapOf<Int, MutableSet<String>>()
        for (i in 0 until entryCount) {
            val pieceIndex = readInt()
            val providerPeerId = readString()
            providerMap.getOrPut(pieceIndex, { mutableSetOf() }).add(providerPeerId)
        }
        ProviderMapUpdate(manifestId, providerMap)
    }

    fun parseReplicationRequest(payload: ByteArray): ReplicationRequest = parseMessage(payload) {
        val manifestId = readString()
        val targetReplication = readInt()
        val pieceCount = readCount(SetuSwarmConstants.MAX_HAVE_PIECES)
        val pieceIndices = mutableSetOf<Int>()
        for (i in 0 until pieceCount) pieceIndices.add(readInt())
        ReplicationRequest(manifestId, pieceIndices, targetReplication)
    }

    fun parseDepartureAnnouncement(payload: ByteArray): DepartureAnnouncement = parseMessage(payload) {
        val peerId = readString()
        val sessionId = readString()
        val manifestId = readString()
        val pieceCount = readCount(SetuSwarmConstants.MAX_HAVE_PIECES)
        val rarePieces = mutableSetOf<Int>()
        for (i in 0 until pieceCount) rarePieces.add(readInt())
        DepartureAnnouncement(peerId, sessionId, manifestId, rarePieces)
    }

    fun parseRepairRequest(payload: ByteArray): RepairRequest = parseMessage(payload) {
        val manifestId = readString()
        val urgency = readUnsignedByte()
        val pieceCount = readCount(SetuSwarmConstants.MAX_HAVE_PIECES)
        val missingPieces = mutableSetOf<Int>()
        for (i in 0 until pieceCount) missingPieces.add(readInt())
        RepairRequest(manifestId, missingPieces, urgency)
    }

    fun validatePayloadSize(payload: ByteArray, maxSize: Int): Boolean = payload.size <= maxSize
    fun createBitfield(availablePieces: Set<Int>, totalPieces: Int): BitSet {
        val bitfield = BitSet(totalPieces)
        for (pieceIndex in availablePieces) if (pieceIndex < totalPieces) bitfield.set(pieceIndex)
        return bitfield
    }

    fun getPieceIndicesFromBitfield(bitfield: BitSet, totalPieces: Int): Set<Int> {
        val indices = mutableSetOf<Int>()
        var index = bitfield.nextSetBit(0)
        while (index >= 0 && index < totalPieces) {
            indices.add(index)
            index = bitfield.nextSetBit(index + 1)
        }
        return indices
    }
}
