package expo.modules.setunative.security

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * IdentityVault — AES-256-GCM encrypted vault backed by the Android Keystore.
 *
 * Security properties:
 *  - Key is generated inside the Android Keystore, never leaves secure hardware.
 *  - Vault data is encrypted with AES-256-GCM (authenticated encryption).
 *  - Writes are atomic: temp-write then rename.
 *  - Tampering produces GCM authentication failure (does not silently corrupt).
 *
 * Never use this to store the cryptographic private signing key itself —
 * that key stays in the Keystore. Use this vault for confirmed identity data,
 * privacy rules, and trusted-peer metadata.
 */
object IdentityVault {

    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "setu_vault_key_v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_LENGTH = 128
    private const val VAULT_FILENAME = "setu_vault_v1.enc"
    private const val VAULT_TEMP_FILENAME = "setu_vault_v1.enc.tmp"
    private const val ENVELOPE_PREFIX = "SETU_VAULT_V1:"

    // ── Key Management ─────────────────────────────────────────────────────────

    private fun getOrCreateKey(): SecretKey {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        ks.getKey(KEY_ALIAS, null)?.let { return it as? SecretKey ?: error("Invalid vault key type") }

        val keyGen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        keyGen.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(false) // vault is always accessible; biometric gates the UI
                .setRandomizedEncryptionRequired(true) // fresh IV for every encrypt
                .build()
        )
        return keyGen.generateKey()
    }

    fun isKeyPresent(): Boolean {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        return ks.containsAlias(KEY_ALIAS)
    }

    private fun getExistingKey(): SecretKey? {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        if (!ks.containsAlias(KEY_ALIAS)) return null
        return ks.getKey(KEY_ALIAS, null) as? SecretKey
            ?: throw IllegalStateException("Setu vault key is invalid")
    }

    // ── Encrypt ────────────────────────────────────────────────────────────────

    /**
     * Encrypts [plaintext] with AES-256-GCM.
     * Returns base64url(IV + ciphertext + GCM tag) as a single string.
     */
    private fun encrypt(plaintext: ByteArray, key: SecretKey): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv // 12-byte random IV provided by Keystore
        val ciphertext = cipher.doFinal(plaintext)
        // Prepend IV to ciphertext: [IV(12)] + [ciphertext + tag(16)]
        val combined = iv + ciphertext
        return ENVELOPE_PREFIX + Base64.encodeToString(combined, Base64.URL_SAFE or Base64.NO_WRAP)
    }

    // ── Decrypt ────────────────────────────────────────────────────────────────

    /**
     * Decrypts a blob produced by [encrypt].
     * Throws if GCM tag is invalid (tamper detected).
     */
    private fun decrypt(encoded: String, key: SecretKey): ByteArray {
        val payload = when {
            encoded.startsWith(ENVELOPE_PREFIX) -> encoded.removePrefix(ENVELOPE_PREFIX)
            !encoded.startsWith("SETU_VAULT_") -> encoded // Read vaults created before the envelope version marker.
            else -> throw IllegalStateException("Unsupported Setu vault envelope version")
        }
        val combined = Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP)
        require(combined.size > 12 + GCM_TAG_LENGTH / 8) { "Invalid Setu vault payload" }
        val iv = combined.copyOfRange(0, 12)
        val ciphertext = combined.copyOfRange(12, combined.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        return cipher.doFinal(ciphertext)
    }

    // ── File I/O ───────────────────────────────────────────────────────────────

    /**
     * Persists [json] string as an encrypted vault file.
     * Uses a temp→rename pattern for atomic writes.
     */
    fun writeVault(context: Context, json: String) {
        val baseFile = File(context.filesDir, VAULT_FILENAME)
        val atomicFile = AtomicFile(baseFile)
        val key = if (vaultExists(context)) {
            getExistingKey() ?: throw IllegalStateException("Setu vault key is missing; the vault was preserved")
        } else {
            getOrCreateKey()
        }
        val encrypted = encrypt(json.toByteArray(Charsets.UTF_8), key)
        val output = atomicFile.startWrite()
        try {
            output.write(encrypted.toByteArray(Charsets.UTF_8))
            output.fd.sync()
            atomicFile.finishWrite(output)
            File(context.filesDir, VAULT_TEMP_FILENAME).delete()
        } catch (error: Throwable) {
            atomicFile.failWrite(output)
            throw error
        }
    }

    /**
     * Reads and decrypts the vault. Returns null if vault doesn't exist.
     * Throws if the vault is tampered.
     */
    fun readVault(context: Context): String? {
        val baseFile = File(context.filesDir, VAULT_FILENAME)
        val backupFile = File(context.filesDir, "$VAULT_FILENAME.bak")
        if (!baseFile.exists() && !backupFile.exists()) return null
        val key = getExistingKey()
            ?: throw IllegalStateException("Setu vault key is missing; reset is required")
        val encrypted = AtomicFile(baseFile).openRead().bufferedReader(Charsets.UTF_8).use { it.readText() }
        return decrypt(encrypted, key).toString(Charsets.UTF_8)
    }

    fun vaultExists(context: Context): Boolean {
        val baseFile = File(context.filesDir, VAULT_FILENAME)
        return baseFile.exists() || File(context.filesDir, "$VAULT_FILENAME.bak").exists()
    }

    fun destroyVault(context: Context) {
        AtomicFile(File(context.filesDir, VAULT_FILENAME)).delete()
        File(context.filesDir, VAULT_TEMP_FILENAME).delete()
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        if (ks.containsAlias(KEY_ALIAS)) ks.deleteEntry(KEY_ALIAS)
    }
}
