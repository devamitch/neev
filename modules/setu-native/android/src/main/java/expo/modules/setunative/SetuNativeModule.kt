package expo.modules.setunative

import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.bootstrap.SetuRuntime
import expo.modules.setunative.models.TrustState
import expo.modules.setunative.persistence.PeerRepository
import expo.modules.setunative.identity.ProfilePrivacyService
import expo.modules.setunative.nearby.DiscoveredPeer
import expo.modules.setunative.nearby.DiscoveryCallback
import expo.modules.setunative.nearby.NearbyController
import expo.modules.setunative.nearby.RadioController
import expo.modules.setunative.nearby.SetuDiscoveryManager
import expo.modules.setunative.nearby.SetuNfcManager
import expo.modules.setunative.network.SetuFileTransferManager
import expo.modules.setunative.network.SetuPeerTransport
import expo.modules.setunative.security.BiometricAuthManager
import expo.modules.setunative.security.CryptoIdentityManager
import expo.modules.setunative.security.IdentityVault
import expo.modules.setunative.shared.SetuEvents
import expo.modules.setunative.shared.SetuLog
import expo.modules.setunative.ui.SecureScreenHelper

/**
 * Core bridge: identity, vault, nearby discovery, sessions, direct transfers, NFC introduction and
 * radio state. It only forwards commands; the long-lived services live in SetuRuntime, which JS
 * starts once the app reaches READY.
 */
class SetuNativeModule : Module() {

    private val discoveryCallback = object : DiscoveryCallback {
        override fun onPeerDiscovered(peer: DiscoveredPeer) {
            sendEvent(
                "onPeerDiscovered",
                mapOf(
                    "id" to peer.id,
                    "name" to peer.name,
                    "host" to peer.host,
                    "port" to peer.port,
                    "serviceName" to peer.serviceName,
                    "publicKey" to peer.publicKey,
                    "transport" to peer.transport.name,
                ),
            )
        }

        override fun onPeerLost(peerId: String, serviceName: String) {
            sendEvent("onPeerLost", mapOf("id" to peerId, "serviceName" to serviceName))
        }

        override fun onDiscoveryFailed(errorCode: Int) {
            sendEvent("onDiscoveryFailed", mapOf("errorCode" to errorCode))
        }
    }

