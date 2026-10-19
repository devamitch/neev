package expo.modules.setunative.network

import expo.modules.setunative.shared.SetuLog
import java.io.DataInputStream
import java.net.SocketTimeoutException

internal class PeerTransportSessionMonitor(
    private val session: ActiveSession,
    private val sessionManager: PeerTransportSession
) {
    fun run() {
        var missedHeartbeats = 0
        var sequence = 0L
        try {
            val input = DataInputStream(session.socket.inputStream)
            val output = session.output
            while (!session.socket.isClosed) {
                val firstLengthByte = try {
                    input.read()
                } catch (_: SocketTimeoutException) {
                    if (missedHeartbeats >= 3) throw SocketTimeoutException("PEER_HEARTBEAT_TIMEOUT")
                    PeerTransportFrame.writeControlFrame(output, PeerTransportConstants.FRAME_PING, ++sequence)
                    missedHeartbeats += 1
                    continue
                }
                if (firstLengthByte < 0) return
                // Anything at all from the peer proves it is alive. Without this the counter only
                // ever climbed, so a healthy session that answered every ping still died on the
                // fourth read timeout — about 80 seconds of quiet.
                missedHeartbeats = 0

                val remainingLengthBytes = ByteArray(3).also(input::readFully)
                val size = (firstLengthByte shl 24) or
                    ((remainingLengthBytes[0].toInt() and 0xff) shl 16) or
                    ((remainingLengthBytes[1].toInt() and 0xff) shl 8) or
                    (remainingLengthBytes[2].toInt() and 0xff)
                if (size !in PeerTransportConstants.APPLICATION_FRAME_HEADER_BYTES..PeerTransportConstants.MAX_APPLICATION_FRAME_BYTES) {
                    throw SecurityException("INVALID_FRAME_LENGTH")
                }
                if (input.readInt() != PeerTransportConstants.APPLICATION_FRAME_MAGIC || 
                    input.readUnsignedByte() != PeerTransportConstants.APPLICATION_FRAME_VERSION) {
                    throw SecurityException("FRAME_HEADER_INVALID")
                }
                val type = input.readUnsignedByte()
                val payload = ByteArray(size - PeerTransportConstants.APPLICATION_FRAME_HEADER_BYTES)
                input.readFully(payload)
                handleFrame(type, payload, output)
            }
        } catch (error: Exception) {
            // Why a session ended is the difference between a diagnosable drop and a mystery.
            SetuLog.w(
                SetuLog.TRANSPORT,
                "session ${SetuLog.id(session.peer.peerId)} ended: ${error.message ?: error.javaClass.simpleName}",
            )
        } finally {
            sessionManager.removeSession(session)
        }
    }

    private fun handleFrame(type: Int, payload: ByteArray, output: java.io.DataOutputStream) {
        when (type) {
            PeerTransportConstants.FRAME_PING -> {
                if (payload.size != 8) throw SecurityException("INVALID_PING")
                PeerTransportFrame.writeFrame(output, PeerTransportConstants.FRAME_PONG, payload)
            }
            PeerTransportConstants.FRAME_PONG -> {
                if (payload.size != 8) throw SecurityException("INVALID_PONG")
            }
            PeerTransportConstants.FRAME_GOODBYE -> return
            in PeerTransportConstants.TRANSFER_FRAME_TYPES -> {
                if (!sessionManager.isSessionAuthorizedInternal(session.peer.sessionId)) {
                    /*
                     * Both ends authorize independently, so whichever user taps Connect first can
                     * send while this one is still reading the confirmation. The frame is never
                     * processed here — authorization is still the gate — but it is held and
                     * replayed the moment this side authorizes, instead of being dropped. Dropping
                     * it is why the first message or transfer after pairing silently vanished.
                     *
                     * The session survives either way: tearing it down here used to kill the
                     * connection the instant anyone sent something straight after connecting.
                     */
                    if (!sessionManager.holdUnauthorizedFrame(session.peer.sessionId, type, payload)) {
                        SetuLog.w(
                            SetuLog.TRANSPORT,
                            "frame type=$type dropped: pre-authorization hold is full",
                        )
                    }
                    return
                }
                sessionManager.onApplicationFrameHandler?.invoke(session.peer, type, payload)
            }
            else -> throw SecurityException("UNKNOWN_FRAME_TYPE")
        }
    }
}