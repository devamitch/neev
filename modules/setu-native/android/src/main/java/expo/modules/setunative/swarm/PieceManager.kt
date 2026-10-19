package expo.modules.setunative.swarm

import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.network.PieceDataResponse
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.network.SetuSwarmProtocol
import expo.modules.setunative.security.CryptoIdentityManager
import java.security.MessageDigest
import java.util.*
import java.util.concurrent.ConcurrentHashMap

class PieceManager(private val engine: SetuSwarmEngine) {
    private val availabilityBroadcaster = PieceAvailabilityBroadcaster(engine)

    companion object {
        private const val TAG = "SETU_PIECE_MGR"
        private const val MAX_RETRIES = 3
        private const val REQUEST_TIMEOUT_MS = 30000L
    }

    private val activePieceRequests = ConcurrentHashMap<String, PieceRequestState>()

    data class PieceRequestState(
        val requestId: String,
        val manifestId: String,
        val pieceIndex: Int,
        val peerId: String,
        val sessionId: String,
        val createdAt: Long = System.currentTimeMillis(),
        var retries: Int = 0
    )

    fun handlePieceData(sessionId: String, peerId: String, payload: ByteArray) {
        try {
            val response = SetuSwarmProtocol.parsePieceDataResponse(payload)
            val requestId = response.requestId
            val manifestId = response.manifestId
            val pieceIndex = response.pieceIndex

            val requestState = activePieceRequests.remove(requestId) ?: run {
                Log.w(TAG, "Received piece data for unknown request $requestId")
                return
            }

            if (requestState.sessionId != sessionId || requestState.peerId != peerId ||
                requestState.manifestId != manifestId || requestState.pieceIndex != pieceIndex) {
                Log.w(TAG, "Piece response does not match its request")
                return
            }

            val manifest = engine.manifestRepository.get(manifestId) ?: return
            if (pieceIndex !in 0 until manifest.pieceCount ||
                response.pieceData.size != manifest.pieceLength(pieceIndex) ||
                !MessageDigest.isEqual(response.pieceHash, manifest.pieceHashes[pieceIndex])) {
                Log.w(TAG, "Piece response does not match its manifest")
                handleHashMismatch(requestState, response)
                return
            }

            val computedHash = sha256(response.pieceData)
            if (!MessageDigest.isEqual(computedHash, manifest.pieceHashes[pieceIndex])) {
                handleHashMismatch(requestState, response)
                return
            }

            if (storePiece(manifestId, pieceIndex, response.pieceData, response.pieceHash, peerId)) {
                SwarmProgressReporter(engine).report(manifestId, pieceIndex, peerId, response.pieceData.size.toLong())
                engine.onPieceVerified(manifestId, pieceIndex)
            }


        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle piece data", e)
        }
    }

    fun addLocalPiece(manifestId: String, pieceIndex: Int, pieceHash: ByteArray, storagePath: String): Boolean {
        val manifest = engine.manifestRepository.get(manifestId) ?: return false
        if (!registerLocalPiece(manifest, pieceIndex, pieceHash, storagePath)) return false
        publishAvailability(manifestId, setOf(pieceIndex))
        return true
    }

    /**
     * Registers every piece of [manifestId] as locally available from one complete file, then
     * advertises once. Used when a 1:1 transfer finishes: the device now holds the whole file and
     * becomes a provider for it. Each piece is still re-hashed out of the file before it counts, so
     * nothing is advertised that has not been verified.
     */
    fun addLocalFile(manifestId: String, storagePath: String): Int {
        val manifest = engine.manifestRepository.get(manifestId) ?: return 0
        val registered = mutableSetOf<Int>()
        for (index in 0 until manifest.pieceCount) {
            if (registerLocalPiece(manifest, index, manifest.pieceHashes[index], storagePath)) {
                registered.add(index)
            }
        }
        if (registered.isNotEmpty()) publishAvailability(manifestId, registered)
        return registered.size
    }

    private fun registerLocalPiece(
        manifest: SetuManifest,
        pieceIndex: Int,
        pieceHash: ByteArray,
        storagePath: String
    ): Boolean {
        if (!engine.pieceStore.verifyFile(manifest, pieceIndex, pieceHash, storagePath)) {
            Log.w(TAG, "Local piece ${manifest.manifestId}_$pieceIndex failed verification")
            return false
        }

        val piece = SetuPiece(
            pieceId = "${manifest.manifestId}_$pieceIndex",
            manifestId = manifest.manifestId,
            contentId = manifest.contentId,
            index = pieceIndex,
            hash = pieceHash,
            length = manifest.pieceLength(pieceIndex),
            state = PieceState.AVAILABLE,
            storagePath = storagePath,
            verifiedAt = System.currentTimeMillis(),
            providerPeerIds = setOf(CryptoIdentityManager.getOrCreate().deviceId)
        )

        return engine.pieceRepository.upsert(piece)
    }

