package expo.modules.setunative.nearby

import android.app.Activity
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Handler
import android.os.Looper
import android.util.Base64
import expo.modules.setunative.security.CryptoIdentityManager
import expo.modules.setunative.shared.SetuLog
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.lang.ref.WeakReference
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

object SetuNfcManager {
    private const val TOKEN_VERSION = 1
    private const val TOKEN_TTL_MS = 30_000L
    private const val INTRODUCTION_WINDOW_MS = 60_000L
    private const val CLOCK_SKEW_MS = 5_000L
    private const val MAX_TOKEN_BYTES = 256
    private const val NONCE_BYTES = 16
    private const val MAX_SEEN_NONCES = 128
    private const val DOMAIN = "SETU-NFC-INTRO-V1\u0000"

    /**
     * Two phones arming the tap are symmetric, and a phone in reader mode does not emulate a card:
     * if both sat in reader mode nothing would ever be discovered. Each phone therefore alternates
     * between reading and listening, with jitter so the two cannot stay in lockstep.
     */
    private const val READER_PHASE_MS = 900L
    private const val LISTEN_PHASE_MS = 1_100L
    private const val PHASE_JITTER_MS = 400L

    private val aid = byteArrayOf(0xF0.toByte(), 0x53, 0x45, 0x54, 0x55, 0x01)
    private val random = SecureRandom()
    private val seenNonces = ConcurrentHashMap<String, Long>()
    private val handler = Handler(Looper.getMainLooper())

    @Volatile
    private var adapter: NfcAdapter? = null

    @Volatile
    private var host: WeakReference<Activity>? = null

    @Volatile
    private var callback: ((IntroducedPeer) -> Unit)? = null

    @Volatile
    private var stateCallback: ((String, String?) -> Unit)? = null

    @Volatile
    private var activeUntil = 0L

    @Volatile
    private var reading = false

    data class IntroducedPeer(val peerId: String, val publicKey: String)

