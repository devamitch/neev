package expo.modules.setunative.identity

import android.content.Context
import expo.modules.setunative.models.TrustState
import expo.modules.setunative.persistence.PeerRepository
import expo.modules.setunative.persistence.SetuStore
import expo.modules.setunative.security.CryptoIdentityManager
import org.json.JSONObject

internal class ProfilePrivacyService(context: Context) {
    private val store = SetuStore.getInstance(context.applicationContext)
    private val peers by lazy { PeerRepository.create(context.applicationContext) }

    fun getProfile(): Map<String, Any?> {
        val identity = CryptoIdentityManager.getOrCreate()
        return readLocalProfile(identity.deviceId).toMap()
    }

    fun getProfileVisibility(): String {
        val identity = CryptoIdentityManager.getOrCreate()
        return readLocalProfile(identity.deviceId).visibility.name
    }

    fun setProfileVisibility(visibility: String): String {
        val identity = CryptoIdentityManager.getOrCreate()
        val current = readLocalProfile(identity.deviceId)
        val updated = current.copy(
            visibility = parseVisibility(visibility),
            version = System.currentTimeMillis()
        )
        writeProfile(updated)
        return updated.visibility.name
    }

    fun updateProfile(
        displayName: String,
        phone: String?,
        email: String?,
        visibility: String
    ): Map<String, Any?> {
        val name = displayName.trim()
        require(name.isNotEmpty() && name.length <= MAX_NAME_LENGTH) { "PROFILE_NAME_INVALID" }
        require(phone == null || phone.length <= MAX_CONTACT_LENGTH) { "PROFILE_PHONE_INVALID" }
        require(email == null || email.length <= MAX_CONTACT_LENGTH) { "PROFILE_EMAIL_INVALID" }
        val scope = parseVisibility(visibility)
        val profile = SetuProfile(
            deviceId = CryptoIdentityManager.getOrCreate().deviceId,
            displayName = name,
            phone = phone?.trim()?.takeIf(String::isNotEmpty),
            email = email?.trim()?.takeIf(String::isNotEmpty),
            visibility = scope,
            version = System.currentTimeMillis()
        )
        writeProfile(profile)
        return profile.toMap()
    }

    fun setPeerVisibility(peerId: String, visibility: String): Boolean {
        require(peerId.isNotBlank() && peerId.length <= MAX_PEER_ID_LENGTH) { "PROFILE_PEER_ID_INVALID" }
        val peer = peers.get(peerId) ?: error("PROFILE_PEER_NOT_FOUND")
        check(!peer.isBlocked && peer.trustState != TrustState.BLOCKED) { "PEER_BLOCKED" }
        check(peer.trustState != TrustState.QUARANTINED && peer.quarantineLevel == 0) { "PEER_QUARANTINED" }
        val scope = parseVisibility(visibility)
        val value = scope.name.toByteArray(Charsets.UTF_8)
        try {
            store.write(TRUST_DOMAIN, PEER_VISIBILITY_PREFIX + peerId, value)
        } finally {
            value.fill(0)
        }
        return true
    }

    fun getProfileForPeer(peerId: String): Map<String, Any?> {
        require(peerId.isNotBlank() && peerId.length <= MAX_PEER_ID_LENGTH) { "PROFILE_PEER_ID_INVALID" }
        val peer = peers.get(peerId) ?: error("PROFILE_PEER_NOT_FOUND")
        check(!peer.isBlocked && peer.trustState != TrustState.BLOCKED) { "PEER_BLOCKED" }
        check(peer.trustState != TrustState.QUARANTINED && peer.quarantineLevel == 0) { "PEER_QUARANTINED" }
        check(peer.trustState in AUTHENTICATED_STATES && !peer.sessionId.isNullOrBlank()) {
            "PROFILE_SESSION_NOT_AUTHORIZED"
        }

        val identity = CryptoIdentityManager.getOrCreate()
        val profile = readLocalProfile(identity.deviceId)
        val scope = readPeerVisibility(peerId) ?: profile.visibility
        val visible = when (scope) {
            ProfileVisibility.PUBLIC -> true
            ProfileVisibility.CONTACTS_ONLY -> peer.trustState in AUTHORIZED_STATES
            ProfileVisibility.TRUSTED_ONLY -> peer.trustState == TrustState.CONNECTED
            ProfileVisibility.PRIVATE -> false
        }
        if (!visible) return mapOf("deviceId" to profile.deviceId, "visibility" to scope.name)
        return profile.toMap()
    }

    private fun readLocalProfile(deviceId: String): SetuProfile {
        val bytes = store.read(TRUST_DOMAIN, LOCAL_PROFILE_ID)
            ?: return SetuProfile(deviceId = deviceId, displayName = DEFAULT_DISPLAY_NAME)
        return try {
            val json = JSONObject(bytes.toString(Charsets.UTF_8))
            val storedDeviceId = json.getString("deviceId")
            check(storedDeviceId == deviceId) { "PROFILE_IDENTITY_MISMATCH" }
            SetuProfile(
                deviceId = storedDeviceId,
                displayName = json.getString("displayName"),
                phone = json.optString("phone").takeIf(String::isNotEmpty),
                email = json.optString("email").takeIf(String::isNotEmpty),
                visibility = parseVisibility(json.getString("visibility")),
                version = json.getLong("version")
            )
        } catch (error: Exception) {
            throw IllegalStateException("PROFILE_RECORD_INVALID", error)
        } finally {
            bytes.fill(0)
        }
    }

    private fun writeProfile(profile: SetuProfile) {
        val value = JSONObject()
            .put("deviceId", profile.deviceId)
            .put("displayName", profile.displayName)
            .put("phone", profile.phone ?: JSONObject.NULL)
            .put("email", profile.email ?: JSONObject.NULL)
            .put("visibility", profile.visibility.name)
            .put("version", profile.version)
            .toString()
            .toByteArray(Charsets.UTF_8)
        try {
            store.write(TRUST_DOMAIN, LOCAL_PROFILE_ID, value)
        } finally {
            value.fill(0)
        }
    }

    private fun readPeerVisibility(peerId: String): ProfileVisibility? {
        val bytes = store.read(TRUST_DOMAIN, PEER_VISIBILITY_PREFIX + peerId) ?: return null
        return try {
            parseVisibility(bytes.toString(Charsets.UTF_8))
        } finally {
            bytes.fill(0)
        }
    }

    private fun parseVisibility(value: String): ProfileVisibility = try {
        ProfileVisibility.valueOf(value)
    } catch (error: IllegalArgumentException) {
        throw IllegalArgumentException("PROFILE_VISIBILITY_INVALID", error)
    }

    private fun SetuProfile.toMap(): Map<String, Any?> = mapOf(
        "deviceId" to deviceId,
        "displayName" to displayName,
        "phone" to phone,
        "email" to email,
        "visibility" to visibility.name,
        "version" to version
    )

    private companion object {
        const val TRUST_DOMAIN = "trust"
        const val LOCAL_PROFILE_ID = "profile:local"
        const val PEER_VISIBILITY_PREFIX = "profile-visibility:"
        const val DEFAULT_DISPLAY_NAME = "Setu User"
        const val MAX_NAME_LENGTH = 80
        const val MAX_CONTACT_LENGTH = 254
        const val MAX_PEER_ID_LENGTH = 128
        val AUTHORIZED_STATES = setOf(TrustState.AUTHORIZED, TrustState.CONNECTED)
        val AUTHENTICATED_STATES = setOf(TrustState.AUTHENTICATED, TrustState.AUTHORIZED, TrustState.CONNECTED)
    }
}
