package expo.modules.setunative.nearby

object DiscoveryConstants {
    const val SERVICE_TYPE = "_setu._tcp"
    const val SERVICE_NAME_PREFIX = "Setu-"
    const val MAX_DEVICE_NAME_LENGTH = 120
    const val ATTRIBUTE_DEVICE_ID = "deviceId"
    const val ATTRIBUTE_DEVICE_NAME = "deviceName"
    const val ATTRIBUTE_PUBLIC_KEY = "publicKey"
    const val ATTRIBUTE_PAIR_CODE = "pairCode"

    /** NsdManager.FAILURE_ALREADY_ACTIVE: another resolve/registration is still in flight. */
    const val NSD_FAILURE_ALREADY_ACTIVE = 3
    const val MAX_RESOLVE_ATTEMPTS = 5
    const val RESOLVE_RETRY_DELAY_MS = 250L
    const val MAX_REGISTER_ATTEMPTS = 6
    const val MAX_TRACKED_PEERS = 64
}
