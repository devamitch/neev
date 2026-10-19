package expo.modules.setunative.swarm

import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.persistence.SetuDatabase
import expo.modules.setunative.network.SetuPeerTransport
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.min

/**
 * Manages swarm transfers with multi-source download and piece coordination.
 */
class TransferManager(private val engine: SetuSwarmEngine) {

    companion object {
        private const val TAG = "SETU_XFER_MGR"
        private const val MAX_CONCURRENT_REQUESTS = 4
    }

    private val swarmState = ConcurrentHashMap<String, SwarmState>()
    private val scheduler = SwarmScheduler(engine.pieceRepository, engine.providerMapRepository, engine.peerRepository)

    fun setPlaybackWindow(manifestId: String, window: IntRange?) {
        if (window == null) scheduler.clearPlaybackPriority(manifestId)
        else scheduler.setPlaybackPriority(manifestId, window)
        onProviderAvailabilityChanged(manifestId)
    }

    fun startSwarmTransfer(manifest: SetuManifest, peerId: String, sessionId: String): String {
        val transferId = UUID.randomUUID().toString()
        val transfer = SetuSwarmEngine.SwarmTransfer(
            transferId = transferId,
            manifestId = manifest.manifestId,
            direction = TransferDirection.DOWNLOAD,
            peerId = peerId,
            sessionId = sessionId,
            state = TransferState.TRANSFERRING,
            totalBytes = manifest.size,
            verifiedBytes = 0L,
            requestedPieces = ConcurrentHashMap.newKeySet()
        )

        check(engine.transferRepository.upsert(SetuTransfer(
            transferId = transferId,
            contentId = manifest.contentId,
            manifestId = manifest.manifestId,
            direction = TransferDirection.DOWNLOAD,
            peerId = peerId,
            sessionId = sessionId,
            state = TransferState.TRANSFERRING,
            totalBytes = manifest.size
        ))) { "TRANSFER_PERSIST_FAILED" }
        engine.activeTransfers[transferId] = transfer

        // Initialize swarm state for this manifest if not exists
        initializeSwarmState(manifest.manifestId, manifest.pieceCount)

        // Start the transfer process
        engine.executor.execute {
            processSwarmTransfer(transfer, manifest)
        }

        return transferId
    }

    fun handlePeerDisconnected(peerId: String, sessionId: String) {
        // Remove active requests from this peer
        engine.removeRequestsForPeer(peerId, sessionId)
        engine.swarmCoordinator.handlePeerDisconnected(peerId)

        // Find transfers associated with this peer
        val transfers = engine.activeTransfers.values.filter {
            it.peerId == peerId && it.sessionId == sessionId
        }

        for (transfer in transfers) {
            val manifest = engine.manifestRepository.get(transfer.manifestId) ?: continue
            val missingPieces = engine.pieceRepository.getMissingPieces(transfer.manifestId, manifest.pieceCount)

            if (missingPieces.isNotEmpty()) {
                val availableProviders = findAlternativeProviders(manifest.manifestId, missingPieces.toSet())

                if (availableProviders.isNotEmpty()) {
                    processSwarmTransfer(transfer, manifest)
                } else {
                    transfer.state = TransferState.PAUSED
                    Log.w(TAG, "Transfer ${transfer.transferId} paused, no providers available")
                }
            } else {
                engine.activeTransfers.remove(transfer.transferId)
            }
        }
    }

