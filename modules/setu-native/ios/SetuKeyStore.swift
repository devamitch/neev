import CryptoKit
import Foundation
import Security

final class SetuKeyStore {
  private let service = "com.setu.identity"
  private let account = "setu_identity_v1"

  struct Identity {
    let deviceId: String
    let publicKey: Data
  }

  func getOrCreateIdentity() throws -> Identity {
    let privateData =
      try loadPrivateKeyData() ?? createAndStorePrivateKey()

    let privateKey =
      try P256.Signing.PrivateKey(rawRepresentation: privateData)

    let publicKey = privateKey.publicKey.x963Representation

    let digest = SHA256.hash(data: publicKey)
    let deviceId = digest
      .map { String(format: "%02x", $0) }
      .joined()

    return Identity(
      deviceId: deviceId,
      publicKey: publicKey
    )
  }

  private func createAndStorePrivateKey() throws -> Data {
    let key = P256.Signing.PrivateKey()
    let data = key.rawRepresentation

    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
      kSecAttrAccessible:
        kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      kSecValueData: data
    ]

    let status = SecItemAdd(
      query as CFDictionary,
      nil
    )

    guard status == errSecSuccess ||
      status == errSecDuplicateItem else {
      throw NSError(
        domain: "SetuKeyStore",
        code: Int(status),
        userInfo: [
          NSLocalizedDescriptionKey:
            "Unable to store Setu private key"
        ]
      )
    }

    return try loadPrivateKeyData() ?? data
  }

  private func loadPrivateKeyData() throws -> Data? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
      kSecReturnData: true,
      kSecMatchLimit: kSecMatchLimitOne
    ]

    var result: CFTypeRef?

    let status = SecItemCopyMatching(
      query as CFDictionary,
      &result
    )

    if status == errSecItemNotFound {
      return nil
    }

    guard status == errSecSuccess else {
      throw NSError(
        domain: "SetuKeyStore",
        code: Int(status),
        userInfo: [
          NSLocalizedDescriptionKey:
            "Unable to read Setu private key"
        ]
      )
    }

    return result as? Data
  }
}
