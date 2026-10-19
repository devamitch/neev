package expo.modules.setunative.swarm

import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.network.SetuSwarmProtocol
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.persistence.SetuDatabase
import java.io.ByteArrayInputStream
import java.io.DataInputStream
import java.util.concurrent.ConcurrentHashMap

/**
 * Coordinates swarm operations: HAVE/WANT messages, departure repair, rare piece tracking.
 */
class SwarmCoordinator(private val engine: SetuSwarmEngine) {

    companion object {
        private const val TAG = "SETU_SWARM_COORD"
    }

    private val swarmState = ConcurrentHashMap<String, SwarmState>()
    private val providerMaps = ConcurrentHashMap<String, Map<Int, Set<String>>>()

    fun handleHaveMessage(sessionId: String, peerId: String, payload: ByteArray) {
        try {
            if (!SetuPeerTransport.isSessionAuthorized(sessionId) ||
                SetuPeerTransport.peerIdForSession(sessionId) != peerId) return
            val message = SetuSwarmProtocol.parseHaveMessage(payload)
            val manifestId = message.manifestId
            val manifest = engine.manifestRepository.get(manifestId) ?: return
            val availablePieces = message.availablePieces.filter { it in 0 until manifest.pieceCount }.toSet()

            updateProviderMap(manifestId, peerId, availablePieces)
            recomputeSwarmState(manifestId)

            engine.swarmListener?.let { listener ->
                for (pieceIndex in availablePieces) {
                    listener.onPieceAvailable(manifestId, pieceIndex, peerId)
                }
            }

            checkForRarePieces(manifestId, peerId)
            engine.onProviderAvailabilityChanged(manifestId)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle HAVE message", e)
        }
    }

