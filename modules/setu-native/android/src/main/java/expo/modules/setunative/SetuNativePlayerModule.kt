package expo.modules.setunative

import android.app.PictureInPictureParams
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.setunative.media.PlayerRegistry
import expo.modules.setunative.media.PlayerService
import expo.modules.setunative.media.SetuMedia3PlayerView
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class SetuNativePlayerModule : Module() {

    private val tickExecutor = Executors.newSingleThreadScheduledExecutor()
    private var tickTask: ScheduledFuture<*>? = null
    /** The last snapshot pushed per player, so an idle player costs no bridge traffic. */
    private val lastSnapshots = java.util.concurrent.ConcurrentHashMap<String, Map<String, Any>>()
    private var observedPlayerService: PlayerService? = null
    private var previousOrientation: Int? = null
    private val playerListener = object : PlayerService.PlayerListener {
        override fun onPlayerStateChanged(playerId: String, state: PlayerService.PlayerState) {
            emitPlayerSnapshot(playerId)
        }

        override fun onPieceNeeded(playerId: String, pieceIndex: Int) = Unit

        override fun onPlaybackError(playerId: String, error: String) {
            sendEvent("onPlayerError", mapOf("playerId" to playerId, "error" to error))
        }

        override fun onPlaybackCompleted(playerId: String) {
            sendEvent("onPlayerCompleted", mapOf("playerId" to playerId))
        }

        override fun onSeekCompleted(playerId: String, position: Long) {
            emitPlayerSnapshot(playerId)
        }
    }

    override fun definition() = ModuleDefinition {
        Name("SetuNativePlayer")
        Events("onPlayerStateChanged", "onPlayerProgress", "onPlayerError", "onPlayerCompleted")

        // Media3 is not touched until a player is actually requested: nothing starts at module load.
        OnCreate { }
        // Releases every player and its Media3 resources when the bridge goes away (app closing,
        // reload). Players are also released from JS on unmount, so nothing is left playing.
        OnDestroy {
            lastSnapshots.clear()
            observedPlayerService?.removeListener(playerListener)
            observedPlayerService = null
            stopProgressTicker()
            tickExecutor.shutdownNow()
            PlayerRegistry.shutdown()
        }

        View(SetuMedia3PlayerView::class) {
            Name("SetuMedia3PlayerView")
            Prop("playerId") { view, playerId: String? -> view.setPlayerId(playerId) }
            OnViewDestroys { it.detachPlayer() }
        }

        AsyncFunction("createPlayer") { contentId: String, streamOnly: Boolean ->
            createPlayer(contentId, streamOnly)
        }
        AsyncFunction("createPreviewPlayer") { uri: String -> createPreviewPlayer(uri) }
        AsyncFunction("releasePlayer") { playerId: String -> releasePlayer(playerId) }
        AsyncFunction("play") { playerId: String -> play(playerId) }
        AsyncFunction("pause") { playerId: String -> pause(playerId) }
        AsyncFunction("retry") { playerId: String -> retry(playerId) }
        AsyncFunction("seek") { playerId: String, positionMs: Double -> seek(playerId, positionMs) }
        AsyncFunction("setPlaybackSpeed") { playerId: String, speed: Double ->
            setPlaybackSpeed(playerId, speed.toFloat())
        }
        AsyncFunction("getPlayerTracks") { playerId: String -> getPlayerTracks(playerId) }
        AsyncFunction("selectPlayerTrack") { playerId: String, type: String, groupIndex: Int, trackIndex: Int ->
            selectPlayerTrack(playerId, type, groupIndex, trackIndex)
        }
        AsyncFunction("getPlayerState") { playerId: String -> getPlayerState(playerId) }
        AsyncFunction("supportsPictureInPicture") { supportsPictureInPicture() }
            .runOnQueue(Queues.MAIN)
        AsyncFunction("enterPictureInPicture") { playerId: String -> enterPictureInPicture(playerId) }
            .runOnQueue(Queues.MAIN)
        AsyncFunction("isInPictureInPictureMode") {
            appContext.currentActivity?.isInPictureInPictureMode == true
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("setFullscreenOrientation") { orientation: String ->
            setFullscreenOrientation(orientation)
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("getManifestPieceAvailability") { manifestId: String ->
            getManifestPieceAvailability(manifestId)
        }
    }

    private fun ctx(): Context =
        appContext.reactContext?.applicationContext
            ?: throw IllegalStateException("React context unavailable")

    /** Builds the player service on first use and subscribes exactly once. */
    private fun service(): PlayerService = PlayerRegistry.get(ctx()).also {
        if (observedPlayerService !== it) {
            observedPlayerService?.removeListener(playerListener)
            it.addListener(playerListener)
            observedPlayerService = it
        }
    }

    private fun createPlayer(contentId: String, streamOnly: Boolean): String {
        return try {
            val mode = if (streamOnly) {
                PlayerService.PlaybackMode.STREAM_ONLY
            } else {
                PlayerService.PlaybackMode.KEEP_COMPLETE
            }
            val playerId = service().createPlayer(contentId, mode, false)
                ?: throw IllegalStateException("PLAYER_CREATE_FAILED")
            ensureProgressTicker()
            playerId
        } catch (e: Exception) {
            throw IllegalStateException("PLAYER_CREATE_FAILED:${e.message}")
        }
    }

    private fun createPreviewPlayer(uri: String): String {
        return try {
            service().createLocalPreviewPlayer(uri).also { ensureProgressTicker() }
                ?: throw IllegalArgumentException("PREVIEW_SOURCE_UNAVAILABLE")
        } catch (e: Exception) {
            throw IllegalStateException("PREVIEW_PLAYER_FAILED:${e.message}")
        }
    }

    private fun releasePlayer(playerId: String): Boolean =
        try {
            service().releasePlayer(playerId)
        } catch (_: Exception) {
            false
        }

    private fun play(playerId: String): Boolean =
        try {
            service().startPlayback(playerId)
        } catch (_: Exception) {
            false
        }

    private fun pause(playerId: String): Boolean =
        try {
            service().pausePlayback(playerId)
        } catch (_: Exception) {
            false
        }

    private fun retry(playerId: String): Boolean =
        try {
            service().retryPlayback(playerId)
        } catch (_: Exception) {
            false
        }

    private fun seek(playerId: String, positionMs: Double): Boolean =
        try {
            service().seekToPosition(playerId, positionMs.toLong())
        } catch (_: Exception) {
            false
        }

    private fun setPlaybackSpeed(playerId: String, speed: Float): Boolean =
        try {
            service().setPlaybackSpeed(playerId, speed)
        } catch (_: Exception) {
            false
        }

    private fun getPlayerTracks(playerId: String): List<Map<String, Any>> =
        try {
            service().getPlayerTracks(playerId)
        } catch (_: Exception) {
            emptyList()
        }

    private fun selectPlayerTrack(
        playerId: String,
        type: String,
        groupIndex: Int,
        trackIndex: Int,
    ): Boolean =
        try {
            service().selectPlayerTrack(playerId, type, groupIndex, trackIndex)
        } catch (_: Exception) {
            false
        }

    private fun getPlayerState(playerId: String): Map<String, Any> = snapshot(service(), playerId)

    /**
     * One shape for playback state, whether it is asked for or pushed. The scrubber needs the
     * buffered position as much as the current one, and the error belongs with the state rather
     * than only in a separate event the UI may have missed.
     */
    private fun snapshot(service: PlayerService, playerId: String): Map<String, Any> = mapOf(
        "state" to service.getPlayerState(playerId).name,
        "positionMs" to service.getCurrentPosition(playerId),
        "durationMs" to service.getDuration(playerId),
        "bufferedPositionMs" to service.getBufferedPosition(playerId),
        "bufferedPercentage" to service.getBufferedPercentage(playerId),
        "speed" to service.getPlaybackSpeed(playerId).toDouble(),
        "manifestId" to (service.getPlayerManifestId(playerId) ?: ""),
        "isPieceBacked" to service.isPieceBacked(playerId),
        "error" to (service.getPlayerError(playerId) ?: ""),
    )

    private fun supportsPictureInPicture(): Boolean {
        val activity = appContext.currentActivity ?: return false
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
    }

    private fun enterPictureInPicture(playerId: String): Boolean {
        val activity = appContext.currentActivity ?: return false
        if (!supportsPictureInPicture()) return false
        val player = service().getPlayerInstance(playerId) ?: return false
        if (!player.isPlaying) return false
        val videoSize = player.videoSize
        val aspectRatio = if (videoSize.width > 0 && videoSize.height > 0) {
            val ratio = (videoSize.width.toFloat() / videoSize.height).coerceIn(1f / 2.39f, 2.39f)
            Rational((ratio * 1000).toInt(), 1000)
        } else {
            Rational(16, 9)
        }
        val params = PictureInPictureParams.Builder().setAspectRatio(aspectRatio).build()
        return activity.enterPictureInPictureMode(params)
    }

    private fun setFullscreenOrientation(orientation: String): Boolean {
        val activity = appContext.currentActivity ?: return false
        if (orientation == "restore") {
            activity.requestedOrientation = previousOrientation ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            previousOrientation = null
            return true
        }
        val requested = when (orientation) {
            "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            "sensor" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR
            else -> return false
        }
        if (previousOrientation == null) previousOrientation = activity.requestedOrientation
        activity.requestedOrientation = requested
        return true
    }

    /** Pushes the player's state, unless the identical snapshot has already gone out. */
    private fun emitPlayerSnapshot(playerId: String) {
        try {
            val service = observedPlayerService ?: return
            val snapshot = snapshot(service, playerId)
            if (lastSnapshots.put(playerId, snapshot) == snapshot) return
            sendEvent("onPlayerStateChanged", snapshot + ("playerId" to playerId))
        } catch (_: Exception) {
        }
    }

    private fun getManifestPieceAvailability(manifestId: String): Map<String, Any> = try {
        service().getManifestPieceAvailability(manifestId) +
            ("manifestId" to manifestId)
    } catch (e: Exception) {
        mapOf(
            "manifestId" to manifestId,
            "totalPieces" to 0,
            "localPieces" to emptyList<Int>(),
            "arrivingPieces" to emptyList<Int>(),
            "pieceSizeBytes" to 0,
            "totalBytes" to 0L,
            "error" to (e.message ?: "PLAYER_AVAILABILITY_UNAVAILABLE"),
        )
    }

    private fun ensureProgressTicker() {
        if (tickTask != null) return
        tickTask = tickExecutor.scheduleAtFixedRate({
            try {
                val service = observedPlayerService ?: return@scheduleAtFixedRate
                if (service.getPlayerIds().isEmpty()) {
                    stopProgressTicker()
                    return@scheduleAtFixedRate
                }
                emitProgress(service)
            } catch (_: Exception) {
            }
        }, 0, 500, TimeUnit.MILLISECONDS)
    }

    /**
     * The player's own clock, pushed rather than polled.
     *
     * Media3 reports state transitions, not the passage of time, so position and buffered position
     * have to be sampled. Doing that from JS cost a native round trip per sample and still only
     * moved once a second; sampling here means one event, and the screen interpolates between them
     * on the UI thread. Piece availability rides along for the content that has any.
     */
    private fun emitProgress(service: PlayerService) {
        val live = service.getPlayerIds()
        lastSnapshots.keys.retainAll(live.toSet())
        for (playerId in live) {
            val snapshot = snapshot(service, playerId)
            // A paused player's snapshot does not change, and neither should the bridge traffic.
            if (lastSnapshots.put(playerId, snapshot) != snapshot) {
                sendEvent("onPlayerStateChanged", snapshot + ("playerId" to playerId))
            }
            val manifestId = service.getPlayerManifestId(playerId)?.takeIf(String::isNotBlank) ?: continue
            val availability = service.getManifestPieceAvailability(manifestId)
            sendEvent(
                "onPlayerProgress",
                mapOf(
                    "manifestId" to manifestId,
                    "totalPieces" to availability["totalPieces"],
                    "localPieces" to availability["localPieces"],
                    "arrivingPieces" to availability["arrivingPieces"],
                    "totalBytes" to availability["totalBytes"],
                    "pieceSizeBytes" to availability["pieceSizeBytes"],
                ),
            )
        }
    }

    /** Pauses the progress ticker; the executor stays alive so the next player can restart it. */
    private fun stopProgressTicker() {
        tickTask?.cancel(false)
        tickTask = null
    }
}