    private fun processSwarmTransfer(transfer: SetuSwarmEngine.SwarmTransfer, manifest: SetuManifest) {
        try {
            transfer.state = TransferState.TRANSFERRING

            // Get current swarm state for this manifest
            val currentState = swarmState[manifest.manifestId]
            if (currentState == null) {
                initializeSwarmState(manifest.manifestId, manifest.pieceCount)
            }

            // Get missing pieces
            val availablePieces = engine.pieceRepository.getAvailablePieces(manifest.manifestId)
                .map { it.index }.toSet()

            /*
             * Completion is decided by the pieces actually verified on disk.
             *
             * It must never be inferred from the request queue draining: a
             * piece that is still in flight is absent from `missingPieces`
             * below while its bytes have not arrived, so treating an empty
             * queue as completion reports success after the first piece
             * verifies. This matches the check in SwarmProgressReporter.
             */
            if (availablePieces.size >= manifest.pieceCount) {
                completeTransfer(transfer)
                return
            }

            val missingPieces = mutableSetOf<Int>()

            missingPieces.addAll(
                scheduler.getPrioritizedMissingPieces(manifest.manifestId, manifest.pieceCount, availablePieces)
                    .filterNot { transfer.requestedPieces.contains(it) }
            )

            if (missingPieces.isEmpty()) {
                /*
                 * Everything still outstanding is already requested. Wait for
                 * those responses (or their timeout) instead of finishing.
                 */
                return
            }

            // Find best providers for missing pieces
            val providerMap = engine.providerMapRepository.getProviderMap(manifest.manifestId)
            val bestProviders = selectBestProviders(manifest.manifestId, missingPieces, providerMap)

            // Request pieces from providers
            requestPiecesFromProviders(transfer, manifest, missingPieces, bestProviders)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to process swarm transfer ${transfer.transferId}", e)
            failTransfer(transfer, e.message ?: "Unknown error")
        }
    }

    private fun initializeSwarmState(manifestId: String, totalPieces: Int) {
        val bitfield = engine.pieceRepository.getBitfield(manifestId, totalPieces)
        val providerMap = engine.providerMapRepository.getProviderMap(manifestId)

        val state = SwarmState(
            manifestId = manifestId,
            totalPieces = totalPieces,
            availablePieces = bitfield.cardinality(),
            replicationFactor = providerMap.values.minOfOrNull { it.size } ?: 0,
            providerMap = providerMap,
            rarePieces = emptySet(),
            atRiskPieces = emptySet()
        )

        swarmState[manifestId] = state
    }

    private fun selectBestProviders(
        manifestId: String,
        missingPieces: Set<Int>,
        providerMap: Map<Int, Set<String>>
    ): Map<Int, String> {
        val bestProviders = mutableMapOf<Int, String>()

        val connectedPeerIds = engine.peerRepository.getConnected()
            .filter { it.sessionId != null && SetuPeerTransport.isSessionAuthorized(it.sessionId) }
            .map { it.peerId }.toSet()
        val providerLoads = mutableMapOf<String, Int>()
        for (pieceIndex in missingPieces) {
            val provider = providerMap[pieceIndex].orEmpty()
                .filter { it in connectedPeerIds }
                .minWithOrNull(compareBy<String> { providerLoads.getOrDefault(it, 0) }.thenBy { it }) ?: continue
            bestProviders[pieceIndex] = provider
            providerLoads[provider] = providerLoads.getOrDefault(provider, 0) + 1
        }

        return bestProviders
    }

    private fun requestPiecesFromProviders(
        transfer: SetuSwarmEngine.SwarmTransfer,
        manifest: SetuManifest,
        missingPieces: Set<Int>,
        providers: Map<Int, String>
    ) {
        val connectedPeers = engine.peerRepository.getConnected()
        val connectedPeerIds = connectedPeers.map { it.peerId }.toSet()

        var availableSlots = (MAX_CONCURRENT_REQUESTS - engine.getPieceManagerActiveRequestCount()).coerceAtLeast(0)
        val orderedPieces = scheduler.getPrioritizedMissingPieces(
            manifest.manifestId,
            manifest.pieceCount,
            engine.pieceRepository.getAvailablePieces(manifest.manifestId).map { it.index }.toSet()
        )
        for (pieceIndex in orderedPieces) {
            if (availableSlots == 0) break
            val providerPeerId = providers[pieceIndex] ?: continue
            if (pieceIndex in transfer.requestedPieces) continue
            val peer = connectedPeers.find { it.peerId == providerPeerId } ?: continue
            val sessionId = peer.sessionId ?: continue
            if (!SetuPeerTransport.isSessionAuthorized(sessionId)) continue
            try {
                engine.requestPieceFromPeer(manifest.manifestId, pieceIndex, providerPeerId, sessionId)
                transfer.requestedPieces.add(pieceIndex)
                availableSlots--
            } catch (e: Exception) {
                Log.e(TAG, "Failed to request piece ${manifest.manifestId}_$pieceIndex", e)
            }
        }
    }