    fun handleWantMessage(sessionId: String, peerId: String, payload: ByteArray) {
        try {
            if (!engine.isServingEnabled()) return
            val message = SetuSwarmProtocol.parseWantMessage(payload)
            val manifestId = message.manifestId
            val wantedPieces = message.wantedPieces

            val availablePieces = engine.pieceRepository.getAvailablePieces(manifestId)
            val availableIndices = availablePieces.map { it.index }.toSet()
            val piecesWeCanProvide = wantedPieces.intersect(availableIndices)

            if (piecesWeCanProvide.isNotEmpty()) {
                engine.swarmListener?.let { listener ->
                    for (pieceIndex in piecesWeCanProvide) {
                        listener.onPieceRequested(manifestId, pieceIndex, peerId)
                    }
                }
                // Let PieceManager handle serving
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle WANT message", e)
        }
    }

    fun handleDepartureAnnouncement(sessionId: String, peerId: String, payload: ByteArray) {
        try {
            val announcement = SetuSwarmProtocol.parseDepartureAnnouncement(payload)
            if (announcement.peerId != peerId) return

            engine.swarmListener?.onDepartureDetected(peerId, sessionId, announcement.rarePieces)
            handleDepartureRepair(peerId, announcement.manifestId, announcement.rarePieces)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle departure announcement", e)
        }
    }

    fun getSwarmState(): Map<String, SwarmState> = swarmState

    fun canServePiece(sessionId: String, peerId: String): Boolean {
        if (!engine.isServingEnabled()) return false
        if (!SetuPeerTransport.isSessionAuthorized(sessionId) ||
            SetuPeerTransport.peerIdForSession(sessionId) != peerId) return false
        val peer = engine.peerRepository.get(peerId) ?: return false
        if (peer.isBlocked || peer.trustState == TrustState.BLOCKED) return false

        engine.resourceGovernor.updateResourceStatus()
        return engine.resourceGovernor.canStartTransfer() ==
            expo.modules.setunative.governor.ResourceGovernor.GovernorAction.ALLOW
    }

    fun canRequestPlaybackPiece(): Boolean {
        engine.resourceGovernor.updateResourceStatus()
        val action = engine.resourceGovernor.canStartTransfer(isUserInitiated = true)
        return action != expo.modules.setunative.governor.ResourceGovernor.GovernorAction.DENY &&
            action != expo.modules.setunative.governor.ResourceGovernor.GovernorAction.PAUSE
    }

    /**
     * Rebuilds this manifest's swarm state from what is true right now: the local bitfield and the
     * current provider map. Every path that changes either of those has to call it, otherwise the
     * reported rarity, at-risk set and replication factor keep describing a swarm that has moved on.
     */
    fun recomputeSwarmState(manifestId: String) {
        val manifest = engine.manifestRepository.get(manifestId) ?: return

        val pieceCount = manifest.pieceCount
        val bitfield = engine.pieceRepository.getBitfield(manifestId, pieceCount)
        val providerMap = providerMaps[manifestId] ?: emptyMap()
        val availableCount = bitfield.cardinality()

        val rarePieces = findRarePieces(manifestId, providerMap, pieceCount)
        val atRiskPieces = findAtRiskPieces(manifestId, providerMap, pieceCount)

        swarmState[manifestId] = SwarmState(
            manifestId = manifestId,
            totalPieces = pieceCount,
            availablePieces = availableCount,
            replicationFactor = providerMap.values.minOfOrNull { it.size } ?: 0,
            providerMap = providerMap,
            rarePieces = rarePieces,
            atRiskPieces = atRiskPieces
        )

        if (rarePieces.isNotEmpty()) {
            requestReplicationForRarePieces(manifestId, rarePieces)
        }

        notifySwarmHealth(manifestId)
    }

    private fun updateProviderMap(manifestId: String, peerId: String, availablePieces: Set<Int>) {
        providerMaps.compute(manifestId) { _, existingMap ->
            val newMap = existingMap?.toMutableMap() ?: mutableMapOf()
            for (pieceIndex in availablePieces) {
                newMap[pieceIndex] = newMap[pieceIndex].orEmpty() + peerId
                engine.providerMapRepository.upsert(
                    ProviderMapEntry(manifestId, pieceIndex, peerId, isVerified = false)
                )
            }
            newMap
        }
    }

    /**
     * A peer is gone. Removing it from the provider map is only half the job: the swarm state that
     * rarity, replication and the health event are read from is a snapshot, so it has to be rebuilt
     * for every manifest the peer was providing. Without that, a peer that simply drops off (out of
     * range, battery, process death) leaves its pieces looking replicated, no repair is scheduled,
     * and the UI keeps showing providers that cannot serve anything.
     */
    fun handlePeerDisconnected(peerId: String) {
        engine.providerMapRepository.removeByProvider(peerId)

        val affected = mutableSetOf<String>()
        for (manifestId in providerMaps.keys) {
            // Rebuilt rather than mutated in place: the sets are also referenced by the published
            // SwarmState, and an in-place edit would both race with readers and depend on `plus`
            // happening to return a mutable set.
            providerMaps.computeIfPresent(manifestId) { _, pieces ->
                if (pieces.none { peerId in it.value }) return@computeIfPresent pieces
                affected.add(manifestId)
                pieces.mapValues { (_, providers) -> providers - peerId }
                    .filterValues { it.isNotEmpty() }
            }
        }

        for (manifestId in affected) recomputeSwarmState(manifestId)
    }

    private fun findRarePieces(manifestId: String, providerMap: Map<Int, Set<String>>, totalPieces: Int): Set<Int> {
        val rarePieces = mutableSetOf<Int>()
        for (pieceIndex in 0 until totalPieces) {
            val providers = providerMap[pieceIndex] ?: emptySet()
            if (providers.size == 1) rarePieces.add(pieceIndex)
        }
        return rarePieces
    }

    private fun findAtRiskPieces(manifestId: String, providerMap: Map<Int, Set<String>>, totalPieces: Int): Set<Int> {
        val atRiskPieces = mutableSetOf<Int>()
        for (pieceIndex in 0 until totalPieces) {
            val providers = providerMap[pieceIndex] ?: emptySet()
            if (providers.isEmpty() || providers.size == 1) {
                atRiskPieces.add(pieceIndex)
            }
        }
        return atRiskPieces
    }

    private fun checkForRarePieces(manifestId: String, peerId: String) {
        val providerMap = providerMaps[manifestId] ?: return
        val manifest = engine.manifestRepository.get(manifestId) ?: return

        val rarePieces = mutableSetOf<Int>()
        for (pieceIndex in 0 until manifest.pieceCount) {
            val providers = providerMap[pieceIndex] ?: continue
            if (providers.size == 1 && providers.contains(peerId)) {
                rarePieces.add(pieceIndex)
            }
        }

        if (rarePieces.isNotEmpty()) {
            engine.swarmListener?.let { listener ->
                for (pieceIndex in rarePieces) {
                    listener.onRarePieceDetected(manifestId, pieceIndex)
                }
            }
            requestReplicationForRarePieces(manifestId, rarePieces)
        }
    }

    private fun requestReplicationForRarePieces(manifestId: String, rarePieces: Set<Int>) {
        if (rarePieces.isNotEmpty()) {
            engine.replicationManager?.replicateRarePieces(manifestId, rarePieces)
        }
    }

    private fun handleDepartureRepair(peerId: String, manifestId: String, rarePieces: Set<Int>) {
        val providerMap = providerMaps[manifestId] ?: return
        for (pieceIndex in rarePieces) {
            val providers = providerMap[pieceIndex] ?: continue
            if (providers.size == 1 && providers.contains(peerId)) {
                requestReplicationForPiece(manifestId, pieceIndex)
            }
        }
    }

    private fun requestReplicationForPiece(manifestId: String, pieceIndex: Int) {
        engine.replicationManager?.replicatePiece(manifestId, pieceIndex)
    }

    private fun notifySwarmHealth(manifestId: String) {
        val state = swarmState[manifestId] ?: return
        val manifest = engine.manifestRepository.get(manifestId) ?: return

        val health = SetuSwarmEngine.SwarmHealth(
            availablePieces = state.availablePieces,
            totalPieces = manifest.pieceCount,
            rarePieces = state.rarePieces,
            atRiskPieces = state.atRiskPieces,
            replicationFactor = state.replicationFactor,
            isComplete = state.availablePieces >= state.totalPieces
        )

        engine.swarmListener?.onSwarmHealthChanged(manifestId, health)
    }

    fun onPlaybackWindowChanged(manifestId: String, startPiece: Int, endPiece: Int) {
        engine.transferManager.setPlaybackWindow(manifestId, startPiece..endPiece)
        Log.d(TAG, "Playback window updated for $manifestId: [$startPiece, $endPiece]")
    }

    fun onPlaybackWindowCleared(manifestId: String) {
        engine.transferManager.setPlaybackWindow(manifestId, null)
        Log.d(TAG, "Playback window cleared for $manifestId")
    }
}
