package expo.modules.setunative.network

import expo.modules.setunative.security.CryptoIdentityManager
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

internal object PeerTransportTls {
    @Volatile
    private var cachedTlsContext: SSLContext? = null
    private val random = SecureRandom()

    fun getTlsContext(): SSLContext = synchronized(this) {
        cachedTlsContext ?: createTlsContext().also { cachedTlsContext = it }
    }

    fun supportedTlsProtocols(protocols: Array<String>): Array<String> =
        protocols.filter { it == "TLSv1.3" || it == "TLSv1.2" }.toTypedArray().also {
            if (it.isEmpty()) throw IllegalStateException("TLS_UNAVAILABLE")
        }

    fun validateIdentityCertificate(chain: Array<out X509Certificate>) {
        val certificate = chain.firstOrNull() ?: throw CertificateException("CERTIFICATE_MISSING")
        try {
            certificate.checkValidity()
            if (certificate.publicKey.algorithm != "EC" || certificate.issuerX500Principal != certificate.subjectX500Principal) {
                throw CertificateException("UNSUPPORTED_IDENTITY_CERTIFICATE")
            }
            certificate.verify(certificate.publicKey)
            if (certificate.sigAlgName.contains("SHA1", ignoreCase = true)) {
                throw CertificateException("WEAK_CERTIFICATE_SIGNATURE")
            }
        } catch (error: CertificateException) {
            throw error
        } catch (error: Exception) {
            throw CertificateException("INVALID_IDENTITY_CERTIFICATE", error)
        }
    }

    private fun createTlsContext(): SSLContext {
        CryptoIdentityManager.getOrCreate()
        val keyStore = KeyStore.getInstance("AndroidKeyStore").also { it.load(null) }
        val keyManagers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
            init(keyStore, null)
        }
        val trustManager = object : X509TrustManager {
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()

            override fun checkClientTrusted(chain: Array<out X509Certificate>, authType: String) =
                validateIdentityCertificate(chain)

            override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String) =
                validateIdentityCertificate(chain)
        }
        return SSLContext.getInstance("TLS").apply {
            init(keyManagers.keyManagers, arrayOf<TrustManager>(trustManager), random)
        }
    }

    fun clearCachedTlsContext() {
        synchronized(this) {
            cachedTlsContext = null
        }
    }
}