    /** Hands a newly authorized session this device's whole inventory. */
    fun advertiseInventoryTo(sessionId: String) {
        availabilityBroadcaster.advertiseInventory(sessionId)
    }

    private fun publishAvailability(manifestId: String, pieceIndices: Set<Int>) {
        engine.swarmCoordinator.recomputeSwarmState(manifestId)
        availabilityBroadcaster.broadcast(manifestId)
    }

    fun requestPieceFromPeer(manifestId: String, pieceIndex: Int, peerId: String, sessionId: String): String {
        val requestId = UUID.randomUUID().toString()

        val requestState = PieceRequestState(
            requestId = requestId,
            manifestId = manifestId,
            pieceIndex = pieceIndex,
            peerId = peerId,
            sessionId = sessionId
        )

        activePieceRequests[requestId] = requestState

        try {
            val payload = SetuSwarmProtocol.createPieceRequest(manifestId, pieceIndex, requestId)
            SetuPeerTransport.sendFrame(sessionId, SetuSwarmProtocol.FRAME_PIECE_REQUEST, payload)
            startRequestTimeout(requestId)
        } catch (e: Exception) {
            activePieceRequests.remove(requestId)
            throw e
        }

        return requestId
    }

    private fun handleHashMismatch(requestState: PieceRequestState, response: PieceDataResponse) {
        if (requestState.retries < MAX_RETRIES) {
            requestState.retries++
            activePieceRequests[requestState.requestId] = requestState

            try {
                val payload = SetuSwarmProtocol.createPieceRequest(
                    requestState.manifestId,
                    requestState.pieceIndex,
                    requestState.requestId
                )
                SetuPeerTransport.sendFrame(
                    requestState.sessionId,
                    SetuSwarmProtocol.FRAME_PIECE_REQUEST,
                    payload
                )
                startRequestTimeout(requestState.requestId)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to retry request", e)
            }
        } else {
            Log.w(TAG, "Max retries exceeded for piece ${requestState.manifestId}_${requestState.pieceIndex}")
        }
    }

    private fun storePiece(manifestId: String, pieceIndex: Int, pieceData: ByteArray, pieceHash: ByteArray, providerPeerId: String): Boolean {
        val manifest = engine.manifestRepository.get(manifestId) ?: run {
            Log.e(TAG, "Manifest not found for piece $manifestId,$pieceIndex")
            return false
        }

        val pieceLength = manifest.pieceLength(pieceIndex)
        val storagePath = try {
            engine.pieceStore.writeVerified(manifest, pieceIndex, pieceData).absolutePath
        } catch (error: Exception) {
            Log.e(TAG, "Failed to persist verified piece", error)
            return false
        }

        val piece = SetuPiece(
            pieceId = "${manifestId}_$pieceIndex",
            manifestId = manifestId,
            contentId = manifest.contentId,
            index = pieceIndex,
            hash = pieceHash,
            length = pieceLength,
            state = PieceState.AVAILABLE,
            storagePath = storagePath,
            verifiedAt = System.currentTimeMillis(),
            providerPeerIds = setOf(providerPeerId)
        )

        val success = engine.pieceRepository.upsert(piece)

        if (success) {
            engine.providerMapRepository.upsert(
                ProviderMapEntry(manifestId, pieceIndex, CryptoIdentityManager.getOrCreate().deviceId, isVerified = true)
            )
            engine.swarmCoordinator.recomputeSwarmState(manifestId)
            availabilityBroadcaster.broadcast(manifestId)
        }
        return success
    }

    fun removeRequestsForPeer(peerId: String, sessionId: String) {
        activePieceRequests.entries.removeIf { it.value.peerId == peerId && it.value.sessionId == sessionId }
    }

    fun activeRequestCount(): Int = activePieceRequests.size

    private fun startRequestTimeout(requestId: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            handleRequestTimeout(requestId)
        }, REQUEST_TIMEOUT_MS)
    }

    private fun handleRequestTimeout(requestId: String) {
        val requestState = activePieceRequests.remove(requestId) ?: return

        if (requestState.retries < MAX_RETRIES) {
            requestState.retries++
            activePieceRequests[requestId] = requestState

            try {
                val payload = SetuSwarmProtocol.createPieceRequest(
                    requestState.manifestId,
                    requestState.pieceIndex,
                    requestId
                )
                SetuPeerTransport.sendFrame(
                    requestState.sessionId,
                    SetuSwarmProtocol.FRAME_PIECE_REQUEST,
                    payload
                )
                startRequestTimeout(requestId)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to retry request", e)
            }
        } else {
            Log.w(TAG, "Max retries exceeded for request $requestId")

            /*
             * Hand the piece back to the transfer so the reservation is
             * released. Dropping it here silently stalls the transfer.
             */
            engine.transferManager.onPieceRequestAbandoned(
                requestState.manifestId,
                requestState.pieceIndex
            )
        }
    }

    private fun sha256(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)

}
