package expo.modules.setunative.security

import android.app.KeyguardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.UserManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * SetuStore cannot be read or written right now because the device is locked. The wrapping key is
 * created with `setUnlockedDeviceRequired(true)`, so Keystore refuses to use it while the screen is
 * locked. This is a normal, temporary condition — never a corruption — and callers that only report
 * status must treat it as "not known yet" instead of failing.
 */
internal class SetuStoreLockedException(message: String) : IllegalStateException(message)

/** Owns SetuStore's wrapped root key and short-lived per-domain keys. */
internal class SetuStoreKeyManager(context: Context) {
    private val appContext = context.applicationContext
    private val keyFile = AtomicFile(File(appContext.noBackupFilesDir, "setu_store/root-key.enc"))
    private val keyStore = "AndroidKeyStore"

    fun <T> withDomainKey(domain: String, operation: (ByteArray) -> T): T {
        require(domain in DOMAINS) { "Unknown SetuStore key domain" }
        if (!isDeviceUnlocked()) {
            throw SetuStoreLockedException("SetuStore is unavailable while the device is locked")
        }

        val rootKey = try {
            loadOrCreateRootKey()
        } catch (error: Exception) {
            // The screen can lock between the check above and the Keystore call, and
            // isUserUnlocked() alone stays true once the user has unlocked since boot: the key is
            // bound to the device being unlocked *now*. Re-read the keyguard to tell a locked
            // device apart from real key damage, which must keep propagating.
            if (!isDeviceUnlocked()) {
                throw SetuStoreLockedException("SetuStore became unavailable: the device locked")
            }
            throw error
        }
        val domainKey = try {
            deriveDomainKey(rootKey, domain)
        } finally {
            rootKey.fill(0)
        }

        return try {
            operation(domainKey)
        } finally {
            domainKey.fill(0)
        }
    }

    fun hasPersistentKeyMaterial(): Boolean = keyFile.baseFile.exists() || hasWrappingKey()

    /**
     * True when the wrapping key can actually be used: the user has unlocked since boot *and* the
     * device is not sitting behind the keyguard. A device with no secure lock screen is never
     * reported as locked.
     */
    private fun isDeviceUnlocked(): Boolean {
        if (!appContext.getSystemService(UserManager::class.java).isUserUnlocked) return false
        val keyguard = appContext.getSystemService(KeyguardManager::class.java) ?: return true
        return !keyguard.isDeviceLocked
    }

    private fun loadOrCreateRootKey(): ByteArray {
        if (!keyFile.baseFile.exists()) {
            check(!hasWrappingKey()) { "SetuStore root key is missing; refusing to replace it" }
            return createRootKey()
        }

        val wrappingKey = getWrappingKey() ?: error("SetuStore wrapping key is missing")
        val envelope = keyFile.openRead().use { it.readBytes() }
        require(envelope.size in (NONCE_BYTES + TAG_BYTES + 1)..MAX_ENVELOPE_BYTES) {
            "Invalid SetuStore root-key envelope"
        }

        val nonce = envelope.copyOfRange(0, NONCE_BYTES)
        val ciphertext = envelope.copyOfRange(NONCE_BYTES, envelope.size)
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, wrappingKey, GCMParameterSpec(TAG_BITS, nonce))
            cipher.updateAAD(ROOT_KEY_AAD)
            val rootKey = cipher.doFinal(ciphertext)
            if (rootKey.size != ROOT_KEY_BYTES) {
                rootKey.fill(0)
                error("Invalid SetuStore root-key length")
            }
            return rootKey
        } finally {
            nonce.fill(0)
            ciphertext.fill(0)
            envelope.fill(0)
        }
    }

    private fun createRootKey(): ByteArray {
        check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            "SetuStore requires Android 9 or later for unlock-bound Keystore keys"
        }
        val rootKey = ByteArray(ROOT_KEY_BYTES).also(SecureRandom()::nextBytes)
        try {
            val wrappingKey = createWrappingKey()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, wrappingKey)
            cipher.updateAAD(ROOT_KEY_AAD)
            val envelope = cipher.iv + cipher.doFinal(rootKey)
            check(keyFile.baseFile.parentFile?.mkdirs() != false) {
                "Unable to create SetuStore key directory"
            }
            val output = keyFile.startWrite()
            try {
                output.write(envelope)
                output.fd.sync()
                keyFile.finishWrite(output)
            } catch (error: Throwable) {
                keyFile.failWrite(output)
                throw error
            } finally {
                envelope.fill(0)
            }
            return rootKey
        } catch (error: Throwable) {
            rootKey.fill(0)
            throw error
        }
    }

    private fun createWrappingKey(): SecretKey {
        val useStrongBox = appContext.packageManager
            .hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
        return try {
            generateWrappingKey(useStrongBox)
        } catch (error: Exception) {
            if (!useStrongBox) throw error
            deleteWrappingKey()
            generateWrappingKey(false)
        }
    }

    private fun generateWrappingKey(strongBox: Boolean): SecretKey {
        val builder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setKeySize(ROOT_KEY_BYTES * 8)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setUnlockedDeviceRequired(true)

        if (strongBox) builder.setIsStrongBoxBacked(true)
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, keyStore)
        generator.init(builder.build())
        return generator.generateKey()
    }

    private fun deriveDomainKey(rootKey: ByteArray, domain: String): ByteArray {
        val extract = Mac.getInstance(HMAC)
        extract.init(SecretKeySpec(HKDF_SALT, HMAC))
        val pseudorandomKey = extract.doFinal(rootKey)
        return try {
            val expand = Mac.getInstance(HMAC)
            expand.init(SecretKeySpec(pseudorandomKey, HMAC))
            expand.doFinal("setu-store-v1:$domain".toByteArray(Charsets.UTF_8) + byteArrayOf(1))
        } finally {
            pseudorandomKey.fill(0)
        }
    }

    private fun getWrappingKey(): SecretKey? {
        val store = KeyStore.getInstance(keyStore).also { it.load(null) }
        return store.getKey(KEY_ALIAS, null) as? SecretKey
    }

    private fun hasWrappingKey(): Boolean = getWrappingKey() != null

    private fun deleteWrappingKey() {
        val store = KeyStore.getInstance(keyStore).also { it.load(null) }
        if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS)
    }

    private companion object {
        const val KEY_ALIAS = "setu_store_wrap_v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val HMAC = "HmacSHA256"
        val ROOT_KEY_AAD = "SETU_STORE_ROOT_V1".toByteArray(Charsets.UTF_8)
        const val ROOT_KEY_BYTES = 32
        const val NONCE_BYTES = 12
        const val TAG_BITS = 128
        const val TAG_BYTES = TAG_BITS / 8
        const val MAX_ENVELOPE_BYTES = 128
        val HKDF_SALT = "setu-store-hkdf-v1".toByteArray(Charsets.UTF_8)
        val DOMAINS = setOf("messages", "ledger", "spaces", "trust", "vault-meta")
    }
}