    override fun definition() = ModuleDefinition {
        Name("SetuNative")

        Events(
            "onPeerDiscovered",
            "onPeerLost",
            "onDiscoveryFailed",
            "onPeerAuthenticated",
            "onPeerDisconnected",
            "onNfcPeerIntroduced",
            "onNfcIntroductionStateChanged",
            "onIncomingTransferOffer",
            "onTransferStarted",
            "onTransferProgress",
            "onTransferCompleted",
            "onTransferFailed",
            "onNotificationReply",
            "onNotificationMarkRead",
            "onNotificationAcceptRequest",
            "onNotificationDeclineRequest",
            "onRadioStateChanged",
            "onNearbyStateChanged",
            "onIntentReceived"
        )

        OnCreate {
            // Marker only: no subsystem starts here. The runtime starts when the app reaches READY.
            SetuLog.i(SetuLog.BOOT, "bridge attached, runtime started=${SetuRuntime.isStarted()}")
            SetuEvents.attach(SetuEvents.CORE, this@SetuNativeModule)
            NearbyController.addPeerCallback(discoveryCallback)
        }

        OnDestroy {
            NearbyController.removePeerCallback(discoveryCallback)
            SetuEvents.detach(SetuEvents.CORE, this@SetuNativeModule)
        }
        
        OnNewIntent { intent ->
            if (intent.action == android.content.Intent.ACTION_SEND) {
                val uri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra<android.net.Uri>(android.content.Intent.EXTRA_STREAM)
                }
                sendEvent("onIntentReceived", mapOf(
                    "action" to intent.action,
                    "type" to intent.type,
                    "uris" to if (uri != null) listOf(uri.toString()) else emptyList<String>()
                ))
            } else if (intent.action == android.content.Intent.ACTION_SEND_MULTIPLE) {
                val uris = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableArrayListExtra<android.net.Uri>(android.content.Intent.EXTRA_STREAM)
                }
                sendEvent("onIntentReceived", mapOf(
                    "action" to intent.action,
                    "type" to intent.type,
                    "uris" to (uris?.map { it.toString() } ?: emptyList<String>())
                ))
            } else if (intent.action == android.content.Intent.ACTION_VIEW && intent.scheme == "magnet") {
                sendEvent("onIntentReceived", mapOf(
                    "action" to intent.action,
                    "magnet" to intent.data?.toString()
                ))
            }
        }

        Function("ping") { "Setu native Android bridge is alive" }

        // ── Runtime lifecycle ────────────────────────────────────────────────

        /** Called once the app state machine reaches READY. Idempotent. */
        AsyncFunction("startRuntime") { deviceName: String? ->
            SetuRuntime.start(context(), deviceName)
        }

        AsyncFunction("stopRuntime") {
            SetuRuntime.stop()
            true
        }

        Function("isRuntimeStarted") { SetuRuntime.isStarted() }

        AsyncFunction("getInitialShareIntent") {
            val intent = appContext.currentActivity?.intent
            if (intent?.action == android.content.Intent.ACTION_SEND) {
                val uri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra<android.net.Uri>(android.content.Intent.EXTRA_STREAM)
                }
                mapOf(
                    "action" to intent.action,
                    "type" to intent.type,
                    "uris" to if (uri != null) listOf(uri.toString()) else emptyList<String>()
                )
            } else if (intent?.action == android.content.Intent.ACTION_SEND_MULTIPLE) {
                val uris = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableArrayListExtra<android.net.Uri>(android.content.Intent.EXTRA_STREAM)
                }
                mapOf(
                    "action" to intent.action,
                    "type" to intent.type,
                    "uris" to (uris?.map { it.toString() } ?: emptyList<String>())
                )
            } else if (intent?.action == android.content.Intent.ACTION_VIEW && intent.scheme == "magnet") {
                mapOf(
                    "action" to intent.action,
                    "magnet" to intent.data?.toString()
                )
            } else null
        }

        // ── Identity and vault ───────────────────────────────────────────────

        AsyncFunction("getCryptoIdentity") {
            val identity = CryptoIdentityManager.getOrCreate()
            mapOf("deviceId" to identity.deviceId, "publicKey" to identity.publicKeyB64)
        }

        Function("isCryptoIdentityInitialized") { CryptoIdentityManager.isInitialized() }

        AsyncFunction("signPayload") { payloadBase64: String ->
            CryptoIdentityManager.sign(decodeUrlSafe(payloadBase64))
        }

        AsyncFunction("verifyPeerSignature") { payloadBase64: String, signature: String, publicKey: String ->
            CryptoIdentityManager.verify(decodeUrlSafe(payloadBase64), signature, publicKey)
        }

        AsyncFunction("destroyCryptoIdentity") {
            CryptoIdentityManager.destroy()
            true
        }

        AsyncFunction("initVault") { json: String ->
            IdentityVault.writeVault(context(), json)
            true
        }

        AsyncFunction("readVault") { IdentityVault.readVault(context()) }

        AsyncFunction("updateVault") { json: String ->
            IdentityVault.writeVault(context(), json)
            true
        }

        Function("isVaultInitialized") {
            val ctx = appContext.reactContext ?: return@Function false
            IdentityVault.vaultExists(ctx) && IdentityVault.isKeyPresent()
        }

        AsyncFunction("destroyVault") {
            SetuRuntime.stop()
            IdentityVault.destroyVault(context())
            true
        }

        // ── Nearby ───────────────────────────────────────────────────────────

        /** Scanning runs only while the Nearby screen is focused; advertising stays on. */
        AsyncFunction("setNearbyScanning") { enabled: Boolean ->
            NearbyController.setScanning(enabled)
            NearbyController.snapshot().toMap()
        }

        AsyncFunction("getNearbyState") { NearbyController.snapshot().toMap() }

        AsyncFunction("getDiscoveredPeers") {
            NearbyController.peers().map {
                mapOf(
                    "id" to it.id,
                    "name" to it.name,
                    "host" to it.host,
                    "port" to it.port,
                    "serviceName" to it.serviceName,
                    "publicKey" to it.publicKey,
                    "transport" to it.transport.name,
                )
            }
        }

        AsyncFunction("refreshNearby") {
            NearbyController.setScanning(false)
            NearbyController.setScanning(true)
            NearbyController.snapshot().toMap()
        }

        // ── Radios and system settings ───────────────────────────────────────

        AsyncFunction("getRadioState") { RadioController.snapshot(context()).toMap() }

        /** Opens the exact system screen for nfc / wifi / location / app / battery. */
        AsyncFunction("openRadioSettings") { kind: String ->
            RadioController.openSettings(context(), appContext.currentActivity, kind)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("refreshRadioState") {
            RadioController.refresh()
            RadioController.snapshot(context()).toMap()
        }

        // ── Sessions ─────────────────────────────────────────────────────────

        AsyncFunction("connectToPeer") { peerId: String, publicKey: String, host: String, port: Int ->
            val peer = SetuPeerTransport.connect(peerId, publicKey, host, port)
            // The dialling side records its own peer: the authenticated callback only fires for
            // connections this device answered.
            SetuRuntime.recordAuthenticatedSession(context(), peer)
            mapOf(
                "sessionId" to peer.sessionId,
                "peerId" to peer.peerId,
                "publicKey" to peer.publicKey,
                "verificationCode" to peer.verificationCode,
            )
        }

        /**
         * Connects to a typed address when discovery cannot see the peer — a Wi-Fi with client
         * isolation, two different subnets, or an OEM that breaks mDNS. The identity is still
         * proven by TLS and the signed transcript; the session is unauthorised until the user
         * confirms the verification code matches on both phones.
         */
        /** This device's own address, so the other phone can type it in. Null until the server is up. */
        AsyncFunction("getLocalEndpoint") { NearbyController.localEndpoint() }

        AsyncFunction("connectToAddress") { host: String, port: Int ->
            val peer = SetuPeerTransport.connect(null, null, host, port)
            SetuRuntime.recordAuthenticatedSession(context(), peer)
            mapOf(
                "sessionId" to peer.sessionId,
                "peerId" to peer.peerId,
                "publicKey" to peer.publicKey,
                "verificationCode" to peer.verificationCode,
            )
        }

        /**
         * Forms a Wi-Fi Direct group with a peer found that way, then dials the transport over it.
         * When this phone ends up as the group owner there is nothing to dial: the other side
         * connects, and the session surfaces through onPeerAuthenticated like any other.
         */
        AsyncFunction("connectOverWifiDirect") { peerId: String, promise: Promise ->
            NearbyController.connectOverWifiDirect(peerId) { link, error ->
                if (link == null) {
                    promise.reject(CodedException(error ?: "WIFI_DIRECT_FAILED"))
                    return@connectOverWifiDirect
                }
                if (link.host == null) {
                    // Group owner: wait for the invitation to be accepted and the peer to dial in.
                    promise.resolve(mapOf("waiting" to true, "peerId" to link.peerId))
                    return@connectOverWifiDirect
                }
                try {
                    val publicKey = NearbyController.peers().firstOrNull { it.id == link.peerId }?.publicKey
                    val peer = SetuPeerTransport.connect(link.peerId, publicKey, link.host, link.port)
                    SetuRuntime.recordAuthenticatedSession(context(), peer)
                    promise.resolve(
                        mapOf(
                            "waiting" to false,
                            "sessionId" to peer.sessionId,
                            "peerId" to peer.peerId,
                            "publicKey" to peer.publicKey,
                            "verificationCode" to peer.verificationCode,
                        ),
                    )
                } catch (failure: Exception) {
                    SetuLog.e(SetuLog.TRANSPORT, "wifi direct dial failed", failure)
                    promise.reject(CodedException(failure.message ?: "WIFI_DIRECT_DIAL_FAILED"))
                }
            }
        }

        AsyncFunction("leaveWifiDirectGroup") {
            NearbyController.leaveWifiDirectGroup()
            true
        }

        AsyncFunction("getWifiDirectState") { NearbyController.wifiDirectState(context()) }

        AsyncFunction("authorizePeerSession") { sessionId: String ->
            val authorized = SetuPeerTransport.authorizeSession(sessionId)
            if (authorized) {
                SetuPeerTransport.peerIdForSession(sessionId)?.let { peerId ->
                    SetuFileTransferManager.resumeOutgoing(sessionId, peerId)
                    SetuRuntime.onPeerAuthorized(peerId)
                }
            }
            authorized
        }

        AsyncFunction("closePeerSession") { sessionId: String -> SetuPeerTransport.closeSession(sessionId) }

        /**
         * Devices this phone has paired with before, whether or not they are nearby right now.
         * Discovery only reports who is advertising this second; this is the durable list the
         * share sheet and Nearby show so a known device does not disappear when it goes quiet.
         */
        AsyncFunction("getKnownPeers") {
            PeerRepository.create(context()).getAll()
                .filter { !it.isBlocked && it.trustState != TrustState.BLOCKED }
                .sortedByDescending { it.lastSeenAt }
                .map { peer ->
                    mapOf(
                        "peerId" to peer.peerId,
                        "displayName" to peer.displayName,
                        "trustState" to peer.trustState.name,
                        "lastSeenAt" to peer.lastSeenAt,
                        "publicKey" to peer.publicKey,
                        "host" to peer.endpoint,
                        "port" to peer.port,
                        // Reachability is the live session, never the stored row.
                        "sessionId" to peer.sessionId?.takeIf { SetuPeerTransport.isSessionAuthorized(it) },
                    )
                }
        }

        /** Removes a device from the saved list. Its pieces and messages are untouched. */
        AsyncFunction("forgetPeer") { peerId: String ->
            PeerRepository.create(context()).delete(peerId)
        }

        // ── Pair by code ─────────────────────────────────────────────────────

        AsyncFunction("createPairCode") { SetuDiscoveryManager.createPairCode(context()) }

        AsyncFunction("stopPairCode") { code: String ->
            SetuDiscoveryManager.stopPairCode(context(), code)
            true
        }

        AsyncFunction("redeemPairCode") { code: String -> SetuDiscoveryManager.redeemPairCode(context(), code) }

        // ── Direct transfer ──────────────────────────────────────────────────

        AsyncFunction("startFileTransfer") { sessionId: String, sourceUri: String, fileName: String, mimeType: String ->
            SetuFileTransferManager.startOutgoing(sessionId, Uri.parse(sourceUri), fileName, mimeType)
        }

        AsyncFunction("acceptIncomingTransfer") { transferId: String ->
            SetuFileTransferManager.acceptIncoming(transferId)
        }

        AsyncFunction("declineIncomingTransfer") { transferId: String ->
            SetuFileTransferManager.declineIncoming(transferId)
        }

        AsyncFunction("cancelTransfer") { transferId: String -> SetuFileTransferManager.cancelTransfer(transferId) }

        // ── NFC introduction (never bulk transport) ──────────────────────────

        AsyncFunction("startNfcIntroduction") {
            val activity = appContext.currentActivity ?: throw IllegalStateException("NO_ACTIVE_ACTIVITY")
            SetuNfcManager.start(
                activity,
                onIntroduced = { peer ->
                    SetuLog.i(SetuLog.NFC, "introduced peer=${SetuLog.id(peer.peerId)}")
                    val conflict = !recordIntroduction(peer.peerId, peer.publicKey)
                    if (conflict) {
                        sendEvent(
                            "onNfcIntroductionStateChanged",
                            mapOf("state" to "FAILED", "reason" to "NFC_IDENTITY_CONFLICT"),
                        )
                    } else {
                        sendEvent(
                            "onNfcPeerIntroduced",
                            mapOf("peerId" to peer.peerId, "publicKey" to peer.publicKey),
                        )
                    }
                },
                onState = { state, reason ->
                    SetuLog.i(SetuLog.NFC, "introduction state=$state reason=${reason ?: "-"}")
                    sendEvent(
                        "onNfcIntroductionStateChanged",
                        mapOf("state" to state, "reason" to reason),
                    )
                },
            )
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("stopNfcIntroduction") {
            SetuNfcManager.stop(appContext.currentActivity)
            true
        }.runOnQueue(Queues.MAIN)

        // ── Profile ──────────────────────────────────────────────────────────

        AsyncFunction("getProfile") { profilePrivacyService().getProfile() }

        AsyncFunction("updateProfile") { displayName: String, phone: String?, email: String?, visibility: String ->
            profilePrivacyService().updateProfile(displayName, phone, email, visibility)
        }

        AsyncFunction("getProfileVisibility") { profilePrivacyService().getProfileVisibility() }

        AsyncFunction("setProfileVisibility") { visibility: String ->
            profilePrivacyService().setProfileVisibility(visibility)
        }

        AsyncFunction("setPeerProfileVisibility") { peerId: String, visibility: String ->
            profilePrivacyService().setPeerVisibility(peerId, visibility)
        }

        // ── Screen security ──────────────────────────────────────────────────

        AsyncFunction("setSecureScreen") { secure: Boolean ->
            SecureScreenHelper.setSecure(appContext.currentActivity, secure)
            true
        }.runOnQueue(Queues.MAIN)

        Function("getBiometricCapability") {
            val ctx = appContext.reactContext ?: return@Function "NONE"
            when (BiometricAuthManager.getCapability(ctx)) {
                BiometricAuthManager.BiometricCapability.STRONG_BIOMETRIC -> "STRONG_BIOMETRIC"
                BiometricAuthManager.BiometricCapability.DEVICE_CREDENTIAL -> "DEVICE_CREDENTIAL"
                BiometricAuthManager.BiometricCapability.NONE -> "NONE"
            }
        }
    }

    companion object {
        fun onNotificationReply(conversationId: String, text: String?) = SetuEvents.emit(
            SetuEvents.CORE,
            "onNotificationReply",
            mapOf("conversationId" to conversationId, "text" to (text ?: "")),
        )

        fun onNotificationMarkRead(conversationId: String) = SetuEvents.emit(
            SetuEvents.CORE,
            "onNotificationMarkRead",
            mapOf("conversationId" to conversationId),
        )

        fun onNotificationAcceptRequest(transferId: String) {
            val accepted = SetuFileTransferManager.acceptIncoming(transferId)
            SetuEvents.emit(
                SetuEvents.CORE,
                "onNotificationAcceptRequest",
                mapOf("transferId" to transferId, "accepted" to accepted),
            )
        }

        fun onNotificationDeclineRequest(transferId: String) {
            val declined = SetuFileTransferManager.declineIncoming(transferId)
            SetuEvents.emit(
                SetuEvents.CORE,
                "onNotificationDeclineRequest",
                mapOf("transferId" to transferId, "declined" to declined),
            )
        }
    }

    /**
     * Records what the tap proved, durably.
     *
     * A tap is the strongest trust signal Setu has: the token is signed, replay-protected and
     * bound to an identity derived from the key it carries. That was being handed to JS as an
     * event and nowhere else, so it lived in one screen's memory and was gone the moment the
     * screen was left — the connect step could not tell a tapped identity from a discovered one,
     * and `TrustState.INTRODUCED` was never written by anything.
     *
     * An introduction only raises trust. A peer already authenticated or authorized keeps the
     * state it earned, and a stored key that disagrees with the tapped one is a conflict, not an
     * update: returning false says so rather than overwriting the identity on this device.
     */
    private fun recordIntroduction(peerId: String, publicKey: String): Boolean {
        return try {
            val repository = PeerRepository.create(context())
            val existing = repository.get(peerId)
            if (existing?.publicKey != null && existing.publicKey != publicKey) {
                SetuLog.w(SetuLog.NFC, "tapped key differs from stored peer=${SetuLog.id(peerId)}")
                return false
            }
            val introduced = existing?.copy(
                publicKey = publicKey,
                trustState = if (existing.trustState == TrustState.DISCOVERED ||
                    existing.trustState == TrustState.DISCONNECTED
                ) {
                    TrustState.INTRODUCED
                } else {
                    existing.trustState
                },
                lastSeenAt = System.currentTimeMillis(),
            ) ?: expo.modules.setunative.models.SetuPeer(
                peerId = peerId,
                deviceId = peerId,
                displayName = "",
                deviceModel = null,
                platform = "android",
                publicKey = publicKey,
                trustState = TrustState.INTRODUCED,
            )
            repository.upsert(introduced)
        } catch (error: Exception) {
            SetuLog.e(SetuLog.NFC, "introduction could not be recorded", error)
            false
        }
    }

    private fun context(): android.content.Context =
        appContext.reactContext?.applicationContext ?: throw IllegalStateException("REACT_CONTEXT_UNAVAILABLE")

    private fun profilePrivacyService(): ProfilePrivacyService = ProfilePrivacyService(context())

    private fun decodeUrlSafe(value: String): ByteArray =
        android.util.Base64.decode(value, android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP)
}
