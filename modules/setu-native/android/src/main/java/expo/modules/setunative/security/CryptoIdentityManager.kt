package expo.modules.setunative.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature

/**
 * CryptoIdentityManager — manages the Setu device's Ed25519-style signing identity.
 *
 * Uses Android Keystore EC P-256 (NIST) + SHA-256 as a stable, hardware-backed
 * signing keypair. (Ed25519 is not available on all Android Keystore versions;
 * EC P-256 with SHA256withECDSA is universally supported and cryptographically solid.)
 *
 * The private key never leaves the Keystore.
 * The public key (DER-encoded, base64url) is the device's shareable identity.
 * The deviceId is the first 16 bytes of SHA-256(publicKey) as a hex string.
 */
object CryptoIdentityManager {

    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"

    /**
     * v2 because v1 permitted only DIGEST_SHA256. TLS signs the already-hashed handshake with
     * NONEwithECDSA (Conscrypt's `ecSignDigestWithPrivateKey`), which the keystore refuses unless
     * DIGEST_NONE is permitted on the key — so every peer handshake failed and no session could
     * ever form. Permitted digests are fixed at creation, so the key has to be reissued.
     */
    private const val KEY_ALIAS = "setu_identity_v2"
    private const val LEGACY_KEY_ALIAS = "setu_identity_v1"
    private const val SIGN_ALGORITHM = "SHA256withECDSA"

    data class CryptoIdentity(
        val deviceId: String,      // hex, 32 chars — stable identifier
        val publicKeyB64: String,  // base64url DER-encoded public key
    )

    // ── Key Lifecycle ──────────────────────────────────────────────────────────

    fun getOrCreate(): CryptoIdentity {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }

        if (!ks.containsAlias(KEY_ALIAS)) {
            val kpg = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC, KEYSTORE_PROVIDER
            )
            kpg.initialize(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
                )
                    .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
                    // DIGEST_NONE is what TLS needs: Conscrypt hashes the handshake itself and then
                    // asks this key to sign the digest. The named digests keep SHA256withECDSA
                    // working for Setu's own payload signatures.
                    .setDigests(
                        KeyProperties.DIGEST_NONE,
                        KeyProperties.DIGEST_SHA256,
                        KeyProperties.DIGEST_SHA384,
                        KeyProperties.DIGEST_SHA512,
                    )
                    .setUserAuthenticationRequired(false) // signing accessible w/o biometric at engine level
                    .build()
            )
            kpg.generateKeyPair()
            // The old key can never complete a handshake, so it is not worth keeping around.
            if (ks.containsAlias(LEGACY_KEY_ALIAS)) ks.deleteEntry(LEGACY_KEY_ALIAS)
        }

        val publicKey = ks.getCertificate(KEY_ALIAS).publicKey
        val pubBytes = publicKey.encoded // DER-encoded SubjectPublicKeyInfo
        val pubB64 = Base64.encodeToString(pubBytes, Base64.URL_SAFE or Base64.NO_WRAP)

        // deviceId = first 16 bytes of SHA-256(publicKey) as lowercase hex
        val digest = MessageDigest.getInstance("SHA-256").digest(pubBytes)
        val deviceId = digest.take(16).joinToString("") { "%02x".format(it) }

        return CryptoIdentity(deviceId = deviceId, publicKeyB64 = pubB64)
    }

    fun isInitialized(): Boolean {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        return ks.containsAlias(KEY_ALIAS)
    }

    // ── Signing ────────────────────────────────────────────────────────────────

    /**
     * Signs [payload] bytes with the device's private key.
     * Returns base64url-encoded DER signature.
     * Use for NFC bootstrap payloads, session introductions, etc.
     */
    fun sign(payload: ByteArray): String {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        val privateKey = ks.getKey(KEY_ALIAS, null)
            ?: error("Setu identity key not found — call getOrCreate() first")
        val sig = Signature.getInstance(SIGN_ALGORITHM)
        sig.initSign(privateKey as java.security.PrivateKey)
        sig.update(payload)
        val signed = sig.sign()
        return Base64.encodeToString(signed, Base64.URL_SAFE or Base64.NO_WRAP)
    }

    /**
     * Verifies a signature produced by a peer using their [publicKeyB64].
     */
    fun verify(payload: ByteArray, signatureB64: String, publicKeyB64: String): Boolean {
        return try {
            val pubBytes = Base64.decode(publicKeyB64, Base64.URL_SAFE or Base64.NO_WRAP)
            val keyFactory = java.security.KeyFactory.getInstance("EC")
            val pubKey = keyFactory.generatePublic(
                java.security.spec.X509EncodedKeySpec(pubBytes)
            )
            val sigBytes = Base64.decode(signatureB64, Base64.URL_SAFE or Base64.NO_WRAP)
            val sig = Signature.getInstance(SIGN_ALGORITHM)
            sig.initVerify(pubKey)
            sig.update(payload)
            sig.verify(sigBytes)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Destroys the identity keypair. IRREVERSIBLE.
     * A new identity will be created on next call to getOrCreate().
     */
    fun destroy() {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        if (ks.containsAlias(KEY_ALIAS)) ks.deleteEntry(KEY_ALIAS)
        if (ks.containsAlias(LEGACY_KEY_ALIAS)) ks.deleteEntry(LEGACY_KEY_ALIAS)
    }
}
