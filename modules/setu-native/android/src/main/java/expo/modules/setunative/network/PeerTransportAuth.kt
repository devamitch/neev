package expo.modules.setunative.network

import expo.modules.setunative.security.CryptoIdentityManager
import java.io.DataInputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.SSLSocket
import java.util.UUID

internal object PeerTransportAuth {
    private val random = SecureRandom()

    fun authenticate(
        socket: SSLSocket,
        expectedPeerId: String?,
        expectedPublicKey: String?,
        initiator: Boolean,
    ): PeerSession {
        val identity = CryptoIdentityManager.getOrCreate()
        val localHello = Hello(
            identity.deviceId,
            identity.publicKeyB64,
            ByteArray(PeerTransportConstants.NONCE_BYTES).also(random::nextBytes)
        )
        val input = DataInputStream(socket.inputStream)
        val output = DataOutputStream(socket.outputStream)

        PeerTransportFrame.writeHello(output, localHello)
        output.flush()
        val remoteHello = PeerTransportFrame.readHello(input)

        if (deviceIdForPublicKey(remoteHello.publicKey) != remoteHello.deviceId) {
            throw SecurityException("PEER_IDENTITY_MISMATCH")
        }
        if (expectedPeerId != null && remoteHello.deviceId != expectedPeerId) {
            throw SecurityException("UNEXPECTED_PEER")
        }
        if (expectedPublicKey != null && remoteHello.publicKey != expectedPublicKey) {
            throw SecurityException("DISCOVERY_KEY_MISMATCH")
        }

        val certificate = socket.session.peerCertificates.firstOrNull() as? X509Certificate
            ?: throw SecurityException("PEER_CERTIFICATE_MISSING")
        val remoteKeyBytes = PeerTransportFrame.decodeBase64(remoteHello.publicKey)
        if (!MessageDigest.isEqual(certificate.publicKey.encoded, remoteKeyBytes)) {
            throw SecurityException("TLS_IDENTITY_MISMATCH")
        }

        val initiatorHello = if (initiator) localHello else remoteHello
        val responderHello = if (initiator) remoteHello else localHello
        val transcript = PeerTransportFrame.createTranscript(initiatorHello, responderHello)
        val localSignature = CryptoIdentityManager.sign(transcript)
        PeerTransportFrame.writeSignature(output, localSignature)
        output.flush()

        val remoteSignature = PeerTransportFrame.readSignature(input)
        if (!CryptoIdentityManager.verify(transcript, remoteSignature, remoteHello.publicKey)) {
            throw SecurityException("PEER_SIGNATURE_INVALID")
        }

        val verificationCode = MessageDigest.getInstance("SHA-256")
            .digest(transcript)
            .take(4)
            .fold(0L) { value, byte -> (value shl 8) or (byte.toLong() and 0xff) }
            .rem(1_000_000)
            .toString()
            .padStart(6, '0')
        return PeerSession(
            UUID.randomUUID().toString(),
            remoteHello.deviceId,
            remoteHello.publicKey,
            verificationCode,
        )
    }

    fun authenticateIncoming(socket: java.net.Socket): PeerSession {
        var secureSocket: SSLSocket? = null
        try {
            secureSocket = PeerTransportTls.getTlsContext().socketFactory.createSocket(
                socket,
                socket.inetAddress.hostAddress,
                socket.port,
                true,
            ) as SSLSocket
            secureSocket.useClientMode = false
            secureSocket.needClientAuth = true
            secureSocket.enabledProtocols = PeerTransportTls.supportedTlsProtocols(secureSocket.supportedProtocols)
            secureSocket.soTimeout = PeerTransportConstants.SOCKET_TIMEOUT_MS
            secureSocket.startHandshake()

            val peer = authenticate(secureSocket, null, null, initiator = false)
            secureSocket = null
            return peer
        } catch (_: Exception) {
            try {
                secureSocket?.close() ?: socket.close()
            } catch (_: Exception) {
            }
            throw SecurityException("INCOMING_AUTH_FAILED")
        }
    }

    fun deviceIdForPublicKey(publicKey: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(PeerTransportFrame.decodeBase64(publicKey))
        return digest.take(16).joinToString("") { "%02x".format(it) }
    }

    fun generateVerificationCode(transcript: ByteArray): String {
        return MessageDigest.getInstance("SHA-256")
            .digest(transcript)
            .take(4)
            .fold(0L) { value, byte -> (value shl 8) or (byte.toLong() and 0xff) }
            .rem(1_000_000)
            .toString()
            .padStart(6, '0')
    }
}
