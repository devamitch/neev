package expo.modules.setunative.swarm

import android.util.Log
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.network.SetuSwarmProtocol

class PieceAvailabilityBroadcaster(private val engine: SetuSwarmEngine) {

    /**
     * Tells one freshly authorized peer everything this device can already serve.
     *
     * [broadcast] only runs when a piece is newly verified here, so two devices that each already
     * held content learned nothing about each other on connecting: both provider maps stayed empty
     * and no swarm transfer was possible. A session starts with an inventory exchange instead.
     */
    fun advertiseInventory(sessionId: String) {
        if (!SetuPeerTransport.isSessionAuthorized(sessionId)) return
        for (manifest in engine.manifestRepository.getAll()) {
            val bitfield = engine.pieceRepository.getBitfield(manifest.manifestId, manifest.pieceCount)
            if (bitfield.isEmpty) continue
            try {
                SetuPeerTransport.sendFrame(
                    sessionId,
                    SetuSwarmProtocol.FRAME_HAVE,
                    SetuSwarmProtocol.createHaveMessage(manifest.manifestId, bitfield),
                )
            } catch (error: Exception) {
                Log.w("SETU_PIECE", "Failed to advertise ${manifest.manifestId}", error)
            }
        }
    }

    fun broadcast(manifestId: String) {
        val manifest = engine.manifestRepository.get(manifestId) ?: return
        val bitfield = engine.pieceRepository.getBitfield(manifestId, manifest.pieceCount)
        val payload = SetuSwarmProtocol.createHaveMessage(manifestId, bitfield)
        for (peer in engine.peerRepository.getConnected()) {
            val sessionId = peer.sessionId ?: continue
            if (!SetuPeerTransport.isSessionAuthorized(sessionId)) continue
            try {
                SetuPeerTransport.sendFrame(sessionId, SetuSwarmProtocol.FRAME_HAVE, payload)
            } catch (error: Exception) {
                Log.w("SETU_PIECE", "Failed to advertise pieces to ${peer.peerId}", error)
            }
        }
    }
}
