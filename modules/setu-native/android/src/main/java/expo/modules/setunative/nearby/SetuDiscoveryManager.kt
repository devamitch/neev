package expo.modules.setunative.nearby

import android.content.Context

/** Process-wide handle to the single [DiscoveryManager]. */
object SetuDiscoveryManager {
    @Volatile
    private var manager: DiscoveryManager? = null

    @Synchronized
    internal fun get(context: Context): DiscoveryManager =
        manager ?: DiscoveryManager(context.applicationContext).also { manager = it }

    internal fun peekOrNull(): DiscoveryManager? = manager

    @Synchronized
    fun shutdown() {
        manager?.shutdown()
        manager = null
    }

    fun createPairCode(context: Context): Map<String, Any> {
        val created = PairCodeManager.createCode()
        get(context).publishPairCode(created["code"] as String)
        return created
    }

    fun stopPairCode(context: Context, code: String) {
        PairCodeManager.stopCode(code)
        get(context).publishPairCode(PairCodeManager.activeCodeValue())
    }

    fun redeemPairCode(context: Context, code: String): Map<String, Any> =
        PairCodeManager.redeem(code, get(context))
}