    @Synchronized
    fun start(
        activity: Activity,
        onIntroduced: (IntroducedPeer) -> Unit,
        onState: (String, String?) -> Unit,
    ): String {
        val packageManager = activity.packageManager
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)) {
            return "NFC_UNAVAILABLE"
        }
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)) {
            return "NFC_HCE_UNAVAILABLE"
        }

        val nfcAdapter = NfcAdapter.getDefaultAdapter(activity) ?: return "NFC_UNAVAILABLE"
        if (!nfcAdapter.isEnabled) return "NFC_DISABLED"

        adapter = nfcAdapter
        host = WeakReference(activity)
        callback = onIntroduced
        stateCallback = onState
        activeUntil = System.currentTimeMillis() + INTRODUCTION_WINDOW_MS
        handler.removeCallbacks(readerPhase)
        handler.removeCallbacks(listenPhase)
        handler.post(readerPhase)
        return "READY"
    }

    @Synchronized
    fun stop(activity: Activity?) {
        if (activity != null && host?.get() == null) host = WeakReference(activity)
        finish("STOPPED", null)
    }

    fun exchangeFromHost(readerToken: ByteArray): ByteArray {
        if (!isActive()) throw SecurityException("NFC_INTRODUCTION_NOT_ACTIVE")
        val introducedPeer = try {
            verifyToken(readerToken)
        } catch (error: SecurityException) {
            report("FAILED", error.message)
            throw error
        }
        val response = createToken()
        // The reader still has to read this response, so the window is closed only after it is sent.
        complete(introducedPeer)
        return response
    }

    // ── Reader / listen alternation ──────────────────────────────────────────────

    private val readerPhase: Runnable = Runnable {
        val activity = host?.get()
        val nfcAdapter = adapter
        if (activity == null || nfcAdapter == null) {
            finish("STOPPED", null)
            return@Runnable
        }
        if (!isActive()) {
            finish("EXPIRED", null)
            return@Runnable
        }
        try {
            nfcAdapter.enableReaderMode(
                activity,
                ::onTagDiscovered,
                NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or
                    NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
                null,
            )
            reading = true
        } catch (error: Exception) {
            SetuLog.e(SetuLog.NFC, "reader mode did not start", error)
            finish("FAILED", "NFC_READER_UNAVAILABLE")
            return@Runnable
        }
        handler.postDelayed(listenPhase, READER_PHASE_MS + jitter())
    }

    private val listenPhase: Runnable = Runnable {
        // Reader mode off means this phone emulates the card again, so the other phone can read it.
        disableReader()
        if (!isActive()) {
            finish("EXPIRED", null)
            return@Runnable
        }
        handler.postDelayed(readerPhase, LISTEN_PHASE_MS + jitter())
    }

    private fun jitter(): Long = (random.nextDouble() * PHASE_JITTER_MS).toLong()

    private fun disableReader() {
        if (!reading) return
        reading = false
        val activity = host?.get() ?: return
        val nfcAdapter = adapter ?: return
        try {
            nfcAdapter.disableReaderMode(activity)
        } catch (_: Exception) {
        }
    }

    private fun complete(peer: IntroducedPeer) {
        val introduced = callback
        finish("INTRODUCED", null)
        introduced?.invoke(peer)
    }

    /** Ends the introduction window from any thread and reports the final state once. */
    private fun finish(state: String, reason: String?) {
        var notify: (() -> Unit)? = null
        synchronized(this) {
            val report = stateCallback
            if (report != null) notify = { report(state, reason) }
            callback = null
            stateCallback = null
            activeUntil = 0L
        }
        handler.removeCallbacks(readerPhase)
        handler.removeCallbacks(listenPhase)
        handler.post {
            disableReader()
            adapter = null
            host = null
        }
        notify?.invoke()
    }

    /** A recoverable problem: the window stays open so the next tap can still succeed. */
    private fun report(state: String, reason: String?) {
        stateCallback?.invoke(state, reason)
    }

    fun verifyReaderToken(readerToken: ByteArray): IntroducedPeer = verifyToken(readerToken)

    fun createToken(): ByteArray {
        val identity = CryptoIdentityManager.getOrCreate()
        val publicKey = Base64.decode(identity.publicKeyB64, Base64.URL_SAFE or Base64.NO_WRAP)
        val issuedAt = System.currentTimeMillis()
        val expiresAt = issuedAt + TOKEN_TTL_MS
        val nonce = ByteArray(NONCE_BYTES).also(random::nextBytes)
        val deviceId = hexToBytes(identity.deviceId)

        val unsigned = ByteArrayOutputStream()
        DataOutputStream(unsigned).use { output ->
            output.writeByte(TOKEN_VERSION)
            output.writeLong(issuedAt)
            output.writeLong(expiresAt)
            output.write(nonce)
            output.write(deviceId)
            output.writeByte(publicKey.size)
            output.write(publicKey)
        }
        val payload = unsigned.toByteArray()
        val signature = Base64.decode(
            CryptoIdentityManager.sign(domainSeparated(payload)),
            Base64.URL_SAFE or Base64.NO_WRAP,
        )
        val token = payload + byteArrayOf(signature.size.toByte()) + signature
        require(token.size <= MAX_TOKEN_BYTES) { "NFC_TOKEN_TOO_LARGE" }
        return token
    }

    private fun onTagDiscovered(tag: Tag) {
        if (!isActive()) return
        val isoDep = IsoDep.get(tag)
        if (isoDep == null) {
            report("FAILED", "NFC_TAG_NOT_A_PHONE")
            return
        }
        try {
            isoDep.connect()
            isoDep.timeout = 3_000

            val select = byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00, aid.size.toByte()) + aid + byteArrayOf(0x00)
            if (!isSuccess(isoDep.transceive(select))) {
                report("FAILED", "NFC_SETU_NOT_READY")
                return
            }

            val token = createToken()
            if (token.size > 255) {
                report("FAILED", "NFC_TOKEN_TOO_LARGE")
                return
            }
            val command = byteArrayOf(0x80.toByte(), 0x10, 0x00, 0x00, token.size.toByte()) + token + byteArrayOf(0x00)
            val response = isoDep.transceive(command)
            if (!isSuccess(response) || response.size <= 2 || response.size > MAX_TOKEN_BYTES + 2) {
                // The other phone answered but refused: it is not armed, or it rejected this token.
                report("FAILED", "NFC_INTRODUCTION_REFUSED")
                return
            }

            complete(verifyToken(response.copyOfRange(0, response.size - 2)))
        } catch (error: SecurityException) {
            report("FAILED", error.message)
        } catch (error: Exception) {
            SetuLog.e(SetuLog.NFC, "tap did not complete", error)
            report("FAILED", "NFC_TAP_INTERRUPTED")
        } finally {
            try {
                isoDep.close()
            } catch (_: Exception) {
            }
        }
    }

    private fun verifyToken(token: ByteArray): IntroducedPeer {
        if (token.size !in 1..MAX_TOKEN_BYTES) throw SecurityException("INVALID_NFC_TOKEN_SIZE")
        val input = ByteBuffer.wrap(token).order(ByteOrder.BIG_ENDIAN)
        if (input.get().toInt() != TOKEN_VERSION) throw SecurityException("NFC_VERSION_UNSUPPORTED")
        val issuedAt = input.long
        val expiresAt = input.long
        val nonce = ByteArray(NONCE_BYTES).also(input::get)
        val deviceIdBytes = ByteArray(16).also(input::get)
        val publicKeyLength = input.get().toInt() and 0xff
        if (publicKeyLength !in 1..128 || input.remaining() < publicKeyLength + 1) {
            throw SecurityException("INVALID_NFC_PUBLIC_KEY")
        }
        val publicKeyBytes = ByteArray(publicKeyLength).also(input::get)
        val signatureLength = input.get().toInt() and 0xff
        if (signatureLength !in 1..80 || input.remaining() != signatureLength) {
            throw SecurityException("INVALID_NFC_SIGNATURE")
        }
        val signatureBytes = ByteArray(signatureLength).also(input::get)
        val payloadLength = token.size - signatureLength - 1
        val payload = token.copyOfRange(0, payloadLength)
        val now = System.currentTimeMillis()
        if (issuedAt > now + CLOCK_SKEW_MS || expiresAt < now || expiresAt - issuedAt !in 1..TOKEN_TTL_MS) {
            throw SecurityException("NFC_TOKEN_EXPIRED")
        }

        val publicKey = Base64.encodeToString(publicKeyBytes, Base64.URL_SAFE or Base64.NO_WRAP)
        val expectedDeviceId = MessageDigest.getInstance("SHA-256")
            .digest(publicKeyBytes)
            .copyOfRange(0, 16)
        if (!MessageDigest.isEqual(expectedDeviceId, deviceIdBytes)) {
            throw SecurityException("NFC_IDENTITY_MISMATCH")
        }
        val signature = Base64.encodeToString(signatureBytes, Base64.URL_SAFE or Base64.NO_WRAP)
        if (!CryptoIdentityManager.verify(domainSeparated(payload), signature, publicKey)) {
            throw SecurityException("NFC_SIGNATURE_INVALID")
        }

        pruneNonces(now)
        val nonceKey = bytesToHex(deviceIdBytes) + bytesToHex(nonce)
        if (seenNonces.putIfAbsent(nonceKey, expiresAt) != null) {
            throw SecurityException("NFC_REPLAY_DETECTED")
        }
        if (seenNonces.size > MAX_SEEN_NONCES) {
            seenNonces.remove(nonceKey)
            throw SecurityException("NFC_REPLAY_CACHE_FULL")
        }

        return IntroducedPeer(bytesToHex(deviceIdBytes), publicKey)
    }

    private fun pruneNonces(now: Long) {
        seenNonces.entries.removeIf { it.value < now }
    }

    private fun isActive(): Boolean = System.currentTimeMillis() < activeUntil

    private fun domainSeparated(payload: ByteArray): ByteArray =
        DOMAIN.toByteArray(Charsets.US_ASCII) + payload

    private fun isSuccess(response: ByteArray): Boolean =
        response.size >= 2 && response[response.size - 2] == 0x90.toByte() && response.last() == 0x00.toByte()

    private fun hexToBytes(value: String): ByteArray =
        value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    private fun bytesToHex(value: ByteArray): String =
        value.joinToString("") { "%02x".format(it) }
}
