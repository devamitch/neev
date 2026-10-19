package expo.modules.setunative.shared

import expo.modules.kotlin.modules.Module
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap

/**
 * Routes native events to whichever Expo module instance currently owns an event name, so
 * long-lived services (foreground service, transport, discovery) never hold a module directly.
 * When no JS is attached the event is dropped; durable state lives in the stores.
 */
object SetuEvents {
    const val CORE = "SetuNative"
    const val CONTENT = "SetuNativeContent"
    const val MESSAGING = "SetuNativeMessaging"
    const val SHARED_SPACE = "SetuNativeSharedSpace"
    const val SWARM = "SetuNativeSwarm"
    const val PLAYER = "SetuNativePlayer"

    private val modules = ConcurrentHashMap<String, WeakReference<Module>>()

    fun attach(owner: String, module: Module) {
        modules[owner] = WeakReference(module)
    }

    fun detach(owner: String, module: Module) {
        val current = modules[owner]?.get()
        if (current === module || current == null) modules.remove(owner)
    }

    fun emit(owner: String, event: String, body: Map<String, Any?> = emptyMap()) {
        val module = modules[owner]?.get() ?: return
        try {
            module.sendEvent(event, body)
        } catch (error: Exception) {
            SetuLog.w(SetuLog.BOOT, "Dropped $event: ${error.javaClass.simpleName}")
        }
    }
}
