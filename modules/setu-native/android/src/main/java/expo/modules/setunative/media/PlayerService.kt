package expo.modules.setunative.media

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import expo.modules.setunative.models.Availability
import expo.modules.setunative.persistence.ContentRepository
import expo.modules.setunative.persistence.ManifestRepository
import expo.modules.setunative.persistence.PieceRepository
import expo.modules.setunative.swarm.SetuSwarmEngine
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.FutureTask
import java.util.UUID

/**
 * Owns every Media3 player: creation, the single source of playback state, seeking, and release.
 *
 * Two rules shape this class.
 *
 * **State is observed, never asserted.** A control method commands the player and returns; it does
 * not announce the state it hopes to produce. State comes out of one consolidated `onEvents`
 * callback and is derived from what the player reports — `isPlaying` and `playerError` — because
 * `playWhenReady` is the user's intent, not playback. Announcing PLAYING from the play button is
 * how a player ends up showing a pause icon over a frozen frame.
 *
 * **Playback is never refused for want of buffer.** Piece-backed content is meant to start before
 * it has fully arrived; the DataSource waits for the piece it needs and the scheduler is told where
 * playback is. Refusing to start, and reporting that refusal as an error, turned "this video is
 * still arriving" into "this video is broken" — including for content that was complete on disk.
 */
