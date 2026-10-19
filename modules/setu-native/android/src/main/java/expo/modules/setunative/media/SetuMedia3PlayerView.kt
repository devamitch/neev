package expo.modules.setunative.media

import android.content.Context
import android.view.ViewGroup
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class SetuMedia3PlayerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val playerView = PlayerView(context).apply {
        layoutParams = LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        // Setu draws its own transport controls; Media3's default overlay would sit on top of them.
        useController = false
        setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
    }
    private var playerId: String? = null

    init {
        addView(playerView)
    }

    fun setPlayerId(value: String?) {
        if (playerId != value) {
            playerView.player = null
            playerId = value
        }
        bindPlayer()
    }

    fun detachPlayer() {
        playerView.player = null
        playerId = null
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        bindPlayer()
    }

    override fun onDetachedFromWindow() {
        playerView.player = null
        super.onDetachedFromWindow()
    }

    private fun bindPlayer() {
        val id = playerId ?: return
        playerView.player = PlayerRegistry.get(context).getPlayerInstance(id)
    }
}
