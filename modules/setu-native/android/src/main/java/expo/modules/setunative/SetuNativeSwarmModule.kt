package expo.modules.setunative

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.bootstrap.SetuRuntime
import expo.modules.setunative.shared.SetuEvents
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.swarm.DepartureSafety
import expo.modules.setunative.swarm.SwarmCoordinator

/**
 * Swarm-related functions for SetuNative module.
 */
class SetuNativeSwarmModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("SetuNativeSwarm")
        Events("onPieceAvailable", "onPieceRequested", "onPieceServed", "onPieceTransferred",
            "onSwarmHealthChanged", "onDepartureDetected", "onSwarmTransferProgress",
            "onSwarmTransferCompleted", "onSwarmTransferFailed")

        OnCreate { SetuEvents.attach(SetuEvents.SWARM, this@SetuNativeSwarmModule) }

        OnDestroy { SetuEvents.detach(SetuEvents.SWARM, this@SetuNativeSwarmModule) }

        AsyncFunction("startSwarmTransfer") { sessionId: String, manifestId: String ->
            startSwarmTransfer(sessionId, manifestId) }
        AsyncFunction("addLocalPiece") { mId: String, pIndex: Int, pHash: String, sPath: String ->
            addLocalPiece(mId, pIndex, pHash, sPath) }
        AsyncFunction("getSwarmHealth") { mId: String -> getSwarmHealth(mId) }
        AsyncFunction("getSwarmPieceMap") { mId: String -> getSwarmPieceMap(mId) }
        AsyncFunction("setServingEnabled") { enabled: Boolean ->
            SetuRuntime.swarm(getContext()).setServingEnabled(enabled) }
        AsyncFunction("getServingEnabled") { SetuRuntime.swarm(getContext()).isServingEnabled() }
        AsyncFunction("getDepartureSafety") {
            DepartureSafety.evaluate(SetuRuntime.swarm(getContext()))
        }
        AsyncFunction("setPlaybackPriority") { mId: String, pWindow: Map<String, Int>? ->
            setPlaybackPriority(mId, pWindow) }
        AsyncFunction("clearPlaybackPriority") { mId: String -> clearPlaybackPriority(mId) }
    }

    private fun getContext(): Context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context unavailable")

    private fun startSwarmTransfer(sessionId: String, manifestId: String): String {
        val context = getContext()
        val swarmEngine = SetuRuntime.swarm(context)
        val manifest = swarmEngine.manifestRepository.get(manifestId)
            ?: throw IllegalArgumentException("MANIFEST_NOT_FOUND")
        val peerId = SetuPeerTransport.peerIdForSession(sessionId)
            ?: throw IllegalStateException("SESSION_PEER_UNKNOWN")
        return swarmEngine.startSwarmTransfer(manifest, peerId, sessionId)
    }

    private fun addLocalPiece(manifestId: String, pieceIndex: Int, pieceHash: String, storagePath: String): Boolean {
        val context = getContext()
        val swarmEngine = SetuRuntime.swarm(context)
        val pieceHashBytes = android.util.Base64.decode(pieceHash, android.util.Base64.NO_WRAP)
        return swarmEngine.addLocalPiece(manifestId, pieceIndex, pieceHashBytes, storagePath)
    }

    private fun getSwarmHealth(manifestId: String): Map<String, Any> {
        val context = getContext()
        val swarmEngine = SetuRuntime.swarm(context)
        val state = swarmEngine.getSwarmState()[manifestId]
        return if (state != null) {
            // Provider count for every piece of the manifest. A piece absent from providerMap has
            // no known provider, so it counts as zero instead of being skipped.
            val providerCounts = (0 until state.totalPieces).map { state.providerMap[it]?.size ?: 0 }
            mapOf(
                "availablePieces" to state.availablePieces, "totalPieces" to state.totalPieces,
                "rarePieces" to state.rarePieces.toList(), "atRiskPieces" to state.atRiskPieces.toList(),
                // Legacy field: the smallest provider-set size present in providerMap, which is not
                // a general replication factor. Read minimumProviderCount instead.
                "replicationFactor" to (state.providerMap.values.minOfOrNull { it.size } ?: 0),
                "isComplete" to (state.availablePieces >= state.totalPieces),
                "availablePieceCount" to state.availablePieces,
                "totalPieceCount" to state.totalPieces,
                "minimumProviderCount" to (providerCounts.minOrNull() ?: 0),
                "averageProviderCount" to (if (providerCounts.isEmpty()) 0.0 else providerCounts.average()),
                // Pieces held by exactly one provider: losing that peer loses the piece.
                "criticalPieceCount" to providerCounts.count { it == 1 },
                "rarePieceCount" to state.rarePieces.size,
                "atRiskPieceCount" to state.atRiskPieces.size
            )
        } else {
            mapOf("availablePieces" to 0, "totalPieces" to 0, "rarePieces" to emptyList<Int>(),
                "atRiskPieces" to emptyList<Int>(), "replicationFactor" to 0, "isComplete" to false,
                "availablePieceCount" to 0, "totalPieceCount" to 0, "minimumProviderCount" to 0,
                "averageProviderCount" to 0.0, "criticalPieceCount" to 0, "rarePieceCount" to 0,
                "atRiskPieceCount" to 0)
        }
    }

    private fun getSwarmPieceMap(manifestId: String): Map<String, Any>? {
        val engine = SetuRuntime.swarm(getContext())
        val manifest = engine.manifestRepository.get(manifestId) ?: return null
        val limit = minOf(manifest.pieceCount, 512)
        val bitfield = engine.pieceRepository.getBitfield(manifestId, manifest.pieceCount)
        val providers = engine.getSwarmState()[manifestId]?.providerMap.orEmpty()
        val pieces = (0 until limit).map { index ->
            mapOf(
                "index" to index,
                "local" to bitfield[index],
                "peerIds" to providers[index].orEmpty().take(8).toList(),
            )
        }
        return mapOf(
            "manifestId" to manifestId,
            "totalPieces" to manifest.pieceCount,
            "pieces" to pieces,
            "truncated" to (limit < manifest.pieceCount),
        )
    }

    private fun setPlaybackPriority(manifestId: String, playbackWindow: Map<String, Int>?) {
        val context = getContext()
        val swarmEngine = SetuRuntime.swarm(context)
        val start = playbackWindow?.get("start") ?: 0
        val end = playbackWindow?.get("end") ?: Int.MAX_VALUE
        swarmEngine.setPlaybackWindow(manifestId, start, end)
    }

    private fun clearPlaybackPriority(manifestId: String) {
        val context = getContext()
        SetuRuntime.swarm(context).clearPlaybackWindow(manifestId)
    }

}
