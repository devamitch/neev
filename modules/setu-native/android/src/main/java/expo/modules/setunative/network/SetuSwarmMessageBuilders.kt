package expo.modules.setunative.network

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.util.BitSet

/**
 * Builders for Setu swarm protocol messages.
 * Creates serialized byte arrays from message objects.
 */
object SetuSwarmMessageBuilders {

    private const val TAG = "SETU_SWARM_BUILDER"

    /**
     * Create a HAVE message for available pieces.
     */
    fun buildHaveMessage(manifestId: String, availablePieces: BitSet): ByteArray {
        val pieceIndices = mutableListOf<Int>()
        var index = availablePieces.nextSetBit(0)

        // Limit to maximum pieces per HAVE message
        while (index >= 0 && pieceIndices.size < SetuSwarmConstants.MAX_HAVE_PIECES) {
            pieceIndices.add(index)
            index = availablePieces.nextSetBit(index + 1)
        }

        return buildMessage {
            // Write manifest ID
            writeString(manifestId)
            
            // Write piece count
            writeInt(pieceIndices.size)
            
            // Write piece indices
            for (pieceIndex in pieceIndices) {
                writeInt(pieceIndex)
            }
        }
    }

    /**
     * Create a WANT message for requested pieces.
     */
    fun buildWantMessage(manifestId: String, wantedPieces: Set<Int>, priority: Int = 0): ByteArray {
        val pieceIndices = wantedPieces.take(SetuSwarmConstants.MAX_PIECE_REQUEST_COUNT).toList()

        return buildMessage {
            // Write manifest ID
            writeString(manifestId)
            
            // Write priority (0 = normal, 1 = high for playback)
            writeByte(priority)
            
            // Write piece count
            writeInt(pieceIndices.size)
            
            // Write piece indices
            for (pieceIndex in pieceIndices) {
                writeInt(pieceIndex)
            }
        }
    }

    /**
     * Create a piece request for a specific piece.
     */
    fun buildPieceRequest(manifestId: String, pieceIndex: Int, requestId: String): ByteArray {
        return buildMessage {
            // Write request ID
            writeString(requestId)
            
            // Write manifest ID
            writeString(manifestId)
            
            // Write piece index
            writeInt(pieceIndex)
        }
    }

    /**
     * Create a piece data response.
     */
    fun buildPieceDataResponse(
        requestId: String,
        manifestId: String,
        pieceIndex: Int,
        pieceData: ByteArray,
        pieceHash: ByteArray
    ): ByteArray {
        return buildMessage {
            // Write request ID
            writeString(requestId)
            
            // Write manifest ID
            writeString(manifestId)
            
            // Write piece index
            writeInt(pieceIndex)
            
            // Write piece data length and data
            writeInt(pieceData.size)
            write(pieceData)
            
            // Write piece hash (32 bytes)
            write(pieceHash)
        }
    }

    /**
     * Create a provider map update message.
     */
    fun buildProviderMapUpdate(manifestId: String, providerMap: Map<Int, Set<String>>): ByteArray {
        val providerEntries = mutableListOf<ProviderEntry>()

        for ((pieceIndex, providers) in providerMap) {
            for (providerPeerId in providers) {
                providerEntries.add(ProviderEntry(pieceIndex, providerPeerId))
            }
        }

        return buildMessage {
            // Write manifest ID
            writeString(manifestId)
            
            // Write number of entries
            writeInt(providerEntries.size)
            
            // Write provider entries
            for (entry in providerEntries) {
                writeInt(entry.pieceIndex)
                writeString(entry.providerPeerId)
            }
        }
    }

    /**
     * Create a replication request for rare pieces.
     */
    fun buildReplicationRequest(manifestId: String, rarePieces: Set<Int>, targetReplication: Int = 2): ByteArray {
        val pieceIndices = rarePieces.take(SetuSwarmConstants.MAX_PIECE_REQUEST_COUNT).toList()

        return buildMessage {
            // Write manifest ID
            writeString(manifestId)
            
            // Write target replication factor
            writeInt(targetReplication)
            
            // Write piece count
            writeInt(pieceIndices.size)
            
            // Write piece indices
            for (pieceIndex in pieceIndices) {
                writeInt(pieceIndex)
            }
        }
    }

    /**
     * Create a departure announcement with rare pieces.
     */
    fun buildDepartureAnnouncement(
        peerId: String,
        sessionId: String,
        manifestId: String,
        rarePieces: Set<Int>
    ): ByteArray {
        val pieceIndices = rarePieces.take(SetuSwarmConstants.MAX_PIECE_REQUEST_COUNT).toList()

        return buildMessage {
            // Write peer ID
            writeString(peerId)
            
            // Write session ID
            writeString(sessionId)
            
            // Write manifest ID
            writeString(manifestId)
            
            // Write piece count
            writeInt(pieceIndices.size)
            
            // Write piece indices
            for (pieceIndex in pieceIndices) {
                writeInt(pieceIndex)
            }
        }
    }

    /**
     * Create a repair request for missing pieces.
     */
    fun buildRepairRequest(
        manifestId: String,
        missingPieces: Set<Int>,
        urgency: Int = 0
    ): ByteArray {
        val pieceIndices = missingPieces.take(SetuSwarmConstants.MAX_PIECE_REQUEST_COUNT).toList()

        return buildMessage {
            // Write manifest ID
            writeString(manifestId)
            
            // Write urgency (0 = normal, 1 = urgent for playback)
            writeByte(urgency)
            
            // Write piece count
            writeInt(pieceIndices.size)
            
            // Write piece indices
            for (pieceIndex in pieceIndices) {
                writeInt(pieceIndex)
            }
        }
    }

    // ====================================================
    // Helper functions
    // ====================================================

    /**
     * Write a string to the output stream with length prefix.
     */
    private fun DataOutputStream.writeString(value: String) {
        val bytes = value.toByteArray(Charsets.UTF_8)
        writeInt(bytes.size)
        write(bytes)
    }

    /**
     * Build a message using a builder lambda.
     */
    private fun buildMessage(builder: DataOutputStream.() -> Unit): ByteArray {
        return ByteArrayOutputStream().use { output ->
            DataOutputStream(output).use { data ->
                data.builder()
            }
            output.toByteArray()
        }
    }
}
