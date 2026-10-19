package expo.modules.setunative.nearby

import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Handler
import expo.modules.setunative.shared.SetuLog
import java.net.Inet4Address
import java.security.MessageDigest
import android.util.Base64

/**
 * Resolves found NSD services one at a time (before Android 14 a second parallel resolve fails
 * with FAILURE_ALREADY_ACTIVE and the peer would be silently lost) and turns each resolved service
 * into a validated [DiscoveredPeer]. Runs entirely on [handler]'s thread.
 */
internal class DiscoveryResolver(
    private val nsd: NsdManager,
    private val handler: Handler,
    private val ownDeviceId: () -> String?,
    private val onPeer: (DiscoveredPeer) -> Unit,
) {
    private class Pending(val info: NsdServiceInfo, var attempts: Int = 0)

    private val queue = ArrayDeque<Pending>()
    private var resolving = false
    private var closed = false

    fun enqueue(info: NsdServiceInfo) {
        if (closed) return
        if (queue.any { it.info.serviceName == info.serviceName }) return
        queue.addLast(Pending(info))
        resolveNext()
    }

    fun close() {
        closed = true
        queue.clear()
    }

    private fun resolveNext() {
        if (closed || resolving) return
        val pending = queue.removeFirstOrNull() ?: return
        resolving = true
        try {
            @Suppress("DEPRECATION")
            nsd.resolveService(
                pending.info,
                object : NsdManager.ResolveListener {
                    override fun onServiceResolved(resolved: NsdServiceInfo) {
                        handler.post {
                            resolving = false
                            if (!closed) handleResolved(resolved)
                            resolveNext()
                        }
                    }

                    override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                        handler.post {
                            resolving = false
                            retryOrDrop(pending, errorCode)
                            resolveNext()
                        }
                    }
                },
            )
        } catch (error: Exception) {
            resolving = false
            SetuLog.w(SetuLog.NEARBY, "resolve could not start: ${error.javaClass.simpleName}")
            handler.postDelayed({ resolveNext() }, DiscoveryConstants.RESOLVE_RETRY_DELAY_MS)
        }
    }

    private fun retryOrDrop(pending: Pending, errorCode: Int) {
        pending.attempts++
        if (!closed && pending.attempts < DiscoveryConstants.MAX_RESOLVE_ATTEMPTS) {
            SetuLog.i(SetuLog.NEARBY, "resolve retry code=$errorCode attempt=${pending.attempts}")
            handler.postDelayed(
                {
                    if (!closed) {
                        queue.addLast(pending)
                        resolveNext()
                    }
                },
                DiscoveryConstants.RESOLVE_RETRY_DELAY_MS * pending.attempts,
            )
        } else {
            SetuLog.w(SetuLog.NEARBY, "resolve dropped code=$errorCode")
        }
    }

    private fun handleResolved(resolved: NsdServiceInfo) {
        val attributes = resolved.attributes
        fun text(key: String): String? = attributes[key]?.toString(Charsets.UTF_8)?.takeIf(String::isNotBlank)

        val deviceId = text(DiscoveryConstants.ATTRIBUTE_DEVICE_ID)
        val publicKey = text(DiscoveryConstants.ATTRIBUTE_PUBLIC_KEY)
        if (deviceId == null || publicKey == null || !deviceId.matches(DEVICE_ID)) {
            SetuLog.w(SetuLog.NEARBY, "ignored service without a valid identity")
            return
        }
        if (!identityMatches(deviceId, publicKey)) {
            SetuLog.w(SetuLog.NEARBY, "ignored service: advertised id does not match its key (${SetuLog.id(deviceId)})")
            return
        }
        if (deviceId == ownDeviceId()) return // our own advertisement

        val host = preferredHost(resolved) ?: return
        val name = text(DiscoveryConstants.ATTRIBUTE_DEVICE_NAME) ?: SetuLog.id(deviceId)
        onPeer(
            DiscoveredPeer(
                id = deviceId,
                name = name.take(DiscoveryConstants.MAX_DEVICE_NAME_LENGTH),
                host = host,
                port = resolved.port,
                serviceName = resolved.serviceName,
                publicKey = publicKey,
                pairCode = text(DiscoveryConstants.ATTRIBUTE_PAIR_CODE)?.takeIf { it.matches(PAIR_CODE) },
            ),
        )
    }

    private fun preferredHost(resolved: NsdServiceInfo): String? {
        if (Build.VERSION.SDK_INT >= 34) {
            val addresses = resolved.hostAddresses
            return (addresses.firstOrNull { it is Inet4Address } ?: addresses.firstOrNull())?.hostAddress
        }
        @Suppress("DEPRECATION")
        return resolved.host?.hostAddress
    }

    private fun identityMatches(deviceId: String, publicKeyB64: String): Boolean = try {
        val der = Base64.decode(publicKeyB64, Base64.URL_SAFE or Base64.NO_WRAP)
        val digest = MessageDigest.getInstance("SHA-256").digest(der)
        digest.take(16).joinToString("") { "%02x".format(it) } == deviceId
    } catch (_: IllegalArgumentException) {
        false
    }

    private companion object {
        val DEVICE_ID = Regex("^[0-9a-f]{32}$")
        val PAIR_CODE = Regex("^\\d{6}$")
    }
}
