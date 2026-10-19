package expo.modules.setunative.media

import android.content.Context

object PlayerRegistry {
    @Volatile
    private var service: PlayerService? = null

    fun get(context: Context): PlayerService {
        return service ?: synchronized(this) {
            service ?: PlayerService(context.applicationContext).also {
                it.start()
                service = it
            }
        }
    }

    fun shutdown() {
        synchronized(this) {
            service?.stop()
            service = null
        }
    }
}
