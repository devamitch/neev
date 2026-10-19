package expo.modules.setunative.network

import java.io.DataOutputStream
import javax.net.ssl.SSLSocket

class PeerSession(
    val sessionId: String,
    val peerId: String,
    val publicKey: String,
    val verificationCode: String,
)

internal data class Hello(
    val deviceId: String,
    val publicKey: String,
    val nonce: ByteArray,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Hello
        if (deviceId != other.deviceId) return false
        if (publicKey != other.publicKey) return false
        if (!nonce.contentEquals(other.nonce)) return false
        return true
    }

    override fun hashCode(): Int {
        var result = deviceId.hashCode()
        result = 31 * result + publicKey.hashCode()
        result = 31 * result + nonce.contentHashCode()
        return result
    }
}

internal data class ActiveSession(
    val peer: PeerSession,
    val socket: SSLSocket,
    val output: DataOutputStream,
)