    fun onPieceVerified(manifestId: String, pieceIndex: Int) {
        scheduler.markCompleted(manifestId, pieceIndex)
        engine.activeTransfers.values.filter { it.manifestId == manifestId }.forEach { transfer ->
            transfer.requestedPieces.remove(pieceIndex)
            val available = engine.pieceRepository.getAvailablePieces(manifestId)
            val bitfield = BitSetWrapper()
            available.forEach { bitfield.set(it.index) }
            transfer.verifiedBytes = available.sumOf { it.length.toLong() }
            val persisted = engine.transferRepository.get(transfer.transferId)
            if (persisted == null || !engine.transferRepository.upsert(persisted.copy(
                verifiedBytes = transfer.verifiedBytes,
                pieceBitfield = bitfield,
                requestedPieces = transfer.requestedPieces.toSet(),
                updatedAt = System.currentTimeMillis()
            ))) {
                failTransfer(transfer, "TRANSFER_PROGRESS_PERSIST_FAILED")
                return@forEach
            }
            val manifest = engine.manifestRepository.get(manifestId) ?: return@forEach
            processSwarmTransfer(transfer, manifest)
        }
    }

    fun onProviderAvailabilityChanged(manifestId: String) {
        engine.activeTransfers.values.filter { it.manifestId == manifestId }.forEach { transfer ->
            val manifest = engine.manifestRepository.get(manifestId) ?: return@forEach
            processSwarmTransfer(transfer, manifest)
        }
    }

    private fun completeTransfer(transfer: SetuSwarmEngine.SwarmTransfer) {
        if (!engine.transferRepository.updateState(transfer.transferId, TransferState.COMPLETED)) {
            failTransfer(transfer, "TRANSFER_COMPLETION_PERSIST_FAILED")
            return
        }
        transfer.state = TransferState.COMPLETED
        engine.activeTransfers.remove(transfer.transferId)

        engine.swarmListener?.onTransferCompleted(transfer.transferId, transfer.manifestId)
        Log.i(TAG, "Transfer ${transfer.transferId} completed")
    }

    private fun failTransfer(transfer: SetuSwarmEngine.SwarmTransfer, reason: String) {
        engine.transferRepository.updateError(transfer.transferId, reason)
        transfer.state = TransferState.FAILED
        engine.activeTransfers.remove(transfer.transferId)

        engine.swarmListener?.onTransferFailed(transfer.transferId, reason)
        Log.w(TAG, "Transfer ${transfer.transferId} failed: $reason")
    }

    /*
     * A piece request was abandoned after exhausting its retries.
     *
     * The reservation has to be released, otherwise the piece stays listed in
     * `requestedPieces` forever: it is then filtered out of `missingPieces` and
     * never re-requested, leaving the transfer stalled at partial progress with
     * no failure ever surfaced.
     */
    fun onPieceRequestAbandoned(manifestId: String, pieceIndex: Int) {
        engine.activeTransfers.values.filter { it.manifestId == manifestId }.forEach { transfer ->
            if (!transfer.requestedPieces.remove(pieceIndex)) {
                return@forEach
            }

            val manifest = engine.manifestRepository.get(manifestId) ?: return@forEach

            if (findAlternativeProviders(manifestId, setOf(pieceIndex)).isNotEmpty()) {
                processSwarmTransfer(transfer, manifest)
                return@forEach
            }

            /*
             * Pausing rather than failing matches handlePeerDisconnected: the
             * piece may become available again when a provider reconnects.
             */
            engine.transferRepository.updateState(transfer.transferId, TransferState.PAUSED)
            transfer.state = TransferState.PAUSED
            Log.w(
                TAG,
                "Transfer ${transfer.transferId} paused, piece $pieceIndex has no remaining provider"
            )
        }
    }

    private fun findAlternativeProviders(manifestId: String, missingPieces: Set<Int>): List<String> {
        val providerMap = engine.providerMapRepository.getProviderMap(manifestId)
        val connectedPeers = engine.peerRepository.getConnected()
        val connectedPeerIds = connectedPeers.map { it.peerId }.toSet()

        val alternativeProviders = mutableSetOf<String>()

        for (pieceIndex in missingPieces) {
            val providers = providerMap[pieceIndex] ?: continue
            for (providerPeerId in providers) {
                if (providerPeerId in connectedPeerIds) {
                    alternativeProviders.add(providerPeerId)
                }
            }
        }

        return alternativeProviders.toList()
    }
}
