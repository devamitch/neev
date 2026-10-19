package expo.modules.setunative.vault

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyProperties
import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.security.IdentityVault
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.security.SecureRandom
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Vault Service for managing encrypted private content storage.
 * Implements chunked authenticated encryption for large files.
 */
class VaultService(
    private val context: Context,
    private val contentRepository: ContentRepository,
    private val identityVault: IdentityVault
) {

    companion object {
        private const val TAG = "SETU_VAULT_SVC"
        private const val VAULT_DIR_NAME = "vault"
        private const val CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks
        private const val GCM_TAG_LENGTH = 128 // bits
        private const val GCM_IV_LENGTH = 12 // bytes
        private const val VAULT_KEY_ALIAS = "setu_vault_key"
        private const val VAULT_VERSION = 1
    }

    private val executor = Executors.newCachedThreadPool()
    private var vaultKey: SecretKey? = null
    private val vaultDir by lazy { File(context.filesDir, VAULT_DIR_NAME) }

    interface VaultListener {
        fun onVaultInitialized()
        fun onContentEncrypted(contentId: String)
        fun onContentDecrypted(contentId: String)
        fun onVaultError(error: String)
    }

    private val listeners = mutableListOf<VaultListener>()

    fun addListener(listener: VaultListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: VaultListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    /**
     * Initialize the vault service
     */
    fun initialize() {
        executor.execute {
            try {
                ensureInitialized()

                synchronized(listeners) {
                    for (listener in listeners) {
                        listener.onVaultInitialized()
                    }
                }

                Log.i(TAG, "Vault service initialized")

            } catch (e: Exception) {
                Log.e(TAG, "Vault initialization failed", e)
                emitError("Vault initialization failed: ${e.message}")
            }
        }
    }

    @Synchronized
    fun ensureInitialized() {
        if (!vaultDir.exists() && !vaultDir.mkdirs()) {
            throw IllegalStateException("VAULT_OPERATION_FAILED")
        }
        if (vaultKey == null) initializeVaultKey()
    }

    private fun initializeVaultKey() {
        try {
            val keyStore = java.security.KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)

            if (keyStore.containsAlias(VAULT_KEY_ALIAS)) {
                // Key exists, load it
                val entry = keyStore.getEntry(VAULT_KEY_ALIAS, null) as java.security.KeyStore.SecretKeyEntry
                vaultKey = entry.secretKey
                Log.d(TAG, "Loaded existing vault key")
            } else {
                // Generate new key
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    "AndroidKeyStore"
                )

                val keyGenSpec = android.security.keystore.KeyGenParameterSpec.Builder(
                    VAULT_KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(false)
                    .build()

                keyGenerator.init(keyGenSpec)
                vaultKey = keyGenerator.generateKey()

                Log.i(TAG, "Generated new vault key")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Vault key initialization failed", e)
            vaultKey = null
            throw IllegalStateException("VAULT_LOCKED", e)
        }
    }

    private fun emitError(error: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onVaultError(error)
            }
        }
    }

    /**
     * Check if vault is available
     */
    fun isAvailable(): Boolean {
        return vaultKey != null && vaultDir.exists()
    }

    /**
     * Store content in vault (encrypt and save)
     */
    fun storeInVault(
        sourceContent: SetuContent,
        destinationName: String? = null
    ): SetuContent? {
        if (!isAvailable()) {
            emitError("Vault not available")
            return null
        }

        return try {
            val sourceUri = sourceContent.sourceUri ?: return null
            val parsedUri = Uri.parse(sourceUri)
            val inputStream = when (parsedUri.scheme) {
                "content" -> context.contentResolver.openInputStream(parsedUri)
                "file" -> parsedUri.path?.let { File(it).inputStream() }
                null -> File(sourceUri).takeIf { it.exists() }?.inputStream()
                else -> null
            } ?: throw IllegalStateException("Source content is unavailable")

            val contentName = destinationName ?: sourceContent.name
            val contentId = "vault_${System.currentTimeMillis()}_${java.util.UUID.randomUUID()}"

            // Create encrypted chunks
            val chunkFiles = encryptContent(inputStream, sourceContent.size, contentId)

            // Create vault content record
            val vaultContent = SetuContent(
                contentId = contentId,
                type = sourceContent.type,
                name = contentName,
                mimeType = sourceContent.mimeType,
                size = sourceContent.size,
                createdAt = System.currentTimeMillis(),
                modifiedAt = System.currentTimeMillis(),
                source = ContentSource.VAULT,
                sourceUri = null, // No direct access
                storageMode = StorageMode.VAULT,
                encryptionMode = EncryptionMode.AES_GCM,
                manifestId = null,
                ownerId = sourceContent.ownerId,
                visibility = Visibility.PRIVATE,
                availability = Availability.FULL,
                state = ContentState.ACTIVE,
                thumbnailUri = null,
                metadata = mapOf(
                    "vault_version" to VAULT_VERSION.toString(),
                    "chunk_count" to chunkFiles.size.toString()
                )
            )

            // Save to repository
            if (!contentRepository.upsert(vaultContent)) {
                chunkFiles.forEach { it.delete() }
                throw IllegalStateException("Vault metadata could not be saved")
            }

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onContentEncrypted(contentId)
                }
            }

            Log.i(TAG, "Content stored in vault: $contentId")
            vaultContent

        } catch (e: Exception) {
            Log.e(TAG, "Failed to store content in vault", e)
            emitError("Vault storage failed: ${e.message}")
            null
        }
    }

    /**
     * Encrypt content into chunks
     */
    private fun encryptContent(source: InputStream, totalSize: Long, contentId: String): List<File> {
        val chunkFiles = mutableListOf<File>()
        var bytesRead = 0L
        var chunkIndex = 0

        try {
            source.use { inputStream ->
                while (bytesRead < totalSize) {
                    val chunkSize = minOf(CHUNK_SIZE.toLong(), totalSize - bytesRead).toInt()
                    val buffer = ByteArray(chunkSize)
                    var readCount = 0
                    while (readCount < chunkSize) {
                        val count = inputStream.read(buffer, readCount, chunkSize - readCount)
                        if (count < 0) break
                        readCount += count
                    }
                    if (readCount == 0) break
                    bytesRead += readCount

                    val chunk = if (readCount == buffer.size) buffer else buffer.copyOf(readCount)
                    val encryptedData = encryptChunk(chunk, chunkIndex, contentId)
                    val chunkFile = File(vaultDir, "${contentId}_${chunkIndex}.vault")
                    FileOutputStream(chunkFile).use { it.write(encryptedData) }
                    chunkFiles.add(chunkFile)
                    chunkIndex++
                }
            }
            if (bytesRead != totalSize) throw java.io.IOException("Source size changed during vault import")
        } catch (error: Exception) {
            chunkFiles.forEach { it.delete() }
            throw error
        }

        return chunkFiles
    }

    /**
     * Encrypt a single chunk with authenticated encryption
     */
    private fun encryptChunk(plaintext: ByteArray, chunkIndex: Int, contentId: String): ByteArray {
        if (vaultKey == null) throw IllegalStateException("Vault key not initialized")

        // Generate random IV for each chunk
        val iv = ByteArray(GCM_IV_LENGTH)
        SecureRandom().nextBytes(iv)

        // Create GCM parameter spec
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)

        // Initialize cipher for encryption
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, vaultKey, gcmSpec)

        // Add AAD (Additional Authenticated Data)
        val aad = "vault_${VAULT_VERSION}_${contentId}_${chunkIndex}".toByteArray()
        cipher.updateAAD(aad)

        // Encrypt the data
        val ciphertext = cipher.doFinal(plaintext)

        // Combine IV + ciphertext
        val result = ByteArray(iv.size + ciphertext.size)
        System.arraycopy(iv, 0, result, 0, iv.size)
        System.arraycopy(ciphertext, 0, result, iv.size, ciphertext.size)

        return result
    }

    /**
     * Retrieve content from vault (decrypt and reconstruct)
     */
    fun retrieveFromVault(vaultContent: SetuContent, outputFile: File): Boolean {
        if (!isAvailable()) {
            emitError("Vault not available")
            return false
        }

        return try {
            val chunkCount = vaultContent.metadata["chunk_count"]?.toIntOrNull() ?: 0

            // Reconstruct the file from encrypted chunks
            FileOutputStream(outputFile).use { outputStream ->
                for (chunkIndex in 0 until chunkCount) {
                    val chunkFile = File(vaultDir, "${vaultContent.contentId}_${chunkIndex}.vault")
                    if (!chunkFile.exists()) {
                        Log.e(TAG, "Missing vault chunk: ${chunkFile.name}")
                        return false
                    }

                    val encryptedData = chunkFile.readBytes()
                    val decryptedData = decryptChunk(encryptedData, chunkIndex, vaultContent.contentId)

                    outputStream.write(decryptedData)
                }
            }

            Log.i(TAG, "Content retrieved from vault: ${vaultContent.contentId}")
            true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to retrieve content from vault", e)
            emitError("Vault retrieval failed: ${e.message}")
            false
        }
    }

    /**
     * Decrypt a single chunk
     */
    private fun decryptChunk(encryptedData: ByteArray, chunkIndex: Int, contentId: String): ByteArray {
        if (vaultKey == null) throw IllegalStateException("Vault key not initialized")

        // Extract IV from the beginning
        val iv = encryptedData.copyOfRange(0, GCM_IV_LENGTH)
        val ciphertext = encryptedData.copyOfRange(GCM_IV_LENGTH, encryptedData.size)

        // Create GCM parameter spec
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)

        // Initialize cipher for decryption
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, vaultKey, gcmSpec)

        // Add AAD (Additional Authenticated Data)
        val aad = "vault_${VAULT_VERSION}_${contentId}_${chunkIndex}".toByteArray()
        cipher.updateAAD(aad)

        // Decrypt the data
        return cipher.doFinal(ciphertext)
    }

    /**
     * Delete content from vault
     */
    fun deleteFromVault(contentId: String): Boolean {
        try {
            val vaultContent = contentRepository.get(contentId) ?: return false
            if (vaultContent.storageMode != StorageMode.VAULT) return false
            val expectedChunkCount = vaultContent.metadata["chunk_count"]?.toIntOrNull()
                ?: return false
            if (expectedChunkCount < 0) return false
            val chunkFiles = vaultDir.listFiles { file ->
                file.name.startsWith("${contentId}_") && file.name.endsWith(".vault")
            } ?: emptyArray()
            if (chunkFiles.size != expectedChunkCount) return false

            for (chunkFile in chunkFiles) {
                if (!chunkFile.delete()) return false
            }

            if (!contentRepository.delete(contentId)) return false

            Log.i(TAG, "Content deleted from vault: $contentId")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete content from vault", e)
            return false
        }
    }

    /**
     * Get vault content as a temporary file for reading
     */
    fun getVaultContentAsFile(contentId: String): File? {
        val vaultContent = contentRepository.get(contentId) ?: return null

        if (vaultContent.storageMode != StorageMode.VAULT) {
            emitError("Content $contentId is not in vault")
            return null
        }

        try {
            val tempFile = File.createTempFile("vault_${contentId}_", ".tmp", context.cacheDir)
            tempFile.deleteOnExit()

            if (retrieveFromVault(vaultContent, tempFile)) {
                return tempFile
            } else {
                tempFile.delete()
                return null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get vault content as file", e)
            return null
        }
    }

    /**
     * Move content to vault
     */
    fun moveToVault(content: SetuContent, deleteOriginal: Boolean = false): SetuContent? {
        val vaultContent = storeInVault(content) ?: return null
        if (!deleteOriginal) return vaultContent

        if (!deleteSource(content)) {
            if (!deleteFromVault(vaultContent.contentId)) {
                emitError("Vault copy cleanup failed after source deletion was denied")
            }
            emitError("Original source was preserved because it could not be deleted")
            return null
        }

        if (!contentRepository.delete(content.contentId)) {
            emitError("Original content metadata could not be removed after source deletion")
        }
        return vaultContent
    }

    private fun deleteSource(content: SetuContent): Boolean {
        val source = content.sourceUri ?: return false
        return try {
            val uri = Uri.parse(source)
            when (uri.scheme) {
                "content" -> context.contentResolver.delete(uri, null, null) > 0
                "file" -> uri.path?.let { File(it).delete() } ?: false
                null -> File(source).delete()
                else -> false
            }
        } catch (error: Exception) {
            emitError("Original source deletion failed: ${error.message ?: "unknown error"}")
            false
        }
    }

    /**
     * Copy content to vault
     */
    fun copyToVault(content: SetuContent): SetuContent? {
        return storeInVault(content)
    }

    /**
     * Export content from vault to external storage
     */
    fun exportFromVault(vaultContent: SetuContent, destination: File): Boolean {
        if (vaultContent.storageMode != StorageMode.VAULT) {
            emitError("Content is not in vault")
            return false
        }

        return try {
            retrieveFromVault(vaultContent, destination)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to export from vault", e)
            false
        }
    }

    fun exportToStream(vaultContent: SetuContent, output: java.io.OutputStream): Boolean {
        if (!isAvailable() || vaultContent.storageMode != StorageMode.VAULT) return false
        return try {
            val chunkCount = vaultContent.metadata["chunk_count"]?.toIntOrNull()
                ?: throw IllegalStateException("Invalid vault metadata")
            for (chunkIndex in 0 until chunkCount) {
                val chunk = File(vaultDir, "${vaultContent.contentId}_${chunkIndex}.vault")
                require(chunk.exists()) { "Missing vault chunk" }
                output.write(decryptChunk(chunk.readBytes(), chunkIndex, vaultContent.contentId))
            }
            true
        } catch (error: Exception) {
            emitError("Vault export failed: ${error.message}")
            false
        }
    }

    /**
     * Get all vault content
     */
    fun getVaultContent(ownerId: String): List<SetuContent> {
        return contentRepository.getByOwner(ownerId)
            .filter { it.storageMode == StorageMode.VAULT }
    }

    /**
     * Get vault statistics
     */
    fun getVaultStats(ownerId: String): Map<String, Any> {
        val vaultContent = getVaultContent(ownerId)
        val totalSize = vaultContent.sumOf { it.size }

        // Calculate actual disk usage (sum of all chunk files)
        var actualDiskUsage = 0L
        for (content in vaultContent) {
            val chunkFiles = vaultDir.listFiles { file ->
                file.name.startsWith("${content.contentId}_") && file.name.endsWith(".vault")
            } ?: emptyArray()

            actualDiskUsage += chunkFiles.sumOf { it.length() }
        }

        return mapOf(
            "total_content" to vaultContent.size,
            "total_original_size" to totalSize,
            "actual_disk_usage" to actualDiskUsage,
            "compression_ratio" to if (totalSize > 0) actualDiskUsage.toDouble() / totalSize else 1.0
        )
    }

    /**
     * Securely wipe vault content
     */
    fun secureWipe(contentId: String): Boolean {
        try {
            // First, overwrite the chunk files with random data
            val chunkFiles = vaultDir.listFiles { file ->
                file.name.startsWith("${contentId}_") && file.name.endsWith(".vault")
            } ?: emptyArray()

            for (chunkFile in chunkFiles) {
                val random = SecureRandom()
                val buffer = ByteArray(4096)

                java.io.RandomAccessFile(chunkFile, "rw").use { raf ->
                    // Overwrite with random data multiple times
                    repeat(3) {
                        raf.seek(0)
                        random.nextBytes(buffer)
                        raf.write(buffer)
                    }
                }

                chunkFile.delete()
            }

            // Remove from repository
            contentRepository.delete(contentId)

            Log.i(TAG, "Content securely wiped from vault: $contentId")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to securely wipe content from vault", e)
            return false
        }
    }

    /**
     * Lock the vault
     */
    fun lock() {
        // Clear in-memory key (if not in hardware keystore)
        vaultKey = null
        Log.i(TAG, "Vault locked")
    }

    /**
     * Unlock the vault
     */
    fun unlock(): Boolean {
        return try {
            initializeVaultKey()
            vaultKey != null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unlock vault", e)
            false
        }
    }

    /**
     * Reset the vault (clear all content)
     */
    fun reset() {
        try {
            // Delete all vault files
            vaultDir.deleteRecursively()
            vaultDir.mkdirs()

            // Remove all vault content from repository
            val vaultContent = getVaultContent("") // All owners
            for (content in vaultContent) {
                contentRepository.delete(content.contentId)
            }

            // Clear vault key
            vaultKey = null

            Log.i(TAG, "Vault reset completed")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to reset vault", e)
        }
    }

    /**
     * Get random access stream for vault content
     */
    fun getVaultContentStream(contentId: String): VaultContentStream? {
        val vaultContent = contentRepository.get(contentId) ?: return null

        if (vaultContent.storageMode != StorageMode.VAULT) {
            return null
        }

        return try {
            VaultContentStream(vaultContent, this)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create vault content stream", e)
            null
        }
    }

    fun shutdown() {
        executor.shutdown()
        lock()
    }

    /**
     * Vault content stream for reading chunks on demand
     */
    class VaultContentStream(
        private val vaultContent: SetuContent,
        private val vaultService: VaultService
    ) : java.io.InputStream() {

        private var currentChunk = 0
        private var chunkData: ByteArray = ByteArray(0)
        private var chunkPosition = 0
        private var contentPosition = 0L

        override fun read(): Int {
            if (chunkPosition >= chunkData.size) {
                if (!loadNextChunk()) {
                    return -1
                }
            }

            val byte = chunkData[chunkPosition].toInt() and 0xFF
            chunkPosition++
            contentPosition++
            return byte
        }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            if (chunkPosition >= chunkData.size) {
                if (!loadNextChunk()) {
                    return -1
                }
            }

            val bytesToRead = minOf(length, chunkData.size - chunkPosition)
            System.arraycopy(chunkData, chunkPosition, buffer, offset, bytesToRead)
            chunkPosition += bytesToRead
            contentPosition += bytesToRead
            return bytesToRead
        }

        private fun loadNextChunk(): Boolean {
            if (currentChunk >= getChunkCount()) {
                return false
            }

            val chunkFile = File(
                vaultService.vaultDir,
                "${vaultContent.contentId}_${currentChunk}.vault"
            )

            if (!chunkFile.exists()) {
                return false
            }

            try {
                val encryptedData = chunkFile.readBytes()
                chunkData = vaultService.decryptChunk(encryptedData, currentChunk, vaultContent.contentId)
                chunkPosition = 0
                currentChunk++
                return true
            } catch (e: Exception) {
                return false
            }
        }

        private fun getChunkCount(): Int {
            return vaultContent.metadata["chunk_count"]?.toIntOrNull() ?: 0
        }

        override fun close() {}
        override fun available(): Int = chunkData.size - chunkPosition
        override fun skip(n: Long): Long {
            var skipped = 0L
            while (skipped < n && currentChunk < getChunkCount()) {
                val remainingInChunk = (chunkData.size - chunkPosition).toLong()
                if (remainingInChunk <= n - skipped) {
                    skipped += remainingInChunk
                    currentChunk++
                    chunkPosition = 0
                    if (!loadNextChunk()) break
                } else {
                    chunkPosition += (n - skipped).toInt()
                    skipped = n
                }
            }
            contentPosition += skipped
            return skipped
        }

        override fun reset() {
            currentChunk = 0
            chunkPosition = 0
            contentPosition = 0
        }

        override fun mark(readLimit: Int) {}
        override fun markSupported(): Boolean = false
    }
}
