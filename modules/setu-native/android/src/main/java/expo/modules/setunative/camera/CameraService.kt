package expo.modules.setunative.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.util.Log
import expo.modules.setunative.models.*
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.vault.VaultService
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.Executors

/**
 * Camera Service for managing photo and video capture.
 * Handles direct-to-vault capture, EXIF metadata stripping, and camera operations.
 */
class CameraService(
    private val context: Context,
    private val contentRepository: ContentRepository,
    private val vaultService: VaultService
) {

    companion object {
        private const val TAG = "SETU_CAMERA_SVC"
        private const val PHOTO_DIR_NAME = "photos"
        private const val VIDEO_DIR_NAME = "videos"
        private const val MAX_PHOTO_SIZE_MP = 12f // 12MP
        private const val MAX_VIDEO_DURATION_MIN = 15 // 15 minutes
    }

    private val executor = Executors.newCachedThreadPool()
    private val cameraManager: CameraManager by lazy {
        context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    }
    private var isServiceRunning = false

    interface CameraListener {
        fun onPhotoCaptured(content: SetuContent, file: File)
        fun onVideoCaptured(content: SetuContent, file: File)
        fun onCameraError(error: String)
        fun onCameraReady(cameraCount: Int)
    }

    private val listeners = mutableListOf<CameraListener>()

    fun addListener(listener: CameraListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: CameraListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    fun start() {
        if (isServiceRunning) return
        isServiceRunning = true

        checkCameraAvailability()
        Log.i(TAG, "Camera service started")
    }

    fun stop() {
        if (!isServiceRunning) return
        isServiceRunning = false
        Log.i(TAG, "Camera service stopped")
        executor.shutdown()
    }

    private fun checkCameraAvailability() {
        try {
            val cameraIds = cameraManager.cameraIdList
            val availableCount = cameraIds.filter { isCameraAvailable(it) }.size

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onCameraReady(availableCount)
                }
            }

            Log.d(TAG, "Camera availability check: $availableCount cameras available")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to check camera availability", e)
        }
    }

    private fun isCameraAvailable(cameraId: String): Boolean {
        try {
            val characteristics = cameraManager.getCameraCharacteristics(cameraId)
            val facing = characteristics.get(CameraCharacteristics.LENS_FACING)

            // Check if this is a rear-facing camera (preferred for Setu)
            return facing == CameraCharacteristics.LENS_FACING_BACK
        } catch (e: CameraAccessException) {
            return false
        }
    }

    /**
     * Capture a photo
     */
    fun capturePhoto(
        cameraId: String,
        ownerId: String,
        saveToVault: Boolean = false,
        stripExif: Boolean = true
    ): SetuContent? {
        // This is a simplified implementation
        // In a real app, this would integrate with CameraX or similar
        return null
    }

    /**
     * Capture a photo with file data
     */
    fun capturePhotoWithData(
        cameraId: String,
        photoData: ByteArray,
        ownerId: String,
        saveToVault: Boolean = false,
        stripExif: Boolean = true
    ): SetuContent? {
        return try {
            // Create photo directory
            val photoDir = File(context.filesDir, PHOTO_DIR_NAME)
            if (!photoDir.exists()) photoDir.mkdirs()

            // Generate filename
            val filename = "photo_${System.currentTimeMillis()}.jpg"
            val photoFile = File(photoDir, filename)

            // Save the photo
            FileOutputStream(photoFile).use { outputStream ->
                outputStream.write(photoData)
            }

            // Process the photo
            var processedData = photoData

            // Strip EXIF if requested
            if (stripExif) {
                processedData = stripExifMetadata(photoFile)
            }

            // Optionally compress if too large
            val maxFileSize = MAX_PHOTO_SIZE_MP * 1024 * 1024 // 12MP in bytes
            if (processedData.size > maxFileSize) {
                processedData = compressPhoto(processedData, photoFile)
            }

            // Create content record
            val contentId = "photo_${System.currentTimeMillis()}_${java.util.UUID.randomUUID()}"
            val content = SetuContent(
                contentId = contentId,
                type = ContentType.IMAGE,
                name = filename,
                mimeType = "image/jpeg",
                size = photoFile.length(),
                createdAt = System.currentTimeMillis(),
                modifiedAt = System.currentTimeMillis(),
                source = ContentSource.CAMERA,
                sourceUri = photoFile.absolutePath,
                storageMode = if (saveToVault) StorageMode.VAULT else StorageMode.SETU_MANAGED,
                encryptionMode = if (saveToVault) EncryptionMode.AES_GCM else EncryptionMode.NONE,
                manifestId = null,
                ownerId = ownerId,
                visibility = Visibility.PRIVATE,
                availability = Availability.FULL,
                state = ContentState.ACTIVE,
                thumbnailUri = null,
                metadata = mapOf(
                    "camera_id" to cameraId,
                    "exif_stripped" to stripExif.toString(),
                    "original_size" to photoData.size.toString()
                )
            )

            // Save to repository
            contentRepository.upsert(content)

            // Move to vault if requested
            if (saveToVault) {
                val vaultContent = vaultService.moveToVault(content, deleteOriginal = true)
                if (vaultContent != null) {
                    synchronized(listeners) {
                        for (listener in listeners) {
                            listener.onPhotoCaptured(vaultContent, photoFile)
                        }
                    }
                    return vaultContent
                }
            }

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onPhotoCaptured(content, photoFile)
                }
            }

            Log.i(TAG, "Photo captured: $contentId")
            content

        } catch (e: Exception) {
            Log.e(TAG, "Failed to capture photo", e)
            emitCameraError("Photo capture failed: ${e.message}")
            null
        }
    }

    /**
     * Capture a video with file data
     */
    fun captureVideoWithData(
        cameraId: String,
        videoData: ByteArray,
        ownerId: String,
        saveToVault: Boolean = false,
        durationMs: Long = 0
    ): SetuContent? {
        return try {
            // Create video directory
            val videoDir = File(context.filesDir, VIDEO_DIR_NAME)
            if (!videoDir.exists()) videoDir.mkdirs()

            // Generate filename
            val filename = "video_${System.currentTimeMillis()}.mp4"
            val videoFile = File(videoDir, filename)

            // Save the video
            FileOutputStream(videoFile).use { outputStream ->
                outputStream.write(videoData)
            }

            // Create content record
            val contentId = "video_${System.currentTimeMillis()}_${java.util.UUID.randomUUID()}"
            val content = SetuContent(
                contentId = contentId,
                type = ContentType.VIDEO,
                name = filename,
                mimeType = "video/mp4",
                size = videoFile.length(),
                createdAt = System.currentTimeMillis(),
                modifiedAt = System.currentTimeMillis(),
                source = ContentSource.CAMERA,
                sourceUri = videoFile.absolutePath,
                storageMode = if (saveToVault) StorageMode.VAULT else StorageMode.SETU_MANAGED,
                encryptionMode = if (saveToVault) EncryptionMode.AES_GCM else EncryptionMode.NONE,
                manifestId = null,
                ownerId = ownerId,
                visibility = Visibility.PRIVATE,
                availability = Availability.FULL,
                state = ContentState.ACTIVE,
                thumbnailUri = null,
                metadata = mapOf(
                    "camera_id" to cameraId,
                    "duration_ms" to durationMs.toString(),
                    "fps" to "30", // Default
                    "resolution" to getVideoResolution(videoFile)
                )
            )

            // Save to repository
            contentRepository.upsert(content)

            // Move to vault if requested
            if (saveToVault) {
                val vaultContent = vaultService.moveToVault(content, deleteOriginal = true)
                if (vaultContent != null) {
                    synchronized(listeners) {
                        for (listener in listeners) {
                            listener.onVideoCaptured(vaultContent, videoFile)
                        }
                    }
                    return vaultContent
                }
            }

            synchronized(listeners) {
                for (listener in listeners) {
                    listener.onVideoCaptured(content, videoFile)
                }
            }

            Log.i(TAG, "Video captured: $contentId")
            content

        } catch (e: Exception) {
            Log.e(TAG, "Failed to capture video", e)
            emitCameraError("Video capture failed: ${e.message}")
            null
        }
    }

    /**
     * Strip EXIF metadata from a photo file
     */
    private fun stripExifMetadata(photoFile: File): ByteArray {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val exif = ExifInterface(photoFile.absolutePath)

                // Remove all EXIF tags
                val exifAttributes = listOf(
                    ExifInterface.TAG_GPS_LATITUDE,
                    ExifInterface.TAG_GPS_LONGITUDE,
                    ExifInterface.TAG_GPS_ALTITUDE,
                    ExifInterface.TAG_GPS_LATITUDE_REF,
                    ExifInterface.TAG_GPS_LONGITUDE_REF,
                    ExifInterface.TAG_GPS_ALTITUDE_REF,
                    ExifInterface.TAG_DATETIME,
                    ExifInterface.TAG_DATETIME_ORIGINAL,
                    ExifInterface.TAG_DATETIME_DIGITIZED,
                    ExifInterface.TAG_MAKE,
                    ExifInterface.TAG_MODEL,
                    ExifInterface.TAG_ORIENTATION
                )

                for (attribute in exifAttributes) {
                    exif.setAttribute(attribute, null)
                }

                // Save the stripped EXIF
                exif.saveAttributes()
            }

            // Read the file back
            return photoFile.readBytes()

        } catch (e: Exception) {
            Log.w(TAG, "Failed to strip EXIF metadata", e)
            return photoFile.readBytes() // Return original if stripping fails
        }
    }

    /**
     * Compress photo if too large
     */
    private fun compressPhoto(originalData: ByteArray, originalFile: File): ByteArray {
        try {
            val options = BitmapFactory.Options()
            options.inJustDecodeBounds = true
            BitmapFactory.decodeByteArray(originalData, 0, originalData.size, options)

            // Calculate compression ratio
            val targetSize = MAX_PHOTO_SIZE_MP * 1024 * 1024 // 12MP in bytes
            val ratio = if (originalData.size > targetSize) {
                Math.sqrt((originalData.size / targetSize).toDouble()).toInt()
            } else {
                1
            }

            if (ratio > 1) {
                // Create compressed bitmap
                val compressedOptions = BitmapFactory.Options().apply {
                    inSampleSize = ratio
                    inPreferredConfig = Bitmap.Config.RGB_565
                }

                val bitmap = BitmapFactory.decodeByteArray(
                    originalData, 0, originalData.size, compressedOptions
                )

                // Rotate if needed based on EXIF
                val rotatedBitmap = rotateBitmapIfNeeded(originalFile.absolutePath, bitmap)

                // Save compressed version
                val tempFile = File.createTempFile("compressed_", ".jpg", context.cacheDir)
                FileOutputStream(tempFile).use { outputStream ->
                    rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
                }

                val compressedData = tempFile.readBytes()
                tempFile.delete()
                rotatedBitmap.recycle()

                return if (compressedData.size < originalData.size) compressedData else originalData
            }

            return originalData

        } catch (e: Exception) {
            Log.w(TAG, "Failed to compress photo", e)
            return originalData
        }
    }

    /**
     * Rotate bitmap based on EXIF orientation
     */
    private fun rotateBitmapIfNeeded(filePath: String, bitmap: Bitmap): Bitmap {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val exif = ExifInterface(filePath)
                val orientation = exif.getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
                )

                return when (orientation) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> rotateBitmap(bitmap, 90)
                    ExifInterface.ORIENTATION_ROTATE_180 -> rotateBitmap(bitmap, 180)
                    ExifInterface.ORIENTATION_ROTATE_270 -> rotateBitmap(bitmap, 270)
                    else -> bitmap
                }
            }
            return bitmap
        } catch (e: Exception) {
            return bitmap
        }
    }

    /**
     * Rotate bitmap by degrees
     */
    private fun rotateBitmap(bitmap: Bitmap, degrees: Int): Bitmap {
        val matrix = Matrix()
        matrix.postRotate(degrees.toFloat())
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    /**
     * Get video resolution from file
     */
    private fun getVideoResolution(videoFile: File): String {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(videoFile.absolutePath)
            val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull()
            val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull()
            return if (width != null && height != null && width > 0 && height > 0) {
                "${width}x${height}"
            } else {
                "Unknown"
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read video resolution", e)
            return "Unknown"
        } finally {
            retriever.release()
        }
    }

    /**
     * Get available cameras
     */
    fun getAvailableCameras(): List<CameraInfo> {
        return try {
            val cameraIds = cameraManager.cameraIdList
            val cameras = mutableListOf<CameraInfo>()

            for (cameraId in cameraIds) {
                try {
                    val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                    val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
                    val level = characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)

                    cameras.add(CameraInfo(
                        cameraId = cameraId,
                        facing = when (facing) {
                            CameraCharacteristics.LENS_FACING_BACK -> CameraFacing.BACK
                            CameraCharacteristics.LENS_FACING_FRONT -> CameraFacing.FRONT
                            CameraCharacteristics.LENS_FACING_EXTERNAL -> CameraFacing.EXTERNAL
                            else -> CameraFacing.UNKNOWN
                        },
                        hardwareLevel = when (level) {
                            CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL -> "FULL"
                            CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> "LIMITED"
                            CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY -> "LEGACY"
                            else -> "UNKNOWN"
                        }
                    ))
                } catch (e: CameraAccessException) {
                    Log.w(TAG, "Failed to get camera characteristics for $cameraId", e)
                }
            }

            cameras
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get available cameras", e)
            emptyList()
        }
    }

    /**
     * Check if camera permission is granted
     */
    fun hasCameraPermission(): Boolean {
        try {
            val cameraIds = cameraManager.cameraIdList
            return cameraIds.isNotEmpty()
        } catch (e: Exception) {
            return false
        }
    }

    private fun emitCameraError(error: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onCameraError(error)
            }
        }
    }

    /**
     * Get camera statistics
     */
    fun getStats(): Map<String, Any> {
        return mapOf(
            "available_cameras" to getAvailableCameras().size,
            "has_permission" to hasCameraPermission(),
            "max_photo_size" to "${MAX_PHOTO_SIZE_MP}MP",
            "max_video_duration" to "${MAX_VIDEO_DURATION_MIN}min"
        )
    }
}

// Data classes for camera
data class CameraInfo(
    val cameraId: String,
    val facing: CameraFacing,
    val hardwareLevel: String
)

enum class CameraFacing {
    BACK, FRONT, EXTERNAL, UNKNOWN
}

object BitmapFactory {
    fun decodeByteArray(data: ByteArray, offset: Int, length: Int, opts: BitmapFactory.Options?): Bitmap {
        // This would use the actual Android BitmapFactory
        return android.graphics.BitmapFactory.decodeByteArray(data, offset, length, opts)
    }
}
