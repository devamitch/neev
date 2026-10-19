package expo.modules.setunative.network

import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import kotlin.text.Charsets
import android.util.Base64

internal object PeerTransportFrame {
    fun writeFrame(output: DataOutputStream, type: Int, payload: ByteArray) {
        synchronized(output) {
            output.writeInt(payload.size + PeerTransportConstants.APPLICATION_FRAME_HEADER_BYTES)
            output.writeInt(PeerTransportConstants.APPLICATION_FRAME_MAGIC)
            output.writeByte(PeerTransportConstants.APPLICATION_FRAME_VERSION)
            output.writeByte(type)
            output.write(payload)
            output.flush()
        }
    }

    fun writeControlFrame(output: DataOutputStream, type: Int, sequence: Long) {
        val payload = ByteArrayOutputStream().also { bytes ->
            DataOutputStream(bytes).use { it.writeLong(sequence) }
        }.toByteArray()
        writeFrame(output, type, payload)
    }

    fun writeHello(output: DataOutputStream, hello: Hello) {
        output.writeInt(1)
        writeString(output, hello.deviceId, PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
        writeString(output, hello.publicKey, PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
        writeBytes(output, hello.nonce, PeerTransportConstants.NONCE_BYTES)
    }

    fun readHello(input: DataInputStream): Hello {
        if (input.readInt() != 1) throw SecurityException("PROTOCOL_VERSION_UNSUPPORTED")
        val deviceId = readString(input, PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
        if (!deviceId.matches(Regex("[0-9a-f]{32}"))) throw SecurityException("INVALID_PEER_ID")
        val publicKey = readString(input, PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
        val nonce = readBytes(input, PeerTransportConstants.NONCE_BYTES)
        if (nonce.size != PeerTransportConstants.NONCE_BYTES) throw SecurityException("INVALID_NONCE")
        return Hello(deviceId, publicKey, nonce)
    }

    fun createTranscript(initiator: Hello, responder: Hello): ByteArray {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { output ->
            output.write("SETU-SESSION-V1".toByteArray(Charsets.US_ASCII))
            writeString(output, initiator.deviceId, PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
            writeString(output, responder.deviceId, PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
            writeBytes(output, decodeBase64(initiator.publicKey), PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
            writeBytes(output, decodeBase64(responder.publicKey), PeerTransportConstants.HELLO_MAX_TEXT_BYTES)
        }
        return bytes.toByteArray()
    }

    fun writeString(output: DataOutputStream, value: String, maxBytes: Int) {
        writeBytes(output, value.toByteArray(Charsets.UTF_8), maxBytes)
    }

    fun readString(input: DataInputStream, maxBytes: Int): String =
        String(readBytes(input, maxBytes), Charsets.UTF_8)

    fun writeBytes(output: DataOutputStream, value: ByteArray, maxBytes: Int) {
        require(value.size <= maxBytes) { "FRAME_FIELD_TOO_LARGE" }
        output.writeInt(value.size)
        output.write(value)
    }

    fun readBytes(input: DataInputStream, maxBytes: Int): ByteArray {
        val size = input.readInt()
        if (size < 0 || size > maxBytes) throw SecurityException("FRAME_FIELD_TOO_LARGE")
        return ByteArray(size).also(input::readFully)
    }

    fun decodeBase64(value: String): ByteArray =
        Base64.decode(value, Base64.URL_SAFE or Base64.NO_WRAP)

    fun readSignature(input: DataInputStream): String {
        return Base64.encodeToString(
            readBytes(input, PeerTransportConstants.SIGNATURE_MAX_BYTES),
            Base64.URL_SAFE or Base64.NO_WRAP,
        )
    }

    fun writeSignature(output: DataOutputStream, signature: String) {
        writeBytes(output, decodeBase64(signature), PeerTransportConstants.SIGNATURE_MAX_BYTES)
    }
}