class PlayerService(
    private val context: Context
) {

    companion object {
        private const val TAG = "SETU_PLAYER_SVC"
        private const val PREFETCH_PIECES = 10
        private const val MIN_PLAYBACK_SPEED = 0.5f
        private const val MAX_PLAYBACK_SPEED = 2f
    }

    private val executor = Executors.newCachedThreadPool()
    private val contentRepository: ContentRepository by lazy { ContentRepository.create(context) }
    private val manifestRepository: ManifestRepository by lazy { ManifestRepository.create(context) }
    private val pieceRepository: PieceRepository by lazy { PieceRepository.create(context) }
    private val swarmEngine: SetuSwarmEngine by lazy { SetuSwarmEngine.getInstance(context) }

    private val players = ConcurrentHashMap<String, PlayerWrapper>()
    private var isServiceRunning = false
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * ExoPlayer must be created and driven from one thread. Expo async functions run on a background
     * queue, so every call that touches a player hops to the main looper and waits for the result;
     * calls already on the main thread run inline. Accessing a player off this thread is the
     * "Player is accessed on the wrong thread" crash.
     */
    private fun <T> onPlayerThread(block: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) return block()
        val task = FutureTask(Callable { block() })
        mainHandler.post(task)
        return task.get()
    }

    data class PlayerWrapper(
        val player: ExoPlayer,
        val contentId: String,
        val manifestId: String,
        val mediaSource: MediaSource,
        var playbackMode: PlaybackMode = PlaybackMode.STREAM_ONLY,
        var currentPosition: Long = 0,
        var targetPosition: Long? = null,
        var isSeekInProgress: Boolean = false,
        val isPieceBacked: Boolean = true,
        /** The last state emitted, so identical snapshots are not pushed across the bridge twice. */
        var lastState: PlayerState? = null
    )

    enum class PlaybackMode {
        STREAM_ONLY, KEEP_COMPLETE
    }

    enum class PlayerState {
        IDLE, BUFFERING, READY, PLAYING, PAUSED, ENDED, ERROR
    }

    interface PlayerListener {
        fun onPlayerStateChanged(playerId: String, state: PlayerState)
        fun onPieceNeeded(playerId: String, pieceIndex: Int)
        fun onPlaybackError(playerId: String, error: String)
        fun onPlaybackCompleted(playerId: String)
        fun onSeekCompleted(playerId: String, position: Long)
    }

    private val listeners = mutableListOf<PlayerListener>()

    fun addListener(listener: PlayerListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: PlayerListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    fun start() {
        if (isServiceRunning) return
        isServiceRunning = true

        Log.i(TAG, "Player service started")
    }

    fun stop() {
        if (!isServiceRunning) return
        isServiceRunning = false

        // Release all players
        releaseAllPlayers()

        Log.i(TAG, "Player service stopped")
        executor.shutdown()
    }

    private fun releaseAllPlayers() = onPlayerThread {
        for (playerId in players.keys.toList()) releasePlayer(playerId)
        players.clear()
    }

    /**
     * Builds an ExoPlayer that behaves like a media player on Android: it asks for audio focus
     * instead of talking over whatever is already playing, pauses when it loses focus, and holds a
     * partial wake lock only while it is actually playing.
     */
    private fun buildPlayer(): ExoPlayer =
        ExoPlayer.Builder(context)
            .setAudioAttributes(AudioAttributes.DEFAULT, /* handleAudioFocus = */ true)
            .setHandleAudioBecomingNoisy(true)
            .build()
            .apply { setWakeMode(C.WAKE_MODE_LOCAL) }

    /**
     * Create a player for Setu content
     */
    fun createPlayer(
        contentId: String,
        playbackMode: PlaybackMode = PlaybackMode.STREAM_ONLY,
        autoPlay: Boolean = false
    ): String? = onPlayerThread {
        try {
            val content = contentRepository.get(contentId) ?: run {
                emitPlaybackError("", "Content not found: $contentId")
                return@onPlayerThread null
            }

            /*
             * A file this device holds whole is played from that file, even once it is in the
             * swarm. Content joins the swarm as soon as it is received, so it has a manifest from
             * then on - but routing complete content through the piece reader would re-hash every
             * piece on the way to the decoder to read bytes already sitting in one file. The piece
             * path is for content that is still arriving or exists only as pieces.
             */
            val contentManifestId = content.manifestId?.takeIf { it.isNotBlank() }
            val localUri = content.sourceUri?.takeIf {
                content.availability == Availability.FULL && it.isNotBlank()
            }
            if (contentManifestId == null || localUri != null) {
                val sourceUri = localUri ?: content.sourceUri ?: run {
                    emitPlaybackError("", "Content source unavailable: $contentId")
                    return@onPlayerThread null
                }
                return@onPlayerThread createLocalPreviewPlayer(sourceUri, contentId, playbackMode, autoPlay)
            }

            val manifest = manifestRepository.get(contentManifestId) ?: run {
                emitPlaybackError("", "Manifest not found for content: $contentId")
                return@onPlayerThread null
            }

            val playerId = "player_${UUID.randomUUID()}"
            val player = buildPlayer()

            val setuFactory = DataSource.Factory {
                SetuMediaDataSource(
                    manifestId = manifest.manifestId,
                    pieceRepository = pieceRepository,
                    swarmEngine = swarmEngine,
                )
            }
            val mediaSource = ProgressiveMediaSource.Factory(setuFactory)
                .createMediaSource(MediaItem.fromUri(Uri.parse("setu://${manifest.manifestId}")))

            players[playerId] = PlayerWrapper(
                player = player,
                contentId = contentId,
                manifestId = manifest.manifestId,
                mediaSource = mediaSource,
                playbackMode = playbackMode
            )

            observe(player, playerId)
            player.setMediaSource(mediaSource)
            player.prepare()
            // Opening the player is itself a statement about where playback is about to be, so the
            // scheduler hears about it before the first read blocks waiting for piece zero.
            requestPiecesForPosition(playerId, 0L)
            if (autoPlay) player.play()

            Log.i(TAG, "Player created: $playerId for content $contentId")
            playerId
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create player for content $contentId", e)
            emitPlaybackError("", "Player creation failed: ${e.message}")
            null
        }
    }

    fun createLocalPreviewPlayer(
        uriString: String,
        contentId: String = uriString,
        playbackMode: PlaybackMode = PlaybackMode.STREAM_ONLY,
        autoPlay: Boolean = false
    ): String? = onPlayerThread {
        val uri = Uri.parse(uriString)
        if (uri.scheme != "file" && uri.scheme != "content") return@onPlayerThread null

        var player: ExoPlayer? = null
        val playerId = "preview_${UUID.randomUUID()}"
        try {
            player = buildPlayer()
            val mediaSource = ProgressiveMediaSource.Factory(DefaultDataSource.Factory(context))
                .createMediaSource(MediaItem.fromUri(uri))
            val previewPlayer = player
            players[playerId] = PlayerWrapper(
                player = previewPlayer,
                contentId = contentId,
                manifestId = "",
                mediaSource = mediaSource,
                playbackMode = playbackMode,
                isPieceBacked = false
            )
            observe(previewPlayer, playerId)
            previewPlayer.setMediaSource(mediaSource)
            previewPlayer.prepare()
            if (autoPlay) previewPlayer.play()
            playerId
        } catch (e: Exception) {
            players.remove(playerId)
            player?.release()
            Log.e(TAG, "Failed to create local preview player", e)
            null
        }
    }

    fun getPlayerInstance(playerId: String): ExoPlayer? = players[playerId]?.player

    /**
     * What the player is actually doing.
     *
     * `playWhenReady` says what was asked for; `isPlaying` says whether frames are moving, which is
     * the only thing a play/pause control should reflect. An error outranks everything, because a
     * failed player still reports a playback state.
     */
    private fun mapPlayerState(player: Player): PlayerState {
        if (player.playerError != null) return PlayerState.ERROR
        return when (player.playbackState) {
            Player.STATE_IDLE -> PlayerState.IDLE
            Player.STATE_BUFFERING -> PlayerState.BUFFERING
            Player.STATE_ENDED -> PlayerState.ENDED
            Player.STATE_READY -> if (player.isPlaying) PlayerState.PLAYING else PlayerState.PAUSED
            else -> PlayerState.IDLE
        }
    }

    /**
     * One event path. Everything the UI reacts to — state, errors, completion, seeks, track
     * changes — is derived here from what the player reports, in the order the player reports it.
     */
    private fun observe(player: ExoPlayer, playerId: String) {
        player.addListener(object : Player.Listener {
            override fun onEvents(player: Player, events: Player.Events) {
                if (
                    events.contains(Player.EVENT_PLAYBACK_STATE_CHANGED) ||
                    events.contains(Player.EVENT_PLAY_WHEN_READY_CHANGED) ||
                    events.contains(Player.EVENT_IS_PLAYING_CHANGED) ||
                    events.contains(Player.EVENT_PLAYBACK_SUPPRESSION_REASON_CHANGED) ||
                    events.contains(Player.EVENT_PLAYER_ERROR) ||
                    events.contains(Player.EVENT_TRACKS_CHANGED)
                ) {
                    val state = mapPlayerState(player)
                    val wrapper = players[playerId]
                    if (wrapper == null || wrapper.lastState != state) {
                        wrapper?.lastState = state
                        emitPlayerStateChanged(playerId, state)
                    }
                    if (state == PlayerState.ENDED) emitPlaybackCompleted(playerId)
                }

                if (events.contains(Player.EVENT_POSITION_DISCONTINUITY)) {
                    val position = player.currentPosition
                    players[playerId]?.let { wrapper ->
                        wrapper.isSeekInProgress = false
                        wrapper.currentPosition = position
                    }
                    emitSeekCompleted(playerId, position)
                    requestPiecesForPosition(playerId, position)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                emitPlaybackError(playerId, error.errorCodeName)
            }
        })
    }

    /**
     * Start playback.
     *
     * This commands the player and nothing else. Whether the first frame appears now or after the
     * next piece arrives is Media3's business, and the state that comes back says which.
     */
    fun startPlayback(playerId: String): Boolean = onPlayerThread {
        val wrapper = players[playerId] ?: return@onPlayerThread false

        // A player that failed earlier is re-prepared rather than silently doing nothing.
        if (wrapper.player.playerError != null) wrapper.player.prepare()
        if (wrapper.isPieceBacked) requestPiecesForPosition(playerId, wrapper.player.currentPosition)
        wrapper.player.play()
        true
    }

    /**
     * Pause playback
     */
    fun pausePlayback(playerId: String): Boolean = onPlayerThread {
        val wrapper = players[playerId] ?: return@onPlayerThread false

        wrapper.player.pause()
        true
    }

    /** Re-prepares a player that stopped on an error, for the "Try again" action. */
    fun retryPlayback(playerId: String): Boolean = onPlayerThread {
        val wrapper = players[playerId] ?: return@onPlayerThread false
        wrapper.player.prepare()
        if (wrapper.isPieceBacked) requestPiecesForPosition(playerId, wrapper.player.currentPosition)
        true
    }

    fun setPlaybackSpeed(playerId: String, speed: Float): Boolean = onPlayerThread {
        if (!speed.isFinite() || speed !in MIN_PLAYBACK_SPEED..MAX_PLAYBACK_SPEED) {
            return@onPlayerThread false
        }
        val player = players[playerId]?.player ?: return@onPlayerThread false
        player.setPlaybackSpeed(speed)
        true
    }

    fun getPlayerTracks(playerId: String): List<Map<String, Any>> = onPlayerThread {
        val player = players[playerId]?.player ?: return@onPlayerThread emptyList()
        player.currentTracks.groups.flatMapIndexed { groupIndex, group ->
            val type = when (group.type) {
                C.TRACK_TYPE_VIDEO -> "video"
                C.TRACK_TYPE_AUDIO -> "audio"
                C.TRACK_TYPE_TEXT -> "text"
                else -> null
            }
            if (type == null) return@flatMapIndexed emptyList()
            (0 until group.length).mapNotNull { trackIndex ->
                if (!group.isTrackSupported(trackIndex)) return@mapNotNull null
                val format = group.getTrackFormat(trackIndex)
                val label = format.label?.takeIf { it.isNotBlank() }
                    ?: format.language?.takeIf { it.isNotBlank() && it != "und" }
                    ?: when (type) {
                        "video" -> if (format.height > 0) "${format.height}p" else "Video ${trackIndex + 1}"
                        "audio" -> "Audio ${trackIndex + 1}"
                        else -> "Subtitle ${trackIndex + 1}"
                    }
                mapOf(
                    "id" to "${type}_${groupIndex}_${trackIndex}",
                    "type" to type,
                    "label" to label,
                    "groupIndex" to groupIndex,
                    "trackIndex" to trackIndex,
                    "selected" to group.isTrackSelected(trackIndex),
                )
            }
        }
    }

    fun selectPlayerTrack(
        playerId: String,
        type: String,
        groupIndex: Int,
        trackIndex: Int,
    ): Boolean = onPlayerThread {
        val trackType = when (type) {
            "video" -> C.TRACK_TYPE_VIDEO
            "audio" -> C.TRACK_TYPE_AUDIO
            "text" -> C.TRACK_TYPE_TEXT
            else -> return@onPlayerThread false
        }
        val player = players[playerId]?.player ?: return@onPlayerThread false
        if (groupIndex == -1 && trackIndex == -1) {
            player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
                .clearOverridesOfType(trackType)
                .setTrackTypeDisabled(trackType, type == "text")
                .build()
            return@onPlayerThread true
        }
        val group = player.currentTracks.groups.getOrNull(groupIndex)
            ?: return@onPlayerThread false
        if (
            group.type != trackType ||
            trackIndex !in 0 until group.length ||
            !group.isTrackSupported(trackIndex)
        ) {
            return@onPlayerThread false
        }
        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
            .clearOverridesOfType(trackType)
            .setTrackTypeDisabled(trackType, false)
            .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, trackIndex))
            .build()
        true
    }

    /**
     * Seek to position
     */
    fun seekToPosition(playerId: String, positionMs: Long): Boolean = onPlayerThread {
        val wrapper = players[playerId] ?: return@onPlayerThread false
        val duration = wrapper.player.duration
        val target = if (duration > 0L) {
            positionMs.coerceIn(0L, duration)
        } else {
            positionMs.coerceAtLeast(0L)
        }

        wrapper.isSeekInProgress = true
        wrapper.targetPosition = target
        // The pieces for where playback is going matter more than the ones it just left, so the
        // window moves before the seek rather than after the first stalled read.
        requestPiecesForPosition(playerId, target)
        wrapper.player.seekTo(target)
        true
    }

    /**
     * Stop playback
     */
    fun stopPlayback(playerId: String): Boolean = onPlayerThread {
        val wrapper = players[playerId] ?: return@onPlayerThread false

        wrapper.player.stop()
        wrapper.player.clearMediaItems()
        true
    }

    /**
     * Release player
     */
    fun releasePlayer(playerId: String): Boolean = onPlayerThread {
        val wrapper = players.remove(playerId) ?: return@onPlayerThread false

        // Nothing is playing this manifest any more, so the scheduler must stop favouring the
        // pieces around where playback happened to stop.
        if (wrapper.manifestId.isNotBlank() &&
            players.values.none { it.manifestId == wrapper.manifestId }
        ) {
            runCatching { swarmEngine.clearPlaybackWindow(wrapper.manifestId) }
        }
        wrapper.player.release()
        true
    }

    /**
     * Get current position
     */
    fun getCurrentPosition(playerId: String): Long =
        onPlayerThread { players[playerId]?.player?.currentPosition ?: 0L }

    /**
     * Get duration
     */
    fun getDuration(playerId: String): Long = onPlayerThread {
        val duration = players[playerId]?.player?.duration ?: 0L
        // Media3 reports TIME_UNSET for an unknown duration; the UI shows "live"/unknown instead.
        if (duration == C.TIME_UNSET) 0L else duration
    }

    /** How much of the content past the current position is buffered, 0-100. */
    fun getBufferedPercentage(playerId: String): Int =
        onPlayerThread { players[playerId]?.player?.bufferedPercentage ?: 0 }

    fun getBufferedPosition(playerId: String): Long =
        onPlayerThread { players[playerId]?.player?.bufferedPosition ?: 0L }

    /** The playback speed the player is actually running at. */
    fun getPlaybackSpeed(playerId: String): Float =
        onPlayerThread { players[playerId]?.player?.playbackParameters?.speed ?: 1f }

    /**
     * Get player state
     */
    fun getPlayerState(playerId: String): PlayerState = onPlayerThread {
        val player = players[playerId]?.player ?: return@onPlayerThread PlayerState.IDLE
        mapPlayerState(player)
    }

    /** The reason a player is in ERROR, for the diagnostics behind the user-facing message. */
    fun getPlayerError(playerId: String): String? =
        onPlayerThread { players[playerId]?.player?.playerError?.errorCodeName }

    fun getPlayerManifestId(playerId: String): String? = players[playerId]?.manifestId

    fun isPieceBacked(playerId: String): Boolean = players[playerId]?.isPieceBacked == true

    /**
     * Set playback mode
     */
    fun setPlaybackMode(playerId: String, mode: PlaybackMode): Boolean {
        val wrapper = players[playerId] ?: return false
        wrapper.playbackMode = mode
        return true
    }

    /**
     * Request pieces needed for a specific position
     */
    private fun requestPiecesForPosition(playerId: String, positionMs: Long) {
        val wrapper = players[playerId] ?: return
        if (!wrapper.isPieceBacked) return
        val manifest = manifestRepository.get(wrapper.manifestId) ?: return
        if (manifest.pieceCount == 0) return

        val targetPiece = PlaybackPieceIndex.at(positionMs, wrapper.player.duration, manifest)
        val endPiece = minOf(manifest.pieceCount - 1, targetPiece + PREFETCH_PIECES)

        val availablePieces = pieceRepository.getAvailablePieces(manifest.manifestId)
            .map { it.index }.toSet()

        for (pieceIndex in targetPiece..endPiece) {
            if (!availablePieces.contains(pieceIndex)) {
                emitPieceNeeded(playerId, pieceIndex)
                swarmEngine.requestPiece(manifest.manifestId, pieceIndex)
            }
        }
        swarmEngine.setPlaybackWindow(manifest.manifestId, targetPiece, endPiece)
    }

    /**
     * Notify that a piece is now available.
     *
     * Nothing here resumes playback: the DataSource read is blocked waiting for exactly this piece
     * and continues on its own. All this does is keep the prefetch window ahead of playback.
     */
    fun onPieceAvailable(manifestId: String, pieceIndex: Int) {
        for ((playerId, wrapper) in players) {
            if (wrapper.manifestId != manifestId) continue
            if (!isPieceNeeded(playerId, pieceIndex)) continue
            Log.d(TAG, "Piece $pieceIndex now available for player $playerId")
            requestPiecesForPosition(playerId, wrapper.player.currentPosition)
        }
    }

    /**
     * Check if a piece is needed for current playback position
     */
    private fun isPieceNeeded(playerId: String, pieceIndex: Int): Boolean {
        val wrapper = players[playerId] ?: return false
        if (!wrapper.isPieceBacked) return false
        val manifest = manifestRepository.get(wrapper.manifestId) ?: return false

        val currentPosition = wrapper.player.currentPosition
        val targetPosition = wrapper.targetPosition ?: currentPosition

        // Convert position to piece index
        val targetPiece = PlaybackPieceIndex.at(targetPosition, wrapper.player.duration, manifest)

        // Check if this piece is within the playback window
        val windowSize = 20 // Large window for seek operations
        val startPiece = maxOf(0, targetPiece - windowSize)
        val endPiece = minOf(manifest.pieceCount - 1, targetPiece + windowSize)

        return pieceIndex in startPiece..endPiece
    }

    /**
     * Get playback statistics
     */
    fun getManifestPieceAvailability(manifestId: String): Map<String, Any> {
        val manifest = manifestRepository.get(manifestId)
            ?: return mapOf("totalPieces" to 0, "localPieces" to emptyList<Int>())
        val local = pieceRepository.getByManifest(manifestId)
            .filter { it.state == expo.modules.setunative.models.PieceState.AVAILABLE }
            .map { it.index }
            .sorted()
        val localSet = local.toSet()
        val arriving = swarmEngine.getActiveTransfers().values
            .filter { it.manifestId == manifestId }
            .flatMap { it.requestedPieces }
            .filterNot { it in localSet }
            .distinct()
            .sorted()
        return mapOf(
            "totalPieces" to manifest.pieceCount,
            "localPieces" to local,
            "arrivingPieces" to arriving,
            "pieceSizeBytes" to manifest.pieceSize,
            "totalBytes" to manifest.size,
        )
    }

    fun getPlaybackStats(): Map<String, Any> {
        val totalPlayers = players.size
        val activePlayers = players.values.count { it.player.isPlaying }

        val totalPlaybackTime = players.values.sumOf {
            if (it.player.isPlaying) it.player.currentPosition else 0L
        }

        return mapOf(
            "total_players" to totalPlayers,
            "active_players" to activePlayers,
            "total_playback_time_ms" to totalPlaybackTime,
            "stream_only_count" to players.values.count { it.playbackMode == PlaybackMode.STREAM_ONLY },
            "keep_complete_count" to players.values.count { it.playbackMode == PlaybackMode.KEEP_COMPLETE }
        )
    }

    fun getPlayerIds(): List<String> = players.keys().toList()

    private fun emitPlayerStateChanged(playerId: String, state: PlayerState) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onPlayerStateChanged(playerId, state)
            }
        }
    }

    private fun emitPieceNeeded(playerId: String, pieceIndex: Int) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onPieceNeeded(playerId, pieceIndex)
            }
        }
    }

    private fun emitPlaybackError(playerId: String, error: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onPlaybackError(playerId, error)
            }
        }
    }

    private fun emitPlaybackCompleted(playerId: String) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onPlaybackCompleted(playerId)
            }
        }
    }

    private fun emitSeekCompleted(playerId: String, position: Long) {
        synchronized(listeners) {
            for (listener in listeners) {
                listener.onSeekCompleted(playerId, position)
            }
        }
    }
}
