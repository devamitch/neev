package expo.modules.setunative.media

import expo.modules.setunative.models.SetuManifest

internal object PlaybackPieceIndex {
    fun at(positionMs: Long, durationMs: Long, manifest: SetuManifest): Int {
        if (manifest.pieceCount == 0 || manifest.pieceSize <= 0 || manifest.size <= 0L) return 0
        if (durationMs <= 0L) return 0

        val boundedPosition = positionMs.coerceIn(0L, durationMs)
        val bytePosition = (boundedPosition.toDouble() / durationMs.toDouble() * manifest.size)
            .toLong()
        return (bytePosition / manifest.pieceSize).toInt().coerceIn(0, manifest.pieceCount - 1)
    }
}
