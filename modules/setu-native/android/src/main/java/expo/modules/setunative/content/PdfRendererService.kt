package expo.modules.setunative.content

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Renders PDF pages for the in-app viewer.
 *
 * PdfRenderer is not thread-safe and allows one open page at a time, so every document gets its own
 * lock and pages are rendered one at a time under it. Pages are rasterised to PNG files in the cache
 * directory rather than returned as bytes: a page bitmap is megabytes, and that does not belong on
 * the JS bridge.
 */
object PdfRendererService {

    private const val CACHE_DIR = "pdf_pages"
    private const val MAX_PAGE_WIDTH = 2048
    private const val MIN_PAGE_WIDTH = 64

    private class Document(
        val descriptor: ParcelFileDescriptor,
        val renderer: PdfRenderer,
        val cacheDirectory: File,
    ) {
        val lock = Any()
    }

    private val documents = ConcurrentHashMap<String, Document>()

    class PdfHandle(val handle: String, val pageCount: Int)

    class PdfPage(val uri: String, val width: Int, val height: Int)

    fun open(context: Context, uri: String): PdfHandle {
        val descriptor = openDescriptor(context, uri)
        val renderer = try {
            PdfRenderer(descriptor)
        } catch (error: Exception) {
            runCatching { descriptor.close() }
            throw IllegalArgumentException("PDF_UNREADABLE", error)
        }
        val handle = UUID.randomUUID().toString()
        val cacheDirectory = File(File(context.cacheDir, CACHE_DIR), handle).apply { mkdirs() }
        documents[handle] = Document(descriptor, renderer, cacheDirectory)
        return PdfHandle(handle, renderer.pageCount)
    }

    fun renderPage(handle: String, index: Int, targetWidth: Int): PdfPage {
        val document = documents[handle] ?: throw IllegalStateException("PDF_NOT_OPEN")
        val width = targetWidth.coerceIn(MIN_PAGE_WIDTH, MAX_PAGE_WIDTH)

        synchronized(document.lock) {
            if (index !in 0 until document.renderer.pageCount) {
                throw IllegalArgumentException("PDF_PAGE_OUT_OF_RANGE")
            }
            val destination = File(document.cacheDirectory, "${index}_$width.png")

            document.renderer.openPage(index).use { page ->
                val height = (width.toLong() * page.height / page.width)
                    .coerceAtLeast(1L)
                    .coerceAtMost(MAX_PAGE_WIDTH.toLong() * 4)
                    .toInt()
                if (destination.isFile && destination.length() > 0) {
                    return PdfPage(Uri.fromFile(destination).toString(), width, height)
                }

                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                try {
                    // PdfRenderer draws only ink; without this the page is transparent, which reads
                    // as black in dark mode.
                    bitmap.eraseColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    FileOutputStream(destination).use { output ->
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
                    }
                } catch (error: Exception) {
                    destination.delete()
                    throw error
                } finally {
                    bitmap.recycle()
                }
                return PdfPage(Uri.fromFile(destination).toString(), width, height)
            }
        }
    }

    fun close(handle: String) {
        val document = documents.remove(handle) ?: return
        synchronized(document.lock) {
            runCatching { document.renderer.close() }
            runCatching { document.descriptor.close() }
        }
        document.cacheDirectory.listFiles()?.forEach { it.delete() }
        document.cacheDirectory.delete()
    }

    fun closeAll() {
        documents.keys.toList().forEach(::close)
    }

    private fun openDescriptor(context: Context, uri: String): ParcelFileDescriptor {
        val parsed = Uri.parse(uri)
        val descriptor = when (parsed.scheme) {
            "content" -> context.contentResolver.openFileDescriptor(parsed, "r")
            "file" -> parsed.path?.let {
                ParcelFileDescriptor.open(File(it), ParcelFileDescriptor.MODE_READ_ONLY)
            }
            null -> ParcelFileDescriptor.open(File(uri), ParcelFileDescriptor.MODE_READ_ONLY)
            else -> null
        }
        return descriptor ?: throw IllegalArgumentException("PDF_SOURCE_UNAVAILABLE")
    }
}
