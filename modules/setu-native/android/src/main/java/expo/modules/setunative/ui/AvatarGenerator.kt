package expo.modules.setunative.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import java.security.MessageDigest
import java.util.Locale

internal object AvatarGenerator {
    private const val COLOR_BACKGROUND_OFFSET = 0
    private const val COLOR_FOREGROUND_OFFSET = 3
    private const val PATTERN_OFFSET = 6
    private const val PATTERN_GRID_SIZE = 4
    private const val MAX_AVATAR_SIZE = 128

    fun generate(identity: String, size: Int = MAX_AVATAR_SIZE, displayName: String? = null): Bitmap {
        val digest = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
        val avatarSize = size.coerceIn(16, MAX_AVATAR_SIZE)
        val bitmap = Bitmap.createBitmap(avatarSize, avatarSize, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val r1 = digest[COLOR_BACKGROUND_OFFSET].toInt() and 0xFF
        val g1 = digest[COLOR_BACKGROUND_OFFSET + 1].toInt() and 0xFF
        val b1 = digest[COLOR_BACKGROUND_OFFSET + 2].toInt() and 0xFF
        val bgColor = Color.rgb(r1, g1, b1)

        val r2 = digest[COLOR_FOREGROUND_OFFSET].toInt() and 0xFF
        val g2 = digest[COLOR_FOREGROUND_OFFSET + 1].toInt() and 0xFF
        val b2 = digest[COLOR_FOREGROUND_OFFSET + 2].toInt() and 0xFF
        val fgColor = Color.rgb(r2, g2, b2)

        canvas.drawColor(bgColor)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = fgColor
        }

        val step = avatarSize / PATTERN_GRID_SIZE
        for (i in 0 until PATTERN_GRID_SIZE) {
            for (j in 0 until PATTERN_GRID_SIZE) {
                val bitIndex = i * PATTERN_GRID_SIZE + j
                val bit = (digest[PATTERN_OFFSET + (bitIndex / 8)].toInt() shr (bitIndex % 8)) and 1
                if (bit == 1) {
                    canvas.drawRect(
                        j * step.toFloat(),
                        i * step.toFloat(),
                        (j + 1) * step.toFloat(),
                        (i + 1) * step.toFloat(),
                        paint
                    )
                }
            }
        }

        initials(displayName).takeIf { it.isNotEmpty() }?.let { label ->
            paint.color = Color.WHITE
            paint.textAlign = Paint.Align.CENTER
            paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            paint.textSize = avatarSize * 0.32f
            val baseline = avatarSize / 2f - (paint.descent() + paint.ascent()) / 2f
            canvas.drawText(label, avatarSize / 2f, baseline, paint)
        }
        return bitmap
    }

    private fun initials(displayName: String?): String = displayName.orEmpty()
        .trim()
        .split(Regex("\\s+"))
        .filter { it.isNotEmpty() }
        .take(2)
        .map { String(Character.toChars(it.codePointAt(0))).uppercase(Locale.ROOT) }
        .joinToString("")

    fun getTestColors(identity: String): IntArray {
        val digest = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
        return intArrayOf(
            digest[COLOR_BACKGROUND_OFFSET].toInt() and 0xFF,
            digest[COLOR_BACKGROUND_OFFSET + 1].toInt() and 0xFF,
            digest[COLOR_BACKGROUND_OFFSET + 2].toInt() and 0xFF,
            digest[COLOR_FOREGROUND_OFFSET].toInt() and 0xFF,
            digest[COLOR_FOREGROUND_OFFSET + 1].toInt() and 0xFF,
            digest[COLOR_FOREGROUND_OFFSET + 2].toInt() and 0xFF
        )
    }
}
