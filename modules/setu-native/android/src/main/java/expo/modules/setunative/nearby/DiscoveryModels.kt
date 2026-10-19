package expo.modules.setunative.nearby

/**
 * A device found on the local network whose advertised identity is self-consistent
 * (device id == first 16 bytes of SHA-256 of the advertised public key). That is "identified";
 * it is not yet authenticated (TLS + pinned key) and not authorized (user confirmed).
 */
data class DiscoveredPeer(
    val id: String,
    val name: String,
    val host: String,
    val port: Int,
    val serviceName: String,
    val publicKey: String,
    internal val pairCode: String? = null,
    /** Where this peer was found. The session and the trust that follow are identical either way. */
    val transport: PeerTransportKind = PeerTransportKind.LAN,
    /** The Wi-Fi Direct MAC needed to invite it; null for a peer found on the local network. */
    val p2pAddress: String? = null,
)

interface DiscoveryCallback {
    fun onPeerDiscovered(peer: DiscoveredPeer)

    fun onPeerLost(peerId: String, serviceName: String)

    /** NSD reported a hard failure after bounded retries; [errorCode] is an NsdManager FAILURE_* code. */
    fun onDiscoveryFailed(errorCode: Int)
}
