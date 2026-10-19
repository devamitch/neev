package expo.modules.setunative.security

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * BiometricAuthManager — wraps AndroidX BiometricPrompt for Setu.
 *
 * Authenticator priority:
 *   1. Strong biometric (fingerprint, face, iris)
 *   2. Device credential fallback (PIN, pattern, password)
 *
 * Setu does NOT create its own PIN. Device security is the gate.
 */
object BiometricAuthManager {

    enum class BiometricCapability {
        STRONG_BIOMETRIC,   // fingerprint / face
        DEVICE_CREDENTIAL,  // PIN / pattern / password only
        NONE,               // device has no security at all
    }

    /**
     * Returns the best available authenticator type on this device.
     */
    fun getCapability(context: Context): BiometricCapability {
        val bm = BiometricManager.from(context)

        // Try strong biometric first
        if (bm.canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS) {
            return BiometricCapability.STRONG_BIOMETRIC
        }

        // Fallback to device credential (PIN/pattern/password)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
            bm.canAuthenticate(DEVICE_CREDENTIAL) == BiometricManager.BIOMETRIC_SUCCESS
        ) {
            return BiometricCapability.DEVICE_CREDENTIAL
        }

        return BiometricCapability.NONE
    }

    /**
     * Launches the biometric / device credential prompt.
     *
     * @param activity FragmentActivity required by BiometricPrompt.
     * @param onSuccess Called when authentication succeeds.
     * @param onError   Called with a human-readable error message.
     */
    fun authenticate(
        activity: FragmentActivity,
        title: String = "Verify Identity",
        subtitle: String = "Use your biometric or device credential",
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        val capability = getCapability(activity)
        if (capability == BiometricCapability.NONE) {
            onError("No device security is configured. Please set up a PIN, pattern, or biometric in Settings.")
            return
        }

        val authenticators = when (capability) {
            BiometricCapability.STRONG_BIOMETRIC -> BIOMETRIC_STRONG or DEVICE_CREDENTIAL
            BiometricCapability.DEVICE_CREDENTIAL -> DEVICE_CREDENTIAL
            BiometricCapability.NONE -> return
        }

        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                ) {
                    onError("CANCELLED")
                } else {
                    onError(errString.toString())
                }
            }

            override fun onAuthenticationFailed() {
                // Don't call onError here — the prompt stays open and lets the user retry
            }
        })

        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(authenticators)
            .build()

        prompt.authenticate(info)
    }
}
